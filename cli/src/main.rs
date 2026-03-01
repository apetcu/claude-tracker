mod display;
mod format;
mod metrics;
mod models;
mod parser;
mod scanner;
mod theme;
mod tui_app;
mod tui_events;
mod tui_ui;

use anyhow::Result;
use clap::Parser;
use crossterm::{
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use rayon::prelude::*;
use std::io;

use crate::display::{print_cli_table, print_json};
use crate::metrics::{build_project_summaries, compute_global_metrics};
use crate::models::ParsedSession;
use crate::scanner::scan_claude_projects;
use crate::tui_app::App;

#[derive(Parser)]
#[command(name = "ct", about = "Claude Tracker — analyze Claude Code usage")]
struct Cli {
    /// Print table output instead of interactive TUI
    #[arg(long)]
    cli: bool,

    /// Output as JSON
    #[arg(long)]
    json: bool,
}

fn main() -> Result<()> {
    let args = Cli::parse();

    // Scan projects
    let scanned = scan_claude_projects()?;
    if scanned.is_empty() {
        eprintln!("No Claude projects found in ~/.claude/projects/");
        return Ok(());
    }

    // Parse all session files in parallel, grouped by project
    let project_sessions: Vec<(String, Vec<ParsedSession>)> = scanned
        .into_par_iter()
        .map(|project| {
            let project_id = project.id.clone();
            let sessions: Vec<ParsedSession> = project
                .session_files
                .par_iter()
                .filter_map(|sf| {
                    parser::parse_session_file(&sf.path, &sf.id, &project_id).ok()
                })
                .collect();
            (project_id, sessions)
        })
        .collect();

    // Build summaries and metrics
    let projects = build_project_summaries(project_sessions);
    let metrics = compute_global_metrics(&projects);

    if args.json {
        print_json(&projects, &metrics);
        return Ok(());
    }

    if args.cli {
        print_cli_table(&projects, &metrics);
        return Ok(());
    }

    // Interactive TUI
    run_tui(projects, metrics)
}

fn run_tui(
    projects: Vec<crate::models::ProjectSummary>,
    metrics: crate::models::GlobalMetrics,
) -> Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut app = App::new(projects, metrics);

    // Main loop
    loop {
        terminal.draw(|f| tui_ui::draw(f, &mut app))?;
        tui_events::handle_events(&mut app)?;

        if app.should_quit {
            break;
        }
    }

    // Restore terminal
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    Ok(())
}
