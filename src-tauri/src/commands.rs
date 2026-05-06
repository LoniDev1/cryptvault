use crate::crypto::kdf::{derive_master_key, KdfParams};
use crate::error::{AppError, Result};
use crate::files::encrypt as files_mod;
use crate::state::AppState;
use crate::volume::header::KdfMode;
use crate::volume::{create as vcreate, entries as ventries, mount as vmount};
use rand::seq::SliceRandom;
use rand::RngCore;
use serde::Serialize;
use std::path::PathBuf;
use std::time::Instant;
use tauri::State;

#[derive(Serialize)]
pub struct MountSummary {
    pub id: String,
    pub label: String,
    pub path: String,
    pub entry_count: usize,
    pub kdf_mode: KdfMode,
}

#[derive(Serialize)]
pub struct PasswordReport {
    pub score: u8,
    pub entropy_bits: f32,
    pub label: &'static str,
    pub suggestions: Vec<&'static str>,
}

#[tauri::command]
pub async fn create_volume(
    path: String,
    label: String,
    password: String,
    kdf_mode: KdfMode,
    size_mb: u64,
) -> Result<()> {
    let path = PathBuf::from(path);
    tokio::task::spawn_blocking(move || {
        vcreate::create_volume(&path, &label, password.as_bytes(), kdf_mode, size_mb)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn mount_volume(
    state: State<'_, AppState>,
    path: String,
    password: String,
) -> Result<MountSummary> {
    let p = PathBuf::from(path);
    let mounted = tokio::task::spawn_blocking(move || vmount::mount(&p, password.as_bytes()))
        .await
        .map_err(|e| AppError::Other(e.to_string()))??;
    let summary = MountSummary {
        id: mounted.header.meta.id.clone(),
        label: mounted.header.meta.label.clone(),
        path: mounted.path.to_string_lossy().to_string(),
        entry_count: mounted.data.entries.len(),
        kdf_mode: mounted.header.meta.kdf_mode.clone(),
    };
    state.mounts.lock().insert(summary.id.clone(), mounted);
    Ok(summary)
}

#[tauri::command]
pub async fn unmount_volume(state: State<'_, AppState>, id: String) -> Result<()> {
    let mut m = state.mounts.lock().remove(&id).ok_or_else(|| AppError::NotFound("mount".into()))?;
    tokio::task::spawn_blocking(move || vmount::unmount(&mut m))
        .await
        .map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub fn list_mounts(state: State<'_, AppState>) -> Vec<MountSummary> {
    state
        .mounts
        .lock()
        .values()
        .map(|m| MountSummary {
            id: m.header.meta.id.clone(),
            label: m.header.meta.label.clone(),
            path: m.path.to_string_lossy().to_string(),
            entry_count: m.data.entries.len(),
            kdf_mode: m.header.meta.kdf_mode.clone(),
        })
        .collect()
}

#[tauri::command]
pub fn add_files_to_mount(
    state: State<'_, AppState>,
    id: String,
    files: Vec<String>,
) -> Result<Vec<ventries::EntryInfo>> {
    let mut guard = state.mounts.lock();
    let m = guard.get_mut(&id).ok_or_else(|| AppError::NotFound("mount".into()))?;
    let paths: Vec<PathBuf> = files.into_iter().map(PathBuf::from).collect();
    let added = ventries::add_files(m, &paths)?;
    Ok(added.into_iter().map(strip_data).collect())
}

#[tauri::command]
pub fn list_mount_entries(state: State<'_, AppState>, id: String) -> Result<Vec<ventries::EntryInfo>> {
    let guard = state.mounts.lock();
    let m = guard.get(&id).ok_or_else(|| AppError::NotFound("mount".into()))?;
    Ok(ventries::list_entries(m))
}

#[tauri::command]
pub fn extract_entry(
    state: State<'_, AppState>,
    id: String,
    entry_id: String,
    out_dir: String,
) -> Result<String> {
    let guard = state.mounts.lock();
    let m = guard.get(&id).ok_or_else(|| AppError::NotFound("mount".into()))?;
    let p = ventries::extract_entry(m, &entry_id, &PathBuf::from(out_dir))?;
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_entry(state: State<'_, AppState>, id: String, entry_id: String) -> Result<()> {
    let mut guard = state.mounts.lock();
    let m = guard.get_mut(&id).ok_or_else(|| AppError::NotFound("mount".into()))?;
    ventries::delete_entry(m, &entry_id)
}

#[tauri::command]
pub async fn encrypt_path(path: String, password: String, kdf_mode: KdfMode) -> Result<String> {
    let p = PathBuf::from(path);
    let out = tokio::task::spawn_blocking(move || files_mod::encrypt_file(&p, password.as_bytes(), kdf_mode))
        .await
        .map_err(|e| AppError::Other(e.to_string()))??;
    Ok(out.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn decrypt_path(path: String, password: String, out_dir: String) -> Result<String> {
    let p = PathBuf::from(path);
    let o = PathBuf::from(out_dir);
    let out = tokio::task::spawn_blocking(move || files_mod::decrypt_file(&p, password.as_bytes(), &o))
        .await
        .map_err(|e| AppError::Other(e.to_string()))??;
    Ok(out.to_string_lossy().to_string())
}

#[tauri::command]
pub fn password_strength(password: String) -> PasswordReport {
    let len = password.chars().count();
    let lower = password.chars().any(|c| c.is_ascii_lowercase());
    let upper = password.chars().any(|c| c.is_ascii_uppercase());
    let digit = password.chars().any(|c| c.is_ascii_digit());
    let symbol = password.chars().any(|c| !c.is_ascii_alphanumeric());
    let mut pool = 0u32;
    if lower { pool += 26; }
    if upper { pool += 26; }
    if digit { pool += 10; }
    if symbol { pool += 33; }
    if pool == 0 { pool = 1; }
    let entropy = (len as f32) * (pool as f32).log2();
    let (score, label) = match entropy as u32 {
        0..=39 => (1, "weak"),
        40..=59 => (2, "fair"),
        60..=89 => (3, "strong"),
        90..=119 => (4, "very strong"),
        _ => (5, "excellent"),
    };
    let mut s = Vec::new();
    if !upper { s.push("add uppercase letters"); }
    if !digit { s.push("add digits"); }
    if !symbol { s.push("add symbols"); }
    if len < 16 { s.push("use at least 16 characters"); }
    PasswordReport { score, entropy_bits: entropy, label, suggestions: s }
}

#[tauri::command]
pub fn generate_passphrase(words: u8) -> String {
    const WORDS: &[&str] = &[
        "alpha","bravo","cobalt","delta","ember","forge","glacier","harbor","ivory","jade",
        "krypton","lumen","mosaic","nebula","onyx","pulse","quartz","raven","silver","tango",
        "umbra","vector","willow","xenon","yarrow","zephyr","atlas","beacon","cipher","drift",
        "echo","flint","gravity","helix","indigo","junction","kernel","lattice","monarch","nova",
        "orbit","prism","quasar","ridge","saber","talon","union","verve","whisper","azure",
    ];
    let mut rng = rand::thread_rng();
    let n = words.clamp(4, 12) as usize;
    let mut chosen: Vec<String> = (0..n).map(|_| (*WORDS.choose(&mut rng).unwrap()).to_string()).collect();
    let mut digits = [0u8; 4];
    rng.fill_bytes(&mut digits);
    let suffix: String = digits.iter().map(|b| char::from_digit((*b % 10) as u32, 10).unwrap()).collect();
    chosen.push(suffix);
    chosen.join("-")
}

#[tauri::command]
pub async fn benchmark_kdf(mode: KdfMode) -> Result<u64> {
    let mut salt = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut salt);
    let kdf = match mode {
        KdfMode::Fast => KdfParams::fast(salt),
        KdfMode::Strong => KdfParams::strong(salt),
        KdfMode::Paranoid => KdfParams::paranoid(salt),
    };
    let pw = b"benchmark-pass";
    let res = tokio::task::spawn_blocking(move || {
        let t = Instant::now();
        let _ = derive_master_key(pw, &kdf)?;
        Ok::<u64, AppError>(t.elapsed().as_millis() as u64)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))??;
    Ok(res)
}

#[derive(Serialize)]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub algorithms: Vec<&'static str>,
    pub kdf: &'static str,
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        name: "CryptVault",
        version: env!("CARGO_PKG_VERSION"),
        algorithms: vec!["AES-256-GCM", "XChaCha20-Poly1305 (cascade)"],
        kdf: "Argon2id (Fast/Strong/Paranoid presets)",
    }
}

fn strip_data(mut e: ventries::EntryInfo) -> ventries::EntryInfo {
    e.data_b64 = String::new();
    e
}
