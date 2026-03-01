use anyhow::Result;
use std::fs;
use std::path::PathBuf;

use crate::models::{ScannedProject, SessionFile};

pub fn get_projects_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".claude")
        .join("projects")
}

pub fn scan_claude_projects() -> Result<Vec<ScannedProject>> {
    let projects_dir = get_projects_dir();

    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    let entries = fs::read_dir(&projects_dir)?;
    for entry in entries {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }

        let project_dir = entry.path();
        let project_id = entry.file_name().to_string_lossy().to_string();

        let mut session_files = Vec::new();
        if let Ok(files) = fs::read_dir(&project_dir) {
            for f in files {
                let f = f?;
                let fname = f.file_name().to_string_lossy().to_string();
                if !fname.ends_with(".jsonl") || f.file_type()?.is_dir() {
                    continue;
                }
                let meta = f.metadata()?;
                session_files.push(SessionFile {
                    id: fname.trim_end_matches(".jsonl").to_string(),
                    path: f.path().to_string_lossy().to_string(),
                    size: meta.len(),
                });
            }
        }

        if !session_files.is_empty() {
            projects.push(ScannedProject {
                id: project_id,
                dir: project_dir.to_string_lossy().to_string(),
                session_files,
            });
        }
    }

    Ok(projects)
}
