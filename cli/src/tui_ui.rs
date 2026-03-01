use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{
        Bar, BarChart, BarGroup, Block, Borders, Cell, Paragraph, Row, Scrollbar,
        ScrollbarOrientation, ScrollbarState, Sparkline, Table,
    },
    Frame,
};

use crate::format::{
    format_cost, format_duration, format_number, format_relative, short_model, truncate,
};
use crate::theme::ThemeColors;
use crate::tui_app::{App, InputMode, SortColumn, View};

pub fn draw(frame: &mut Frame, app: &mut App) {
    let tc = app.theme.colors();
    let size = frame.area();

    // Clear background
    let bg_block = Block::default().style(Style::default().bg(tc.bg));
    frame.render_widget(bg_block, size);

    // Main layout: header + content + footer
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // header
            Constraint::Min(0),   // content
            Constraint::Length(1), // footer
        ])
        .split(size);

    draw_header(frame, app, &tc, chunks[0]);

    match app.view {
        View::Dashboard => draw_dashboard(frame, app, &tc, chunks[1]),
        View::ProjectList => draw_project_list(frame, app, &tc, chunks[1]),
        View::ProjectDetail => draw_project_detail(frame, app, &tc, chunks[1]),
        View::SessionDetail => draw_session_detail(frame, app, &tc, chunks[1]),
    }

    draw_footer(frame, app, &tc, chunks[2]);
}

fn draw_header(frame: &mut Frame, app: &App, tc: &ThemeColors, area: Rect) {
    let m = &app.metrics;
    let header = Paragraph::new(Line::from(vec![
        Span::styled(" ct ", Style::default().fg(tc.accent).add_modifier(Modifier::BOLD)),
        Span::styled("│ ", Style::default().fg(tc.border)),
        Span::styled(
            format!("{} projects", m.total_projects),
            Style::default().fg(tc.fg),
        ),
        Span::styled(" │ ", Style::default().fg(tc.border)),
        Span::styled(
            format!("{} sessions", m.total_sessions),
            Style::default().fg(tc.fg),
        ),
        Span::styled(" │ ", Style::default().fg(tc.border)),
        Span::styled(
            format!("{} msgs", format_number(m.total_messages as u64)),
            Style::default().fg(tc.fg),
        ),
        Span::styled(" │ ", Style::default().fg(tc.border)),
        Span::styled(
            format!("{} tokens", format_number(m.total_tokens.total())),
            Style::default().fg(tc.token_input),
        ),
        Span::styled(" │ ", Style::default().fg(tc.border)),
        Span::styled(
            format_cost(m.total_cost),
            Style::default().fg(tc.success).add_modifier(Modifier::BOLD),
        ),
        Span::styled(" │ ", Style::default().fg(tc.border)),
        Span::styled(
            format!("Theme: {}", app.theme),
            Style::default().fg(tc.muted),
        ),
    ]))
    .block(
        Block::default()
            .borders(Borders::BOTTOM)
            .border_style(Style::default().fg(tc.border)),
    );
    frame.render_widget(header, area);
}

fn draw_footer(frame: &mut Frame, app: &App, tc: &ThemeColors, area: Rect) {
    let keys = match app.view {
        View::Dashboard => "Enter: Projects │ t: Theme │ q: Quit",
        View::ProjectList => match app.input_mode {
            InputMode::Search => "Type to filter │ Enter: Confirm │ Esc: Cancel",
            InputMode::Normal => "j/k: Navigate │ Enter: Detail │ /: Search │ s: Sort │ t: Theme │ q: Quit",
        },
        View::ProjectDetail => "j/k: Navigate │ Enter: Session │ Esc: Back │ t: Theme │ q: Quit",
        View::SessionDetail => "Esc: Back │ t: Theme │ q: Quit",
    };

    let footer = Paragraph::new(Span::styled(
        format!(" {}", keys),
        Style::default().fg(tc.muted),
    ));
    frame.render_widget(footer, area);
}

fn draw_dashboard(frame: &mut Frame, app: &App, tc: &ThemeColors, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints([
            Constraint::Length(6),  // stats cards
            Constraint::Length(10), // token breakdown + tool usage
            Constraint::Min(4),    // activity sparkline
        ])
        .split(area);

    // Stats cards row
    let card_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(16),
            Constraint::Percentage(16),
            Constraint::Percentage(16),
            Constraint::Percentage(16),
            Constraint::Percentage(16),
            Constraint::Percentage(20),
        ])
        .split(chunks[0]);

    let m = &app.metrics;
    draw_stat_card(frame, tc, card_chunks[0], "Projects", &m.total_projects.to_string(), tc.accent);
    draw_stat_card(frame, tc, card_chunks[1], "Sessions", &m.total_sessions.to_string(), tc.accent);
    draw_stat_card(frame, tc, card_chunks[2], "Messages", &format_number(m.total_messages as u64), tc.accent);
    draw_stat_card(
        frame,
        tc,
        card_chunks[3],
        "Lines +/-",
        &format!(
            "{}/{}",
            format_number(m.total_lines_added),
            format_number(m.total_lines_removed)
        ),
        tc.success,
    );
    draw_stat_card(
        frame,
        tc,
        card_chunks[4],
        "Tokens",
        &format_number(m.total_tokens.total()),
        tc.token_input,
    );
    draw_stat_card(
        frame,
        tc,
        card_chunks[5],
        "Est. Cost",
        &format_cost(m.total_cost),
        tc.success,
    );

    // Token breakdown + tool usage
    let mid_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(40), Constraint::Percentage(60)])
        .split(chunks[1]);

    // Token breakdown
    let token_text = vec![
        Line::from(vec![
            Span::styled("Input:    ", Style::default().fg(tc.muted)),
            Span::styled(
                format_number(m.total_tokens.input),
                Style::default().fg(tc.token_input),
            ),
        ]),
        Line::from(vec![
            Span::styled("Output:   ", Style::default().fg(tc.muted)),
            Span::styled(
                format_number(m.total_tokens.output),
                Style::default().fg(tc.token_output),
            ),
        ]),
        Line::from(vec![
            Span::styled("Cache R:  ", Style::default().fg(tc.muted)),
            Span::styled(
                format_number(m.total_tokens.cache_read),
                Style::default().fg(tc.token_cache),
            ),
        ]),
        Line::from(vec![
            Span::styled("Cache W:  ", Style::default().fg(tc.muted)),
            Span::styled(
                format_number(m.total_tokens.cache_creation),
                Style::default().fg(tc.token_cache),
            ),
        ]),
        Line::from(vec![
            Span::styled("Human:    ", Style::default().fg(tc.muted)),
            Span::styled(
                format!(
                    "{} lines, {} words",
                    format_number(m.human_lines),
                    format_number(m.human_words)
                ),
                Style::default().fg(tc.fg),
            ),
        ]),
    ];
    let token_block = Paragraph::new(token_text).block(
        Block::default()
            .title(Span::styled(" Tokens ", Style::default().fg(tc.title)))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(tc.border)),
    );
    frame.render_widget(token_block, mid_chunks[0]);

    // Tool usage bar chart
    let mut sorted_tools: Vec<(&String, &u64)> = m.tool_usage.iter().collect();
    sorted_tools.sort_by(|a, b| b.1.cmp(a.1));
    sorted_tools.truncate(8);

    let bars: Vec<Bar> = sorted_tools
        .iter()
        .map(|(name, &count)| {
            Bar::default()
                .label(Line::from(truncate(name, 10)))
                .value(count)
                .style(Style::default().fg(tc.bar))
        })
        .collect();

    let bar_chart = BarChart::default()
        .block(
            Block::default()
                .title(Span::styled(" Tool Usage ", Style::default().fg(tc.title)))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(tc.border)),
        )
        .data(BarGroup::default().bars(&bars))
        .bar_width(7)
        .bar_gap(1)
        .bar_style(Style::default().fg(tc.bar))
        .value_style(Style::default().fg(tc.fg));
    frame.render_widget(bar_chart, mid_chunks[1]);

    // Activity sparkline
    let sparkline_data: Vec<u64> = app
        .metrics
        .timeline
        .iter()
        .map(|t| t.sessions)
        .collect();

    let sparkline = Sparkline::default()
        .block(
            Block::default()
                .title(Span::styled(
                    " Activity (sessions/day) ",
                    Style::default().fg(tc.title),
                ))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(tc.border)),
        )
        .data(&sparkline_data)
        .style(Style::default().fg(tc.accent));
    frame.render_widget(sparkline, chunks[2]);
}

fn draw_stat_card(frame: &mut Frame, tc: &ThemeColors, area: Rect, label: &str, value: &str, color: ratatui::style::Color) {
    let card = Paragraph::new(vec![
        Line::from(""),
        Line::from(Span::styled(
            value,
            Style::default().fg(color).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(label, Style::default().fg(tc.muted))),
    ])
    .alignment(ratatui::layout::Alignment::Center)
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(tc.border)),
    );
    frame.render_widget(card, area);
}

fn draw_project_list(frame: &mut Frame, app: &mut App, tc: &ThemeColors, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(3), Constraint::Min(0)])
        .split(area);

    // Search bar
    let search_line = if app.input_mode == InputMode::Search {
        Line::from(vec![
            Span::styled(" / ", Style::default().fg(tc.accent)),
            Span::styled(&app.search_query, Style::default().fg(tc.fg)),
            Span::styled("█", Style::default().fg(tc.accent)),
        ])
    } else {
        Line::from(vec![
            Span::styled(
                format!(" Sort: {} ", app.sort_column.label()),
                Style::default().fg(tc.muted),
            ),
            if !app.search_query.is_empty() {
                Span::styled(
                    format!("│ Filter: {} ", &app.search_query),
                    Style::default().fg(tc.accent),
                )
            } else {
                Span::raw("")
            },
            Span::styled(
                format!(
                    "│ {}/{} projects",
                    app.filtered_projects.len(),
                    app.projects.len()
                ),
                Style::default().fg(tc.muted),
            ),
        ])
    };

    let search_bar = Paragraph::new(search_line).block(
        Block::default()
            .borders(Borders::BOTTOM)
            .border_style(Style::default().fg(tc.border)),
    );
    frame.render_widget(search_bar, chunks[0]);

    // Build sort indicator
    let sort_indicator = |col: SortColumn| -> &str {
        if app.sort_column == col { " ▼" } else { "" }
    };

    // Project table
    let header_cells = [
        format!("Project{}", sort_indicator(SortColumn::Name)),
        format!("Sess{}", sort_indicator(SortColumn::Sessions)),
        format!("Msgs{}", sort_indicator(SortColumn::Messages)),
        format!("Tokens{}", sort_indicator(SortColumn::Tokens)),
        format!("Lines +/-{}", sort_indicator(SortColumn::Lines)),
        format!("Cost{}", sort_indicator(SortColumn::Cost)),
        "Model".to_string(),
        format!("Last Active{}", sort_indicator(SortColumn::LastActive)),
    ];
    let header = Row::new(
        header_cells
            .iter()
            .map(|h| Cell::from(h.as_str()).style(Style::default().fg(tc.accent))),
    )
    .height(1);

    let rows: Vec<Row> = app
        .filtered_projects
        .iter()
        .map(|&idx| {
            let p = &app.projects[idx];
            let model_color = tc.model_color(&p.model);
            Row::new(vec![
                Cell::from(truncate(&p.name, 30)).style(Style::default().fg(tc.fg)),
                Cell::from(p.session_count.to_string()).style(Style::default().fg(tc.fg)),
                Cell::from(p.message_count.to_string()).style(Style::default().fg(tc.fg)),
                Cell::from(format_number(p.total_tokens.total()))
                    .style(Style::default().fg(tc.token_input)),
                Cell::from(format!(
                    "+{}/-{}",
                    format_number(p.lines_added),
                    format_number(p.lines_removed)
                ))
                .style(Style::default().fg(tc.success)),
                Cell::from(format_cost(p.cost)).style(Style::default().fg(tc.success)),
                Cell::from(short_model(&p.model)).style(Style::default().fg(model_color)),
                Cell::from(format_relative(&p.last_active)).style(Style::default().fg(tc.muted)),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(25),
            Constraint::Length(6),
            Constraint::Length(6),
            Constraint::Length(10),
            Constraint::Length(14),
            Constraint::Length(8),
            Constraint::Length(12),
            Constraint::Percentage(15),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .title(Span::styled(" Projects ", Style::default().fg(tc.title)))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(tc.border)),
    )
    .row_highlight_style(
        Style::default()
            .bg(tc.highlight_bg)
            .fg(tc.highlight_fg)
            .add_modifier(Modifier::BOLD),
    );

    frame.render_stateful_widget(table, chunks[1], &mut app.project_table_state);

    // Scrollbar
    let content_len = app.filtered_projects.len();
    if content_len > 0 {
        let mut scrollbar_state = ScrollbarState::new(content_len).position(app.selected_project);
        let scrollbar = Scrollbar::new(ScrollbarOrientation::VerticalRight)
            .style(Style::default().fg(tc.muted));
        frame.render_stateful_widget(scrollbar, chunks[1], &mut scrollbar_state);
    }
}

fn draw_project_detail(frame: &mut Frame, app: &mut App, tc: &ThemeColors, area: Rect) {
    let project = match app.current_project() {
        Some(p) => p.clone(),
        None => return,
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints([
            Constraint::Length(5), // project info
            Constraint::Min(0),   // session table
        ])
        .split(area);

    // Project info
    let model_color = tc.model_color(&project.model);
    let info = Paragraph::new(vec![
        Line::from(vec![
            Span::styled(&project.name, Style::default().fg(tc.title).add_modifier(Modifier::BOLD)),
            Span::styled("  ", Style::default()),
            Span::styled(short_model(&project.model), Style::default().fg(model_color)),
        ]),
        Line::from(vec![
            Span::styled("Path: ", Style::default().fg(tc.muted)),
            Span::styled(&project.path, Style::default().fg(tc.fg)),
        ]),
        Line::from(vec![
            Span::styled(
                format!(
                    "{} sessions │ {} messages │ {} tokens │ +{}/−{} lines │ {}",
                    project.session_count,
                    project.message_count,
                    format_number(project.total_tokens.total()),
                    format_number(project.lines_added),
                    format_number(project.lines_removed),
                    format_cost(project.cost),
                ),
                Style::default().fg(tc.fg),
            ),
        ]),
    ])
    .block(
        Block::default()
            .borders(Borders::BOTTOM)
            .border_style(Style::default().fg(tc.border)),
    );
    frame.render_widget(info, chunks[0]);

    // Session table
    let header = Row::new(vec![
        Cell::from("First Prompt").style(Style::default().fg(tc.accent)),
        Cell::from("Messages").style(Style::default().fg(tc.accent)),
        Cell::from("Tokens").style(Style::default().fg(tc.accent)),
        Cell::from("Duration").style(Style::default().fg(tc.accent)),
        Cell::from("Lines +/-").style(Style::default().fg(tc.accent)),
        Cell::from("Model").style(Style::default().fg(tc.accent)),
        Cell::from("Started").style(Style::default().fg(tc.accent)),
    ]);

    let rows: Vec<Row> = project
        .sessions
        .iter()
        .map(|s| {
            let mc = tc.model_color(&s.model);
            Row::new(vec![
                Cell::from(truncate(&s.first_prompt, 40)).style(Style::default().fg(tc.fg)),
                Cell::from(s.messages.len().to_string()).style(Style::default().fg(tc.fg)),
                Cell::from(format_number(s.total_tokens.total()))
                    .style(Style::default().fg(tc.token_input)),
                Cell::from(format_duration(s.duration_ms)).style(Style::default().fg(tc.fg)),
                Cell::from(format!(
                    "+{}/−{}",
                    format_number(s.lines_added),
                    format_number(s.lines_removed)
                ))
                .style(Style::default().fg(tc.success)),
                Cell::from(short_model(&s.model)).style(Style::default().fg(mc)),
                Cell::from(format_relative(&s.started_at)).style(Style::default().fg(tc.muted)),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(30),
            Constraint::Length(8),
            Constraint::Length(10),
            Constraint::Length(10),
            Constraint::Length(14),
            Constraint::Length(12),
            Constraint::Percentage(15),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .title(Span::styled(" Sessions ", Style::default().fg(tc.title)))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(tc.border)),
    )
    .row_highlight_style(
        Style::default()
            .bg(tc.highlight_bg)
            .fg(tc.highlight_fg)
            .add_modifier(Modifier::BOLD),
    );

    frame.render_stateful_widget(table, chunks[1], &mut app.session_table_state);
}

fn draw_session_detail(frame: &mut Frame, app: &App, tc: &ThemeColors, area: Rect) {
    let project = match app.current_project() {
        Some(p) => p,
        None => return,
    };
    let session = match project.sessions.get(app.selected_session) {
        Some(s) => s,
        None => return,
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .margin(1)
        .constraints([
            Constraint::Length(8),  // session info + tokens
            Constraint::Length(10), // tool usage
            Constraint::Min(4),    // top files
        ])
        .split(area);

    // Session info
    let model_color = tc.model_color(&session.model);
    let cost = crate::format::estimate_cost(
        &session.model,
        session.total_tokens.input,
        session.total_tokens.output,
        session.total_tokens.cache_read,
    );

    let info_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(chunks[0]);

    let info = Paragraph::new(vec![
        Line::from(vec![
            Span::styled("Prompt: ", Style::default().fg(tc.muted)),
            Span::styled(
                truncate(&session.first_prompt, 60),
                Style::default().fg(tc.fg),
            ),
        ]),
        Line::from(vec![
            Span::styled("Model:  ", Style::default().fg(tc.muted)),
            Span::styled(short_model(&session.model), Style::default().fg(model_color)),
        ]),
        Line::from(vec![
            Span::styled("Duration: ", Style::default().fg(tc.muted)),
            Span::styled(format_duration(session.duration_ms), Style::default().fg(tc.fg)),
            Span::styled("  │  Messages: ", Style::default().fg(tc.muted)),
            Span::styled(session.messages.len().to_string(), Style::default().fg(tc.fg)),
        ]),
        Line::from(vec![
            Span::styled("Lines: ", Style::default().fg(tc.muted)),
            Span::styled(format!("+{}", format_number(session.lines_added)), Style::default().fg(tc.success)),
            Span::styled(" / ", Style::default().fg(tc.muted)),
            Span::styled(format!("−{}", format_number(session.lines_removed)), Style::default().fg(tc.danger)),
            Span::styled("  │  Cost: ", Style::default().fg(tc.muted)),
            Span::styled(format_cost(cost), Style::default().fg(tc.success)),
        ]),
        Line::from(vec![
            Span::styled("Started: ", Style::default().fg(tc.muted)),
            Span::styled(format_relative(&session.started_at), Style::default().fg(tc.fg)),
        ]),
    ])
    .block(
        Block::default()
            .title(Span::styled(" Session ", Style::default().fg(tc.title)))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(tc.border)),
    );
    frame.render_widget(info, info_chunks[0]);

    // Token breakdown
    let token_info = Paragraph::new(vec![
        Line::from(vec![
            Span::styled("Input:          ", Style::default().fg(tc.muted)),
            Span::styled(
                format_number(session.total_tokens.input),
                Style::default().fg(tc.token_input),
            ),
        ]),
        Line::from(vec![
            Span::styled("Output:         ", Style::default().fg(tc.muted)),
            Span::styled(
                format_number(session.total_tokens.output),
                Style::default().fg(tc.token_output),
            ),
        ]),
        Line::from(vec![
            Span::styled("Cache Read:     ", Style::default().fg(tc.muted)),
            Span::styled(
                format_number(session.total_tokens.cache_read),
                Style::default().fg(tc.token_cache),
            ),
        ]),
        Line::from(vec![
            Span::styled("Cache Creation: ", Style::default().fg(tc.muted)),
            Span::styled(
                format_number(session.total_tokens.cache_creation),
                Style::default().fg(tc.token_cache),
            ),
        ]),
        Line::from(vec![
            Span::styled("Human Input:    ", Style::default().fg(tc.muted)),
            Span::styled(
                format!(
                    "{} lines, {} words",
                    session.human_lines, session.human_words
                ),
                Style::default().fg(tc.fg),
            ),
        ]),
    ])
    .block(
        Block::default()
            .title(Span::styled(" Tokens ", Style::default().fg(tc.title)))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(tc.border)),
    );
    frame.render_widget(token_info, info_chunks[1]);

    // Tool usage bar chart
    let mut sorted_tools: Vec<(&String, &u64)> = session.tool_usage.iter().collect();
    sorted_tools.sort_by(|a, b| b.1.cmp(a.1));
    sorted_tools.truncate(10);

    let bars: Vec<Bar> = sorted_tools
        .iter()
        .map(|(name, &count)| {
            Bar::default()
                .label(Line::from(truncate(name, 10)))
                .value(count)
                .style(Style::default().fg(tc.bar))
        })
        .collect();

    let tool_chart = BarChart::default()
        .block(
            Block::default()
                .title(Span::styled(" Tool Usage ", Style::default().fg(tc.title)))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(tc.border)),
        )
        .data(BarGroup::default().bars(&bars))
        .bar_width(7)
        .bar_gap(1)
        .bar_style(Style::default().fg(tc.bar))
        .value_style(Style::default().fg(tc.fg));
    frame.render_widget(tool_chart, chunks[1]);

    // Top files
    let mut sorted_files: Vec<(&String, &crate::models::FileContribution)> =
        session.file_contributions.iter().collect();
    sorted_files.sort_by(|a, b| (b.1.added + b.1.removed).cmp(&(a.1.added + a.1.removed)));
    sorted_files.truncate(15);

    let file_rows: Vec<Row> = sorted_files
        .iter()
        .map(|(path, fc)| {
            let short_path = path.split('/').rev().take(3).collect::<Vec<_>>();
            let display_path = short_path.into_iter().rev().collect::<Vec<_>>().join("/");
            Row::new(vec![
                Cell::from(display_path).style(Style::default().fg(tc.fg)),
                Cell::from(format!("+{}", fc.added)).style(Style::default().fg(tc.success)),
                Cell::from(format!("−{}", fc.removed)).style(Style::default().fg(tc.danger)),
            ])
        })
        .collect();

    let file_header = Row::new(vec![
        Cell::from("File").style(Style::default().fg(tc.accent)),
        Cell::from("Added").style(Style::default().fg(tc.accent)),
        Cell::from("Removed").style(Style::default().fg(tc.accent)),
    ]);

    let file_table = Table::new(
        file_rows,
        [
            Constraint::Percentage(70),
            Constraint::Length(10),
            Constraint::Length(10),
        ],
    )
    .header(file_header)
    .block(
        Block::default()
            .title(Span::styled(" Top Files ", Style::default().fg(tc.title)))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(tc.border)),
    );
    frame.render_widget(file_table, chunks[2]);
}
