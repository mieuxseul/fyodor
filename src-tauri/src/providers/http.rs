use std::sync::OnceLock;
use std::time::Duration;

use reqwest::Client;

const USER_AGENT: &str = "Fyodor/0.1.0 (desktop; personal manga library)";

/// Process-wide HTTP client so TLS / connection pools are reused.
pub fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .user_agent(USER_AGENT)
            .pool_max_idle_per_host(16)
            .timeout(Duration::from_secs(20))
            .connect_timeout(Duration::from_secs(8))
            .build()
            .expect("failed to build Fyodor HTTP client")
    })
}
