use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use anyhow::Result;
use uuid::Uuid;
use chrono::Utc;
use std::path::PathBuf;
use std::fs;

const KEYRING_SERVICE: &str = "no-more-snobs";
const KEYRING_USER: &str = "anthropic-api-key";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatus {
    pub current_task: String,
    pub token_spend_today: u64,
    pub token_spend_month: u64,
    pub uptime_seconds: u64,
    pub health: String,
    pub is_running: bool,
    pub daily_token_cap: u64,
}

impl Default for AgentStatus {
    fn default() -> Self {
        Self {
            current_task: "Ready when you are.".to_string(),
            token_spend_today: 0,
            token_spend_month: 0,
            uptime_seconds: 0,
            health: "green".to_string(),
            is_running: false,
            daily_token_cap: 100_000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub times_used: u64,
    pub last_used: Option<String>,
    pub enabled: bool,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deliverable {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub mission: String,
    pub skills_used: Vec<String>,
    pub filepath: Option<String>,
    pub score: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SkillMetadata {
    id: String,
    name: String,
    description: String,
    times_used: u64,
    last_used: Option<String>,
    enabled: bool,
    filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeliverableRecord {
    id: String,
    title: String,
    content: String,
    created_at: String,
    mission: String,
    skills_used: Vec<String>,
    filepath: Option<String>,
    score: Option<u32>,
}

pub struct AppState {
    pub status: Arc<Mutex<AgentStatus>>,
    pub start_time: std::time::Instant,
    pub token_cap: Arc<Mutex<u64>>,
}

fn workspace_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("NoMoreSnobs")
}

fn skills_dir() -> PathBuf {
    workspace_dir().join("skills")
}

fn deliverables_dir() -> PathBuf {
    workspace_dir().join("deliverables")
}

fn metadata_dir() -> PathBuf {
    workspace_dir().join(".meta")
}

fn ensure_dirs() -> Result<()> {
    for dir in &[workspace_dir(), skills_dir(), deliverables_dir(), metadata_dir()] {
        fs::create_dir_all(dir)?;
    }
    Ok(())
}

#[tauri::command]
async fn check_api_key() -> bool {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map(|e| e.get_password().is_ok())
        .unwrap_or(false)
}

#[tauri::command]
async fn save_api_key(key: String) -> Result<(), String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| e.to_string())?
        .set_password(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_status(state: State<'_, AppState>) -> Result<AgentStatus, String> {
    let mut status = state.status.lock().await.clone();
    status.uptime_seconds = state.start_time.elapsed().as_secs();
    Ok(status)
}

#[tauri::command]
async fn get_skills() -> Result<Vec<Skill>, String> {
    ensure_dirs().map_err(|e| e.to_string())?;
    let meta_dir = metadata_dir();
    let skills_meta = meta_dir.join("skills.json");

    if !skills_meta.exists() {
        return Ok(vec![]);
    }

    let data = fs::read_to_string(&skills_meta).map_err(|e| e.to_string())?;
    let records: Vec<SkillMetadata> = serde_json::from_str(&data).unwrap_or_default();

    Ok(records.into_iter().map(|r| Skill {
        id: r.id,
        name: r.name,
        description: r.description,
        times_used: r.times_used,
        last_used: r.last_used,
        enabled: r.enabled,
        filename: r.filename,
    }).collect())
}

#[tauri::command]
async fn get_deliverables() -> Result<Vec<Deliverable>, String> {
    ensure_dirs().map_err(|e| e.to_string())?;
    let meta_file = metadata_dir().join("deliverables.json");

    if !meta_file.exists() {
        return Ok(vec![]);
    }

    let data = fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
    let records: Vec<DeliverableRecord> = serde_json::from_str(&data).unwrap_or_default();

    let mut deliverables: Vec<Deliverable> = records.into_iter().map(|r| Deliverable {
        id: r.id,
        title: r.title,
        content: r.content,
        created_at: r.created_at,
        mission: r.mission,
        skills_used: r.skills_used,
        filepath: r.filepath,
        score: r.score,
    }).collect();

    deliverables.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(deliverables)
}

#[tauri::command]
async fn start_task(
    mission: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let api_key = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| e.to_string())?
        .get_password()
        .map_err(|_| "No API key configured. Please add your key in Settings.".to_string())?;

    {
        let mut status = state.status.lock().await;
        if status.is_running {
            return Err("A task is already running.".to_string());
        }
        status.is_running = true;
        status.current_task = format!("Starting: {}", &mission[..mission.len().min(80)]);
        status.health = "amber".to_string();
        let s = status.clone();
        drop(status);
        app.emit("status_update", s).ok();
    }

    let cap = *state.token_cap.lock().await;
    let status_arc = state.status.clone();
    let token_cap_arc = state.token_cap.clone();

    tokio::spawn(async move {
        run_agent_task(mission, api_key, cap, status_arc, token_cap_arc, app).await;
    });

    Ok(())
}

async fn run_agent_task(
    mission: String,
    api_key: String,
    _daily_cap: u64,
    status_arc: Arc<Mutex<AgentStatus>>,
    _token_cap_arc: Arc<Mutex<u64>>,
    app: AppHandle,
) {
    ensure_dirs().ok();

    // Load enabled skills
    let skill_context = load_skill_context();

    // Build the system prompt with skills
    let system_prompt = build_system_prompt(&skill_context);

    // Call Anthropic API
    let result = call_anthropic_api(&api_key, &mission, &system_prompt, status_arc.clone(), &app).await;

    match result {
        Ok((content, tokens_used)) => {
            // Evaluate the output
            let score = evaluate_output(&api_key, &mission, &content).await.unwrap_or(75);

            // Save deliverable
            let deliverable_id = Uuid::new_v4().to_string();
            let title = extract_title(&content, &mission);
            let filepath = save_deliverable_file(&deliverable_id, &content);

            let deliverable = Deliverable {
                id: deliverable_id.clone(),
                title: title.clone(),
                content: content.clone(),
                created_at: Utc::now().to_rfc3339(),
                mission: mission.clone(),
                skills_used: vec![],
                filepath,
                score: Some(score),
            };

            save_deliverable_record(&deliverable).ok();
            app.emit("deliverable_ready", deliverable).ok();

            // Extract new skills from this task
            extract_skills(&api_key, &mission, &content, &app).await.ok();

            let mut status = status_arc.lock().await;
            status.is_running = false;
            status.current_task = format!("Done: {}", &title[..title.len().min(60)]);
            status.health = "green".to_string();
            status.token_spend_today += tokens_used;
            status.token_spend_month += tokens_used;
            let s = status.clone();
            drop(status);
            app.emit("status_update", s).ok();
        }
        Err(e) => {
            let mut status = status_arc.lock().await;
            status.is_running = false;
            status.current_task = "Something went wrong. Please try again.".to_string();
            status.health = "red".to_string();
            let s = status.clone();
            drop(status);
            app.emit("status_update", s).ok();
            eprintln!("Agent error: {}", e);
        }
    }
}

fn load_skill_context() -> String {
    let skills_dir = skills_dir();
    let mut context = String::new();

    if let Ok(entries) = fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e == "txt").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    context.push_str(&content);
                    context.push_str("\n\n---\n\n");
                }
            }
        }
    }
    context
}

fn build_system_prompt(skill_context: &str) -> String {
    let base = r#"You are a highly capable, diligent assistant working inside the No More Snobs factory. Your job is to complete tasks thoroughly and deliver excellent results.

Work through the task step by step. When you are done, produce a complete, polished deliverable. Format your output clearly with a title on the first line (prefixed with "TITLE: "), followed by the full content.

Be thorough. Be helpful. Deliver real value. Avoid fluff."#;

    if skill_context.is_empty() {
        base.to_string()
    } else {
        format!("{}\n\nYou have the following learned skills available:\n\n{}", base, skill_context)
    }
}

async fn call_anthropic_api(
    api_key: &str,
    mission: &str,
    system_prompt: &str,
    status_arc: Arc<Mutex<AgentStatus>>,
    app: &AppHandle,
) -> Result<(String, u64)> {
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "model": "claude-opus-4-7",
        "max_tokens": 8192,
        "thinking": {"type": "adaptive"},
        "system": system_prompt,
        "messages": [
            {
                "role": "user",
                "content": mission
            }
        ]
    });

    {
        let mut status = status_arc.lock().await;
        status.current_task = "Working on your task\u{2026}".to_string();
        let s = status.clone();
        drop(status);
        app.emit("status_update", s).ok();
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    if !response.status().is_success() {
        let status_code = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("API error {}: {}", status_code, error_body));
    }

    let response_json: serde_json::Value = response.json().await?;

    let content = response_json["content"]
        .as_array()
        .and_then(|arr| {
            arr.iter()
                .find(|block| block["type"] == "text")
                .and_then(|block| block["text"].as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "Task completed.".to_string());

    let tokens_used = response_json["usage"]["output_tokens"]
        .as_u64()
        .unwrap_or(0)
        + response_json["usage"]["input_tokens"].as_u64().unwrap_or(0);

    Ok((content, tokens_used))
}

async fn evaluate_output(api_key: &str, mission: &str, content: &str) -> Result<u32> {
    let client = reqwest::Client::new();

    let prompt = format!(
        "Rate the following work product on a scale of 0-100 based on how well it fulfils this goal: \"{}\"\n\nWork product:\n{}\n\nRespond with ONLY a number between 0 and 100.",
        mission,
        &content[..content.len().min(2000)]
    );

    let body = serde_json::json!({
        "model": "claude-opus-4-7",
        "max_tokens": 16,
        "messages": [{"role": "user", "content": prompt}]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    let response_json: serde_json::Value = response.json().await?;
    let score_str = response_json["content"]
        .as_array()
        .and_then(|a| a.first())
        .and_then(|b| b["text"].as_str())
        .unwrap_or("75")
        .trim()
        .to_string();

    let score: u32 = score_str.parse().unwrap_or(75).min(100);
    Ok(score)
}

async fn extract_skills(
    api_key: &str,
    mission: &str,
    content: &str,
    app: &AppHandle,
) -> Result<()> {
    let client = reqwest::Client::new();

    let prompt = format!(
        "You just completed this task: \"{}\"\n\nYour output was:\n{}\n\nIdentify ONE reusable skill you used or developed during this task that could be applied to future similar tasks. If no meaningful skill can be extracted, respond with NONE.\n\nIf you identify a skill, format your response EXACTLY as:\nSKILL_NAME: <short name, max 5 words>\nDESCRIPTION: <one sentence explaining what this skill does>\nTRIGGER: <what kind of task triggers this skill>\nPROCEDURE: <step-by-step procedure in plain English>",
        mission,
        &content[..content.len().min(3000)]
    );

    let body = serde_json::json!({
        "model": "claude-opus-4-7",
        "max_tokens": 512,
        "messages": [{"role": "user", "content": prompt}]
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    let response_json: serde_json::Value = response.json().await?;
    let skill_text = response_json["content"]
        .as_array()
        .and_then(|a| a.first())
        .and_then(|b| b["text"].as_str())
        .unwrap_or("NONE")
        .trim()
        .to_string();

    if skill_text == "NONE" || !skill_text.contains("SKILL_NAME:") {
        return Ok(());
    }

    // Parse skill
    let name = extract_field(&skill_text, "SKILL_NAME").unwrap_or_else(|| "Unnamed Skill".to_string());
    let description = extract_field(&skill_text, "DESCRIPTION").unwrap_or_else(|| "A reusable skill.".to_string());

    // Save skill file
    let skill_id = Uuid::new_v4().to_string();
    let filename = format!("{}.txt", slug(&name));
    let skill_path = skills_dir().join(&filename);

    fs::write(&skill_path, &skill_text)?;

    // Update metadata
    let skill = Skill {
        id: skill_id.clone(),
        name: name.clone(),
        description: description.clone(),
        times_used: 1,
        last_used: Some(Utc::now().to_rfc3339()),
        enabled: true,
        filename: filename.clone(),
    };

    save_skill_record(&skill)?;
    app.emit("skill_added", skill).ok();

    Ok(())
}

fn extract_field(text: &str, field: &str) -> Option<String> {
    let prefix = format!("{}:", field);
    text.lines()
        .find(|l| l.starts_with(&prefix))
        .map(|l| l[prefix.len()..].trim().to_string())
}

fn slug(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn extract_title(content: &str, mission: &str) -> String {
    for line in content.lines() {
        if line.starts_with("TITLE:") {
            let t = line[6..].trim().to_string();
            if !t.is_empty() {
                return t;
            }
        }
        if line.starts_with('#') {
            let t = line.trim_start_matches('#').trim().to_string();
            if !t.is_empty() {
                return t;
            }
        }
    }
    let truncated = &mission[..mission.len().min(60)];
    if mission.len() > 60 {
        format!("{}\u{2026}", truncated)
    } else {
        truncated.to_string()
    }
}

fn save_deliverable_file(id: &str, content: &str) -> Option<String> {
    let path = deliverables_dir().join(format!("{}.md", id));
    fs::write(&path, content).ok()?;
    path.to_string_lossy().into_owned().into()
}

fn save_deliverable_record(deliverable: &Deliverable) -> Result<()> {
    let meta_file = metadata_dir().join("deliverables.json");
    let mut records: Vec<DeliverableRecord> = if meta_file.exists() {
        let data = fs::read_to_string(&meta_file)?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    records.insert(0, DeliverableRecord {
        id: deliverable.id.clone(),
        title: deliverable.title.clone(),
        content: deliverable.content.clone(),
        created_at: deliverable.created_at.clone(),
        mission: deliverable.mission.clone(),
        skills_used: deliverable.skills_used.clone(),
        filepath: deliverable.filepath.clone(),
        score: deliverable.score,
    });

    records.truncate(500);
    fs::write(&meta_file, serde_json::to_string_pretty(&records)?)?;
    Ok(())
}

fn save_skill_record(skill: &Skill) -> Result<()> {
    let meta_file = metadata_dir().join("skills.json");
    let mut records: Vec<SkillMetadata> = if meta_file.exists() {
        let data = fs::read_to_string(&meta_file)?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    if let Some(existing) = records.iter_mut().find(|r| r.filename == skill.filename) {
        existing.times_used += 1;
        existing.last_used = skill.last_used.clone();
    } else {
        records.push(SkillMetadata {
            id: skill.id.clone(),
            name: skill.name.clone(),
            description: skill.description.clone(),
            times_used: skill.times_used,
            last_used: skill.last_used.clone(),
            enabled: skill.enabled,
            filename: skill.filename.clone(),
        });
    }

    fs::write(&meta_file, serde_json::to_string_pretty(&records)?)?;
    Ok(())
}

#[tauri::command]
async fn stop_task(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let mut status = state.status.lock().await;
    status.is_running = false;
    status.current_task = "Stopped.".to_string();
    status.health = "green".to_string();
    let s = status.clone();
    drop(status);
    app.emit("status_update", s).ok();
    Ok(())
}

#[tauri::command]
async fn toggle_skill(skill_id: String, enabled: bool) -> Result<(), String> {
    let meta_file = metadata_dir().join("skills.json");
    if !meta_file.exists() {
        return Ok(());
    }

    let data = fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
    let mut records: Vec<SkillMetadata> = serde_json::from_str(&data).unwrap_or_default();

    if let Some(skill) = records.iter_mut().find(|s| s.id == skill_id) {
        skill.enabled = enabled;
    }

    fs::write(&meta_file, serde_json::to_string_pretty(&records).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_skill(skill_id: String) -> Result<(), String> {
    let meta_file = metadata_dir().join("skills.json");
    if !meta_file.exists() {
        return Ok(());
    }

    let data = fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
    let mut records: Vec<SkillMetadata> = serde_json::from_str(&data).unwrap_or_default();

    if let Some(skill) = records.iter().find(|s| s.id == skill_id) {
        let skill_path = skills_dir().join(&skill.filename);
        fs::remove_file(skill_path).ok();
    }

    records.retain(|s| s.id != skill_id);
    fs::write(&meta_file, serde_json::to_string_pretty(&records).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn set_token_cap(cap: u64, state: State<'_, AppState>) -> Result<(), String> {
    *state.token_cap.lock().await = cap;
    let mut status = state.status.lock().await;
    status.daily_token_cap = cap;
    Ok(())
}

#[tauri::command]
async fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn share_deliverable(id: String) -> Result<(), String> {
    let meta_file = metadata_dir().join("deliverables.json");
    if !meta_file.exists() {
        return Ok(());
    }

    let data = fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
    let records: Vec<DeliverableRecord> = serde_json::from_str(&data).unwrap_or_default();

    if let Some(record) = records.iter().find(|r| r.id == id) {
        if let Some(filepath) = &record.filepath {
            open_file(filepath.clone()).await?;
        }
    }
    Ok(())
}

pub fn run() {
    let state = AppState {
        status: Arc::new(Mutex::new(AgentStatus::default())),
        start_time: std::time::Instant::now(),
        token_cap: Arc::new(Mutex::new(100_000)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            check_api_key,
            save_api_key,
            get_status,
            get_skills,
            get_deliverables,
            start_task,
            stop_task,
            toggle_skill,
            delete_skill,
            set_token_cap,
            open_file,
            share_deliverable,
        ])
        .run(tauri::generate_context!())
        .expect("error while running No More Snobs");
}
