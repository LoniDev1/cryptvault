use crate::crypto::cascade::{cascade_encrypt, CascadeKey};
use crate::crypto::kdf::{derive_master_key, KdfParams};
use crate::error::{AppError, Result};
use crate::volume::header::{KdfMode, VolumeHeader, VolumeMeta, MAGIC, VERSION};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct VolumeData {
    pub entries: Vec<crate::volume::entries::EntryInfo>,
}

pub fn create_volume(
    path: &Path,
    label: &str,
    password: &[u8],
    kdf_mode: KdfMode,
    size_hint_mb: u64,
) -> Result<()> {
    if path.exists() {
        return Err(AppError::Other("file already exists".into()));
    }
    let mut salt = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut salt);

    let kdf = match kdf_mode {
        KdfMode::Fast => KdfParams::fast(salt.clone()),
        KdfMode::Strong => KdfParams::strong(salt.clone()),
        KdfMode::Paranoid => KdfParams::paranoid(salt.clone()),
    };

    let master = derive_master_key(password, &kdf)?;
    let cascade = CascadeKey::from_master(&master, b"volume-meta");

    let meta = VolumeMeta {
        id: Uuid::new_v4().to_string(),
        label: label.to_string(),
        created_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
        kdf_mode,
    };

    let check_token = b"CRYPTVAULT_OK";
    let meta_check = cascade_encrypt(&cascade, meta.id.as_bytes(), check_token)?;

    let header = VolumeHeader {
        version: VERSION,
        kdf,
        meta_check,
        meta: meta.clone(),
    };
    let header_bytes = serde_json::to_vec(&header)?;

    let data_cascade = CascadeKey::from_master(&master, b"volume-data");
    let empty = VolumeData::default();
    let body = serde_json::to_vec(&empty)?;
    let encrypted_body = cascade_encrypt(&data_cascade, meta.id.as_bytes(), &body)?;

    let mut f = File::create(path)?;
    f.write_all(MAGIC)?;
    f.write_all(&VERSION.to_le_bytes())?;
    f.write_all(&(header_bytes.len() as u32).to_le_bytes())?;
    f.write_all(&header_bytes)?;
    f.write_all(&(encrypted_body.len() as u64).to_le_bytes())?;
    f.write_all(&encrypted_body)?;

    if size_hint_mb > 0 {
        let target = size_hint_mb * 1024 * 1024;
        let pos = f.metadata()?.len();
        if pos < target {
            let mut pad = vec![0u8; 64 * 1024];
            rand::thread_rng().fill_bytes(&mut pad);
            let mut remaining = target - pos;
            while remaining > 0 {
                let n = remaining.min(pad.len() as u64) as usize;
                rand::thread_rng().fill_bytes(&mut pad[..n]);
                f.write_all(&pad[..n])?;
                remaining -= n as u64;
            }
        }
    }
    Ok(())
}

pub fn read_header(path: &Path) -> Result<(VolumeHeader, u64)> {
    let mut f = File::open(path)?;
    let mut magic = [0u8; 8];
    f.read_exact(&mut magic)?;
    if &magic != MAGIC {
        return Err(AppError::Format("bad magic".into()));
    }
    let mut ver = [0u8; 2];
    f.read_exact(&mut ver)?;
    let version = u16::from_le_bytes(ver);
    if version != VERSION {
        return Err(AppError::Format(format!("unsupported version {version}")));
    }
    let mut hl = [0u8; 4];
    f.read_exact(&mut hl)?;
    let header_len = u32::from_le_bytes(hl) as usize;
    let mut hb = vec![0u8; header_len];
    f.read_exact(&mut hb)?;
    let header: VolumeHeader = serde_json::from_slice(&hb)?;
    let body_offset = 8 + 2 + 4 + header_len as u64;
    Ok((header, body_offset))
}
