use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;

/// Minimal HTTP client against the local Argus relay.
pub struct Client {
    base: String,
    agent: ureq::Agent,
}

impl Client {
    pub fn new(base_url: String) -> Self {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(3))
            .timeout(Duration::from_secs(30))
            .user_agent(concat!("argus-cli/", env!("CARGO_PKG_VERSION")))
            .build();

        Self {
            base: base_url.trim_end_matches('/').to_string(),
            agent,
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base
    }

    fn url(&self, path: &str) -> String {
        if path.starts_with('/') {
            format!("{}{}", self.base, path)
        } else {
            format!("{}/{}", self.base, path)
        }
    }

    pub fn get_value(&self, path: &str) -> Result<Value> {
        let response = self
            .agent
            .get(&self.url(path))
            .call()
            .map_err(map_ureq_error)
            .with_context(|| format!("GET {}", path))?;
        response
            .into_json::<Value>()
            .with_context(|| format!("decoding JSON from GET {}", path))
    }

    pub fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let value = self.get_value(path)?;
        serde_json::from_value(value).context("deserializing relay response")
    }

    pub fn post_value<B: Serialize>(&self, path: &str, body: &B) -> Result<Value> {
        let response = self
            .agent
            .post(&self.url(path))
            .send_json(serde_json::to_value(body)?)
            .map_err(map_ureq_error)
            .with_context(|| format!("POST {}", path))?;
        read_body_value(response, path)
    }

    pub fn post_empty(&self, path: &str) -> Result<Value> {
        let response = self
            .agent
            .post(&self.url(path))
            .set("Content-Length", "0")
            .call()
            .map_err(map_ureq_error)
            .with_context(|| format!("POST {}", path))?;
        read_body_value(response, path)
    }

    pub fn patch_value<B: Serialize>(&self, path: &str, body: &B) -> Result<Value> {
        let response = self
            .agent
            .request("PATCH", &self.url(path))
            .send_json(serde_json::to_value(body)?)
            .map_err(map_ureq_error)
            .with_context(|| format!("PATCH {}", path))?;
        read_body_value(response, path)
    }

    pub fn delete(&self, path: &str) -> Result<Value> {
        let response = self
            .agent
            .delete(&self.url(path))
            .call()
            .map_err(map_ureq_error)
            .with_context(|| format!("DELETE {}", path))?;
        read_body_value(response, path)
    }
}

fn read_body_value(response: ureq::Response, path: &str) -> Result<Value> {
    let text = response
        .into_string()
        .with_context(|| format!("reading response body from {}", path))?;
    if text.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str::<Value>(&text)
        .with_context(|| format!("decoding JSON from {}: {}", path, text))
}

fn map_ureq_error(err: ureq::Error) -> anyhow::Error {
    match err {
        ureq::Error::Status(code, response) => {
            let message = response
                .into_string()
                .unwrap_or_else(|_| format!("HTTP {}", code));
            // Relay error bodies are usually `{"error": "..."}` — surface the
            // inner message when we can parse it so CLI output isn't noisy.
            if let Ok(value) = serde_json::from_str::<Value>(&message) {
                if let Some(inner) = value.get("error").and_then(Value::as_str) {
                    return anyhow!("relay error ({}): {}", code, inner);
                }
            }
            anyhow!("relay error ({}): {}", code, message.trim())
        }
        ureq::Error::Transport(transport) => {
            anyhow!(
                "could not reach Argus relay: {}. Is the relay running? (`npm run relay:dev`)",
                transport
            )
        }
    }
}
