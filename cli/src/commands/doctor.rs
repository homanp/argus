use anyhow::Result;
use serde::Deserialize;
use serde_json::json;

use crate::client::Client;
use crate::format::Output;

#[derive(Debug, Deserialize)]
struct Health {
    ok: bool,
    #[serde(rename = "relayBaseUrl")]
    relay_base_url: Option<String>,
}

pub fn run(client: &Client, output: &Output) -> Result<()> {
    let health: Health = client.get("/health")?;

    if output.is_json() {
        output.emit(&json!({
            "relayUrl": client.base_url(),
            "ok": health.ok,
            "relayBaseUrl": health.relay_base_url,
            "cliVersion": env!("CARGO_PKG_VERSION"),
        }))?;
        return Ok(());
    }

    output.success(&format!("relay reachable at {}", client.base_url()));
    if let Some(base) = health.relay_base_url {
        output.info(&format!("relay advertises base URL: {}", base));
    }
    output.info(&format!("cli version: v{}", env!("CARGO_PKG_VERSION")));
    Ok(())
}
