use crate::crypto::kdf::KdfParams;
use serde::{Deserialize, Serialize};

pub const MAGIC: &[u8; 8] = b"CVAULT01";
pub const VERSION: u16 = 1;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum KdfMode {
    Fast,
    Strong,
    Paranoid,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VolumeMeta {
    pub id: String,
    pub label: String,
    pub created_at: u64,
    pub kdf_mode: KdfMode,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VolumeHeader {
    pub version: u16,
    pub kdf: KdfParams,
    pub meta_check: Vec<u8>,
    pub meta: VolumeMeta,
}
