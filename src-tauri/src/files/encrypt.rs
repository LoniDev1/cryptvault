use crate::crypto::cascade::{cascade_decrypt, cascade_encrypt, CascadeKey};
use crate::crypto::kdf::{derive_master_key, KdfParams};
use crate::error::{AppError, Result};
use crate::volume::header::KdfMode;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const FILE_MAGIC: &[u8; 8] = b"CVFILE01";

#[derive(Serialize, Deserialize)]
struct FileHeader {
    kdf: KdfParams,
    original_name: String,
    is_dir: bool,
    kdf_mode: KdfMode,
}

pub fn encrypt_file(path: &Path, password: &[u8], kdf_mode: KdfMode) -> Result<PathBuf> {
    let mut salt = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut salt);
    let kdf = match kdf_mode {
        KdfMode::Fast => KdfParams::fast(salt.clone()),
        KdfMode::Strong => KdfParams::strong(salt.clone()),
        KdfMode::Paranoid => KdfParams::paranoid(salt.clone()),
    };
    let master = derive_master_key(password, &kdf)?;
    let cascade = CascadeKey::from_master(&master, b"file-data");

    let original_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());

    let (payload, is_dir) = if path.is_dir() {
        (pack_dir(path)?, true)
    } else {
        (fs::read(path)?, false)
    };

    let header = FileHeader {
        kdf,
        original_name: original_name.clone(),
        is_dir,
        kdf_mode,
    };
    let header_bytes = serde_json::to_vec(&header)?;

    let aad = b"cryptvault/v1/file";
    let encrypted = cascade_encrypt(&cascade, aad, &payload)?;

    let out_path = path.with_extension(format!(
        "{}.cv",
        path.extension().and_then(|s| s.to_str()).unwrap_or("")
    ));
    let mut f = File::create(&out_path)?;
    f.write_all(FILE_MAGIC)?;
    f.write_all(&(header_bytes.len() as u32).to_le_bytes())?;
    f.write_all(&header_bytes)?;
    f.write_all(&(encrypted.len() as u64).to_le_bytes())?;
    f.write_all(&encrypted)?;
    Ok(out_path)
}

pub fn decrypt_file(path: &Path, password: &[u8], out_dir: &Path) -> Result<PathBuf> {
    let mut f = File::open(path)?;
    let mut magic = [0u8; 8];
    f.read_exact(&mut magic)?;
    if &magic != FILE_MAGIC {
        return Err(AppError::Format("not a cryptvault file".into()));
    }
    let mut hl = [0u8; 4];
    f.read_exact(&mut hl)?;
    let hlen = u32::from_le_bytes(hl) as usize;
    let mut hb = vec![0u8; hlen];
    f.read_exact(&mut hb)?;
    let header: FileHeader = serde_json::from_slice(&hb)?;
    let mut bl = [0u8; 8];
    f.read_exact(&mut bl)?;
    let blen = u64::from_le_bytes(bl) as usize;
    let mut body = vec![0u8; blen];
    f.read_exact(&mut body)?;

    let master = derive_master_key(password, &header.kdf)?;
    let cascade = CascadeKey::from_master(&master, b"file-data");
    let plain = cascade_decrypt(&cascade, b"cryptvault/v1/file", &body)?;

    fs::create_dir_all(out_dir)?;
    let dest = out_dir.join(&header.original_name);
    if header.is_dir {
        unpack_dir(&dest, &plain)?;
    } else {
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&dest, plain)?;
    }
    Ok(dest)
}

#[derive(Serialize, Deserialize)]
struct PackedEntry {
    name: String,
    data: Vec<u8>,
}

fn pack_dir(dir: &Path) -> Result<Vec<u8>> {
    let mut entries: Vec<PackedEntry> = Vec::new();
    for entry in walkdir::WalkDir::new(dir)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            let rel = entry.path().strip_prefix(dir).unwrap_or(entry.path());
            let data = fs::read(entry.path())?;
            entries.push(PackedEntry {
                name: rel.to_string_lossy().to_string(),
                data,
            });
        }
    }
    Ok(serde_json::to_vec(&entries)?)
}

fn unpack_dir(target: &Path, blob: &[u8]) -> Result<()> {
    fs::create_dir_all(target)?;
    let entries: Vec<PackedEntry> = serde_json::from_slice(blob)?;
    for e in entries {
        let safe: PathBuf = e
            .name
            .split(['/', '\\'])
            .filter(|c| !matches!(*c, "" | "." | ".."))
            .collect();
        let dest = target.join(safe);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(dest, e.data)?;
    }
    Ok(())
}
