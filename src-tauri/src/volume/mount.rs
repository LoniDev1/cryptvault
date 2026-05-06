use crate::crypto::cascade::{cascade_decrypt, cascade_encrypt, CascadeKey};
use crate::crypto::kdf::derive_master_key;
use crate::error::{AppError, Result};
use crate::volume::create::{read_header, VolumeData};
use crate::volume::header::{VolumeHeader, MAGIC, VERSION};
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

pub struct MountedVolume {
    pub path: PathBuf,
    pub header: VolumeHeader,
    pub master: [u8; 64],
    pub data: VolumeData,
    pub dirty: bool,
}

pub fn mount(path: &Path, password: &[u8]) -> Result<MountedVolume> {
    let (header, body_offset) = read_header(path)?;
    let master = derive_master_key(password, &header.kdf)?;

    let meta_cascade = CascadeKey::from_master(&master, b"volume-meta");
    let token = cascade_decrypt(&meta_cascade, header.meta.id.as_bytes(), &header.meta_check)?;
    if token != b"CRYPTVAULT_OK" {
        return Err(AppError::InvalidPassword);
    }

    let mut f = File::open(path)?;
    f.seek(SeekFrom::Start(body_offset))?;
    let mut bl = [0u8; 8];
    f.read_exact(&mut bl)?;
    let body_len = u64::from_le_bytes(bl) as usize;
    let mut body = vec![0u8; body_len];
    f.read_exact(&mut body)?;

    let data_cascade = CascadeKey::from_master(&master, b"volume-data");
    let plain = cascade_decrypt(&data_cascade, header.meta.id.as_bytes(), &body)?;
    let data: VolumeData = serde_json::from_slice(&plain)?;

    Ok(MountedVolume {
        path: path.to_path_buf(),
        header,
        master,
        data,
        dirty: false,
    })
}

pub fn persist(m: &mut MountedVolume) -> Result<()> {
    let data_cascade = CascadeKey::from_master(&m.master, b"volume-data");
    let body = serde_json::to_vec(&m.data)?;
    let encrypted_body = cascade_encrypt(&data_cascade, m.header.meta.id.as_bytes(), &body)?;
    let header_bytes = serde_json::to_vec(&m.header)?;

    let tmp = m.path.with_extension("cv.tmp");
    {
        let mut f = OpenOptions::new().write(true).create(true).truncate(true).open(&tmp)?;
        f.write_all(MAGIC)?;
        f.write_all(&VERSION.to_le_bytes())?;
        f.write_all(&(header_bytes.len() as u32).to_le_bytes())?;
        f.write_all(&header_bytes)?;
        f.write_all(&(encrypted_body.len() as u64).to_le_bytes())?;
        f.write_all(&encrypted_body)?;
        f.sync_all()?;
    }
    std::fs::rename(&tmp, &m.path)?;
    m.dirty = false;
    Ok(())
}

pub fn unmount(m: &mut MountedVolume) -> Result<()> {
    if m.dirty {
        persist(m)?;
    }
    Ok(())
}
