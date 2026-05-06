use crate::error::{AppError, Result};
use argon2::{Algorithm, Argon2, Params, Version};
use serde::{Deserialize, Serialize};

pub const MASTER_KEY_LEN: usize = 64;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KdfParams {
    pub m_cost_kib: u32,
    pub t_cost: u32,
    pub p_cost: u32,
    pub salt: Vec<u8>,
}

impl KdfParams {
    pub fn strong(salt: Vec<u8>) -> Self {
        Self {
            m_cost_kib: 256 * 1024,
            t_cost: 8,
            p_cost: 1,
            salt,
        }
    }
    pub fn paranoid(salt: Vec<u8>) -> Self {
        Self {
            m_cost_kib: 1024 * 1024,
            t_cost: 12,
            p_cost: 1,
            salt,
        }
    }
    pub fn fast(salt: Vec<u8>) -> Self {
        Self {
            m_cost_kib: 64 * 1024,
            t_cost: 3,
            p_cost: 1,
            salt,
        }
    }
}

pub fn derive_master_key(password: &[u8], params: &KdfParams) -> Result<[u8; MASTER_KEY_LEN]> {
    let p = Params::new(
        params.m_cost_kib,
        params.t_cost,
        params.p_cost,
        Some(MASTER_KEY_LEN),
    )
    .map_err(|e| AppError::Kdf(e.to_string()))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, p);
    let mut out = [0u8; MASTER_KEY_LEN];
    argon
        .hash_password_into(password, &params.salt, &mut out)
        .map_err(|e| AppError::Kdf(e.to_string()))?;
    Ok(out)
}
