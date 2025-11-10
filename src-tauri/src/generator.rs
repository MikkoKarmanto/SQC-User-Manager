use rand::Rng;

/// Settings for PIN generation
#[derive(Debug, Clone)]
pub struct PinSettings {
    pub length: usize,
}

impl Default for PinSettings {
    fn default() -> Self {
        Self { length: 4 }
    }
}

/// Settings for Short ID (One Time Password) generation
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ShortIdSettings {
    pub length: usize,
    pub use_uppercase: bool,
    pub use_lowercase: bool,
    pub use_numbers: bool,
    pub use_special: bool,
}

impl Default for ShortIdSettings {
    fn default() -> Self {
        Self {
            length: 6,
            use_uppercase: true,
            use_lowercase: true,
            use_numbers: true,
            use_special: false,
        }
    }
}

/// Generate a random numeric PIN
pub fn generate_pin(settings: &PinSettings) -> String {
    let mut rng = rand::thread_rng();
    (0..settings.length)
        .map(|_| rng.gen_range(0..10).to_string())
        .collect()
}

/// Generate a random Short ID (One Time Password) with UTF-8 characters
#[allow(dead_code)]
pub fn generate_short_id(settings: &ShortIdSettings) -> String {
    let mut charset = String::new();

    if settings.use_uppercase {
        charset.push_str("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    }
    if settings.use_lowercase {
        charset.push_str("abcdefghijklmnopqrstuvwxyz");
    }
    if settings.use_numbers {
        charset.push_str("0123456789");
    }
    if settings.use_special {
        charset.push_str("!@#$%^&*-_+=");
    }

    // Fallback to numbers if no character set is selected
    if charset.is_empty() {
        charset.push_str("0123456789");
    }

    let chars: Vec<char> = charset.chars().collect();
    let mut rng = rand::thread_rng();

    (0..settings.length)
        .map(|_| chars[rng.gen_range(0..chars.len())])
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_pin() {
        let settings = PinSettings { length: 6 };
        let pin = generate_pin(&settings);
        assert_eq!(pin.len(), 6);
        assert!(pin.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_generate_short_id() {
        let settings = ShortIdSettings::default();
        let short_id = generate_short_id(&settings);
        assert_eq!(short_id.len(), 6);
    }

    #[test]
    fn test_generate_short_id_numbers_only() {
        let settings = ShortIdSettings {
            length: 8,
            use_uppercase: false,
            use_lowercase: false,
            use_numbers: true,
            use_special: false,
        };
        let short_id = generate_short_id(&settings);
        assert_eq!(short_id.len(), 8);
        assert!(short_id.chars().all(|c| c.is_ascii_digit()));
    }
}
