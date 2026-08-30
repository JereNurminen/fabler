use rand::RngExt;

/// Generate a 5-character lowercase hex ID.
pub fn generate_id() -> String {
    let mut rng = rand::rng();
    let value: u32 = rng.random_range(0..0x100000);
    format!("{value:05x}")
}

/// Generate an ID that doesn't collide with existing IDs.
pub fn generate_unique_id(existing: &[&str]) -> String {
    loop {
        let id = generate_id();
        if !existing.contains(&id.as_str()) {
            return id;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn id_is_5_chars() {
        let id = generate_id();
        assert_eq!(id.len(), 5);
    }

    #[test]
    fn id_is_lowercase_hex() {
        let id = generate_id();
        assert!(id
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_uppercase()));
    }

    #[test]
    fn unique_id_avoids_collisions() {
        let existing = vec!["00000", "00001"];
        let id = generate_unique_id(&existing);
        assert!(!existing.contains(&id.as_str()));
    }
}
