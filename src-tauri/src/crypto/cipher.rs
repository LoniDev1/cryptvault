use crate::error::{AppError, Result};
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce as AesNonce};
use chacha20poly1305::{Key as XKey, XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum AeadAlgorithm {
    Aes256Gcm,
    XChaCha20Poly1305,
}

impl AeadAlgorithm {
    pub fn nonce_len(&self) -> usize {
        match self {
            AeadAlgorithm::Aes256Gcm => 12,
            AeadAlgorithm::XChaCha20Poly1305 => 24,
        }
    }
    pub fn key_len(&self) -> usize {
        32
    }
}

pub fn aead_encrypt(
    alg: AeadAlgorithm,
    key: &[u8],
    nonce: &[u8],
    aad: &[u8],
    plaintext: &[u8],
) -> Result<Vec<u8>> {
    if key.len() != alg.key_len() || nonce.len() != alg.nonce_len() {
        return Err(AppError::Crypto("invalid key or nonce length".into()));
    }
    let payload = Payload {
        msg: plaintext,
        aad,
    };
    match alg {
        AeadAlgorithm::Aes256Gcm => {
            let cipher =
                Aes256Gcm::new_from_slice(key).map_err(|e| AppError::Crypto(e.to_string()))?;
            cipher
                .encrypt(AesNonce::from_slice(nonce), payload)
                .map_err(|e| AppError::Crypto(e.to_string()))
        }
        AeadAlgorithm::XChaCha20Poly1305 => {
            let cipher = XChaCha20Poly1305::new(XKey::from_slice(key));
            cipher
                .encrypt(XNonce::from_slice(nonce), payload)
                .map_err(|e| AppError::Crypto(e.to_string()))
        }
    }
}

pub fn aead_decrypt(
    alg: AeadAlgorithm,
    key: &[u8],
    nonce: &[u8],
    aad: &[u8],
    ciphertext: &[u8],
) -> Result<Vec<u8>> {
    if key.len() != alg.key_len() || nonce.len() != alg.nonce_len() {
        return Err(AppError::Crypto("invalid key or nonce length".into()));
    }
    let payload = Payload {
        msg: ciphertext,
        aad,
    };
    match alg {
        AeadAlgorithm::Aes256Gcm => {
            let cipher =
                Aes256Gcm::new_from_slice(key).map_err(|e| AppError::Crypto(e.to_string()))?;
            cipher
                .decrypt(AesNonce::from_slice(nonce), payload)
                .map_err(|_| AppError::InvalidPassword)
        }
        AeadAlgorithm::XChaCha20Poly1305 => {
            let cipher = XChaCha20Poly1305::new(XKey::from_slice(key));
            cipher
                .decrypt(XNonce::from_slice(nonce), payload)
                .map_err(|_| AppError::InvalidPassword)
        }
    }
}
