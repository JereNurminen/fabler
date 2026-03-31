use std::path::Path;

pub const CURRENT_FORMAT_VERSION: u32 = 1;

pub fn migrate_project(_dir: &Path, from_version: u32) -> Result<(), String> {
    if from_version > CURRENT_FORMAT_VERSION {
        return Err(format!(
            "Project format version {} is newer than supported version {}",
            from_version, CURRENT_FORMAT_VERSION
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn current_version_is_noop() {
        let dir = PathBuf::from("/tmp");
        let result = migrate_project(&dir, CURRENT_FORMAT_VERSION);
        assert!(result.is_ok());
    }

    #[test]
    fn future_version_returns_error() {
        let dir = PathBuf::from("/tmp");
        let result = migrate_project(&dir, CURRENT_FORMAT_VERSION + 1);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(msg.contains("newer than supported"));
    }
}
