use crate::crypto::cipher::{aead_decrypt, aead_encrypt, AeadAlgorithm};
use crate::error::Result;
use hkdf::Hkdf;
use rand::RngCore;
use sha2::Sha512;
use zeroize::Zeroize;

pub struct CascadeKey {
    pub k_aes: [u8; 32],
    pub k_xch: [u8; 32],
}

impl Drop for CascadeKey {
    fn drop(&mut self) {
        self.k_aes.zeroize();
        self.k_xch.zeroize();
    }
}

impl CascadeKey {
    pub fn from_master(master: &[u8], context: &[u8]) -> Self {
        let hk = Hkdf::<Sha512>::new(Some(b"cryptvault/v1/cascade"), master);
        let mut k_aes = [0u8; 32];
        let mut k_xch = [0u8; 32];
        let mut info_aes = b"aes256gcm/".to_vec();
        info_aes.extend_from_slice(context);
        let mut info_xch = b"xchacha20poly1305/".to_vec();
        info_xch.extend_from_slice(context);
        hk.expand(&info_aes, &mut k_aes).unwrap();
        hk.expand(&info_xch, &mut k_xch).unwrap();
        Self { k_aes, k_xch }
    }
}

pub fn cascade_encrypt(key: &CascadeKey, aad: &[u8], plaintext: &[u8]) -> Result<Vec<u8>> {
    let mut rng = rand::thread_rng();
    let mut n_aes = [0u8; 12];
    let mut n_xch = [0u8; 24];
    rng.fill_bytes(&mut n_aes);
    rng.fill_bytes(&mut n_xch);

    let inner = aead_encrypt(AeadAlgorithm::Aes256Gcm, &key.k_aes, &n_aes, aad, plaintext)?;
    let mut payload = Vec::with_capacity(12 + inner.len());
    payload.extend_from_slice(&n_aes);
    payload.extend_from_slice(&inner);
    let outer = aead_encrypt(AeadAlgorithm::XChaCha20Poly1305, &key.k_xch, &n_xch, aad, &payload)?;

    let mut out = Vec::with_capacity(24 + outer.len());
    out.extend_from_slice(&n_xch);
    out.extend_from_slice(&outer);
    Ok(out)
}

pub fn cascade_decrypt(key: &CascadeKey, aad: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>> {
    if ciphertext.len() < 24 + 12 {
        return Err(crate::error::AppError::Format("ciphertext too short".into()));
    }
    let (n_xch, rest) = ciphertext.split_at(24);
    let outer = aead_decrypt(AeadAlgorithm::XChaCha20Poly1305, &key.k_xch, n_xch, aad, rest)?;
    let (n_aes, inner) = outer.split_at(12);
    let plaintext = aead_decrypt(AeadAlgorithm::Aes256Gcm, &key.k_aes, n_aes, aad, inner)?;
    Ok(plaintext)
}
