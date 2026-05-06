use crate::error::{AppError, Result};
use crate::volume::mount::{persist, MountedVolume};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EntryInfo {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub created_at: u64,
    pub data_b64: String,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

pub fn add_files(m: &mut MountedVolume, files: &[PathBuf]) -> Result<Vec<EntryInfo>> {
    let mut added = Vec::new();
    for p in files {
        if p.is_file() {
            let bytes = fs::read(p)?;
            let info = EntryInfo {
                id: Uuid::new_v4().to_string(),
                name: p.file_name().map(|x| x.to_string_lossy().to_string()).unwrap_or_else(|| "file".into()),
                size: bytes.len() as u64,
                created_at: now(),
                data_b64: base64_encode(&bytes),
            };
            m.data.entries.push(info.clone());
            added.push(info);
        } else if p.is_dir() {
            for entry in walkdir::WalkDir::new(p).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    let rel = entry.path().strip_prefix(p).unwrap_or(entry.path());
                    let bytes = fs::read(entry.path())?;
                    let info = EntryInfo {
                        id: Uuid::new_v4().to_string(),
                        name: format!("{}/{}", p.file_name().map(|x| x.to_string_lossy().to_string()).unwrap_or_default(), rel.to_string_lossy()),
                        size: bytes.len() as u64,
                        created_at: now(),
                        data_b64: base64_encode(&bytes),
                    };
                    m.data.entries.push(info.clone());
                    added.push(info);
                }
            }
        }
    }
    m.dirty = true;
    persist(m)?;
    Ok(added)
}

pub fn list_entries(m: &MountedVolume) -> Vec<EntryInfo> {
    m.data
        .entries
        .iter()
        .map(|e| EntryInfo {
            id: e.id.clone(),
            name: e.name.clone(),
            size: e.size,
            created_at: e.created_at,
            data_b64: String::new(),
        })
        .collect()
}

pub fn extract_entry(m: &MountedVolume, entry_id: &str, out_dir: &Path) -> Result<PathBuf> {
    let e = m
        .data
        .entries
        .iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| AppError::NotFound("entry".into()))?;
    let bytes = base64_decode(&e.data_b64)?;
    let safe_name = sanitize(&e.name);
    let out = out_dir.join(safe_name);
    if let Some(parent) = out.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&out, bytes)?;
    Ok(out)
}

pub fn delete_entry(m: &mut MountedVolume, entry_id: &str) -> Result<()> {
    let before = m.data.entries.len();
    m.data.entries.retain(|e| e.id != entry_id);
    if m.data.entries.len() == before {
        return Err(AppError::NotFound("entry".into()));
    }
    m.dirty = true;
    persist(m)?;
    Ok(())
}

fn sanitize(name: &str) -> PathBuf {
    let mut p = PathBuf::new();
    for comp in name.split(['/', '\\']) {
        let trimmed = comp.trim();
        if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
            continue;
        }
        p.push(trimmed);
    }
    if p.as_os_str().is_empty() {
        p.push("untitled");
    }
    p
}

fn base64_encode(bytes: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::with_capacity((bytes.len() + 2) / 3 * 4);
    let mut i = 0;
    while i + 3 <= bytes.len() {
        let n = ((bytes[i] as u32) << 16) | ((bytes[i + 1] as u32) << 8) | bytes[i + 2] as u32;
        s.push(T[((n >> 18) & 63) as usize] as char);
        s.push(T[((n >> 12) & 63) as usize] as char);
        s.push(T[((n >> 6) & 63) as usize] as char);
        s.push(T[(n & 63) as usize] as char);
        i += 3;
    }
    let rem = bytes.len() - i;
    if rem == 1 {
        let n = (bytes[i] as u32) << 16;
        s.push(T[((n >> 18) & 63) as usize] as char);
        s.push(T[((n >> 12) & 63) as usize] as char);
        s.push('=');
        s.push('=');
    } else if rem == 2 {
        let n = ((bytes[i] as u32) << 16) | ((bytes[i + 1] as u32) << 8);
        s.push(T[((n >> 18) & 63) as usize] as char);
        s.push(T[((n >> 12) & 63) as usize] as char);
        s.push(T[((n >> 6) & 63) as usize] as char);
        s.push('=');
    }
    s
}

fn base64_decode(s: &str) -> Result<Vec<u8>> {
    let mut t = [255u8; 256];
    for (i, c) in b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".iter().enumerate() {
        t[*c as usize] = i as u8;
    }
    let bytes: Vec<u8> = s.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    let mut out = Vec::with_capacity(bytes.len() / 4 * 3);
    let mut i = 0;
    while i + 4 <= bytes.len() {
        let a = t[bytes[i] as usize];
        let b = t[bytes[i + 1] as usize];
        let c = bytes[i + 2];
        let d = bytes[i + 3];
        if a == 255 || b == 255 {
            return Err(AppError::Format("bad base64".into()));
        }
        let n = ((a as u32) << 18) | ((b as u32) << 12)
            | ((if c == b'=' { 0 } else { t[c as usize] }) as u32) << 6
            | (if d == b'=' { 0 } else { t[d as usize] }) as u32;
        out.push((n >> 16) as u8);
        if c != b'=' {
            out.push((n >> 8) as u8);
        }
        if d != b'=' {
            out.push(n as u8);
        }
        i += 4;
    }
    Ok(out)
}
