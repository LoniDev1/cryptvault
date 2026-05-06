use crate::volume::mount::MountedVolume;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;

pub struct AppState {
    pub mounts: Arc<Mutex<HashMap<String, MountedVolume>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self { mounts: Arc::new(Mutex::new(HashMap::new())) }
    }
}
