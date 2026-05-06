use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("kdf: {0}")]
    Kdf(String),
    #[error("crypto: {0}")]
    Crypto(String),
    #[error("invalid format: {0}")]
    Format(String),
    #[error("invalid password")]
    InvalidPassword,
    #[error("not found: {0}")]
    NotFound(String),
    #[error("already mounted")]
    AlreadyMounted,
    #[error("other: {0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> std::result::Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
