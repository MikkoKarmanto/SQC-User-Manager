use url::Url;

/// Common URL utilities for normalizing and validating URLs
pub struct UrlUtils;

impl UrlUtils {
    /// Normalize a tenant URL by ensuring it has a scheme and is properly formatted
    /// If no scheme is provided, defaults to https://
    pub fn normalize_tenant_url(input: &str) -> String {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            return String::new();
        }

        // If no scheme is provided, default to https
        let url_with_scheme = if trimmed.contains("://") {
            trimmed.to_string()
        } else {
            format!("https://{}", trimmed)
        };

        match Url::parse(&url_with_scheme) {
            Ok(parsed) => {
                let host = match parsed.host_str() {
                    Some(host) if !host.is_empty() => host,
                    _ => return trimmed.to_string(),
                };

                let mut authority = host.to_owned();
                if let Some(port) = parsed.port() {
                    authority.push(':');
                    authority.push_str(&port.to_string());
                }

                let path = match parsed.path() {
                    "/" => "",
                    other => other,
                };

                let mut normalized = format!("{}://{}{}", parsed.scheme(), authority, path);

                if normalized.ends_with('/') {
                    // Trim trailing slash for consistency
                    normalized.pop();
                }

                normalized
            }
            Err(_) => trimmed.to_string(),
        }
    }

    /// Build a base URL for API calls by ensuring the URL has a port
    /// If no port is specified, uses the default API port
    pub fn build_base_url(normalized_url: &str, default_port: u16) -> Result<String, url::ParseError> {
        let trimmed = normalized_url.trim();
        if trimmed.is_empty() {
            return Err(url::ParseError::EmptyHost);
        }

        let parsed = Url::parse(trimmed)?;

        let scheme = parsed.scheme();
        let host = parsed
            .host_str()
            .ok_or(url::ParseError::EmptyHost)?;
        let port = parsed.port().unwrap_or(default_port);

        let mut result = format!("{}://{}:{}", scheme, host, port);

        let path = parsed.path().trim_matches('/');
        if !path.is_empty() {
            result.push('/');
            result.push_str(path);
        }

        let result = result.trim_end_matches('/').to_string();

        // Validate the final URL
        Url::parse(&result)?;

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_tenant_url_with_scheme() {
        assert_eq!(
            UrlUtils::normalize_tenant_url("https://example.com"),
            "https://example.com"
        );
        assert_eq!(
            UrlUtils::normalize_tenant_url("http://example.com:8080/path"),
            "http://example.com:8080/path"
        );
    }

    #[test]
    fn test_normalize_tenant_url_without_scheme() {
        assert_eq!(
            UrlUtils::normalize_tenant_url("example.com"),
            "https://example.com"
        );
        assert_eq!(
            UrlUtils::normalize_tenant_url("example.com/path"),
            "https://example.com/path"
        );
    }

    #[test]
    fn test_normalize_tenant_url_empty() {
        assert_eq!(UrlUtils::normalize_tenant_url(""), "");
        assert_eq!(UrlUtils::normalize_tenant_url("   "), "");
    }

    #[test]
    fn test_build_base_url() {
        assert_eq!(
            UrlUtils::build_base_url("https://example.com", 7300).unwrap(),
            "https://example.com:7300"
        );
        assert_eq!(
            UrlUtils::build_base_url("https://example.com:8080", 7300).unwrap(),
            "https://example.com:8080"
        );
        assert_eq!(
            UrlUtils::build_base_url("https://example.com/path", 7300).unwrap(),
            "https://example.com:7300/path"
        );
    }
}