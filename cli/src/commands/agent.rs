use anyhow::{anyhow, Result};
use clap::Subcommand;
use serde_json::{json, Value};

use crate::client::Client;
use crate::format::{cell_from_value, Output};

#[derive(Subcommand, Debug)]
pub enum AgentCommand {
    /// Show the currently configured agent.
    Show,
    /// Configure (or overwrite) the agent.
    Set {
        /// Human-readable name, e.g. "Claude Code".
        name: String,
        /// Command Argus should spawn (prompt is appended as final arg).
        command: String,
    },
    /// Remove the configured agent.
    Remove,
    /// List agent CLIs detected on this machine.
    Detect,
    /// Run the agent with a trivial prompt to verify it works.
    Test,
    /// Run the full validation suite (agent + skill + CLI).
    Validate,
}

pub fn run(client: &Client, output: &Output, cmd: AgentCommand) -> Result<()> {
    match cmd {
        AgentCommand::Show => show(client, output),
        AgentCommand::Set { name, command } => set(client, output, name, command),
        AgentCommand::Remove => remove(client, output),
        AgentCommand::Detect => detect(client, output),
        AgentCommand::Test => test(client, output),
        AgentCommand::Validate => validate(client, output),
    }
}

fn show(client: &Client, output: &Output) -> Result<()> {
    let value: Value = client.get_value("/api/agent")?;

    if output.is_json() {
        output.emit_value(&value)?;
        return Ok(());
    }

    if value.is_null() {
        output.info("No agent configured. Use `argus agent set <name> <command>`.");
        return Ok(());
    }

    let name = value.get("name").and_then(Value::as_str).unwrap_or("—");
    let command = value.get("command").and_then(Value::as_str).unwrap_or("—");
    let status = value.get("status").and_then(Value::as_str).unwrap_or("—");
    let last_used = value
        .get("lastUsedAt")
        .and_then(Value::as_str)
        .unwrap_or("never");

    output.info(&format!("name:       {}", name));
    output.info(&format!("command:    {}", command));
    output.info(&format!("status:     {}", status));
    output.info(&format!("last used:  {}", last_used));
    Ok(())
}

fn set(client: &Client, output: &Output, name: String, command: String) -> Result<()> {
    let body = json!({ "name": name, "command": command });
    let value: Value = client.post_value("/api/agent", &body)?;

    if output.is_json() {
        output.emit_value(&value)?;
    } else {
        output.success(&format!("agent saved: {}", name));
    }
    Ok(())
}

fn remove(client: &Client, output: &Output) -> Result<()> {
    client.delete("/api/agent")?;
    if !output.is_json() {
        output.success("agent removed");
    } else {
        output.emit(&json!({ "ok": true }))?;
    }
    Ok(())
}

fn detect(client: &Client, output: &Output) -> Result<()> {
    let value: Value = client.get_value("/api/agent/detect")?;

    if output.is_json() {
        output.emit_value(&value)?;
        return Ok(());
    }

    let rows: Vec<Vec<String>> = value
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|item| {
                    vec![
                        cell_from_value(item.get("name").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("command").unwrap_or(&Value::Null)),
                        if item
                            .get("detected")
                            .and_then(Value::as_bool)
                            .unwrap_or(false)
                        {
                            "yes".to_string()
                        } else {
                            "no".to_string()
                        },
                    ]
                })
                .collect()
        })
        .unwrap_or_default();

    output.table(&["NAME", "COMMAND", "DETECTED"], rows, &value);
    Ok(())
}

fn test(client: &Client, output: &Output) -> Result<()> {
    let value: Value = client.post_empty("/api/agent/test")?;

    if output.is_json() {
        output.emit_value(&value)?;
        return Ok(());
    }

    let exit_code = value
        .get("exitCode")
        .and_then(Value::as_i64)
        .map(|n| n.to_string())
        .unwrap_or_else(|| "null".to_string());
    let stdout = value.get("stdout").and_then(Value::as_str).unwrap_or("");
    let stderr = value.get("stderr").and_then(Value::as_str).unwrap_or("");

    output.info(&format!("exit code: {}", exit_code));
    if !stdout.is_empty() {
        output.info("stdout:");
        output.info(stdout.trim_end());
    }
    if !stderr.is_empty() {
        output.warn("stderr:");
        output.warn(stderr.trim_end());
    }

    if value.get("exitCode").and_then(Value::as_i64) != Some(0) {
        return Err(anyhow!("agent test failed"));
    }
    Ok(())
}

fn validate(client: &Client, output: &Output) -> Result<()> {
    let value: Value = client.post_empty("/api/agent/validate")?;

    if output.is_json() {
        output.emit_value(&value)?;
        return Ok(());
    }

    let agent_ok = value
        .pointer("/agent/ok")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let skill_ok = value
        .pointer("/skill/ok")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let cli_ok = value
        .pointer("/cli/ok")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    output.info(&format!("agent CLI:    {}", mark(agent_ok)));
    output.info(&format!("argus skill:  {}", mark(skill_ok)));
    output.info(&format!("argus CLI:    {}", mark(cli_ok)));

    if let Some(path) = value.pointer("/cli/path").and_then(Value::as_str) {
        output.info(&format!("  path:    {}", path));
    }
    if let Some(version) = value.pointer("/cli/version").and_then(Value::as_str) {
        output.info(&format!("  version: {}", version));
    }
    Ok(())
}

fn mark(ok: bool) -> &'static str {
    if ok {
        "pass"
    } else {
        "fail"
    }
}
