use anyhow::Result;
use clap::Subcommand;
use serde_json::{json, Value};

use crate::client::Client;
use crate::format::{cell_from_value, truncate, Output};

#[derive(Subcommand, Debug)]
pub enum TriggersCommand {
    /// List all triggers.
    List,
    /// Show a trigger with its recent executions.
    Show { id: String },
    /// Enable a trigger.
    Enable { id: String },
    /// Disable a trigger.
    Disable { id: String },
    /// Delete a trigger and its execution history.
    Delete { id: String },
}

pub fn run(client: &Client, output: &Output, cmd: TriggersCommand) -> Result<()> {
    match cmd {
        TriggersCommand::List => list(client, output),
        TriggersCommand::Show { id } => show(client, output, &id),
        TriggersCommand::Enable { id } => set_enabled(client, output, &id, true),
        TriggersCommand::Disable { id } => set_enabled(client, output, &id, false),
        TriggersCommand::Delete { id } => delete(client, output, &id),
    }
}

fn list(client: &Client, output: &Output) -> Result<()> {
    let value: Value = client.get_value("/api/triggers")?;

    let rows: Vec<Vec<String>> = value
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|item| {
                    vec![
                        cell_from_value(item.get("id").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("name").unwrap_or(&Value::Null)),
                        format!(
                            "{}/{}",
                            item.get("provider").and_then(Value::as_str).unwrap_or("?"),
                            item.get("eventType").and_then(Value::as_str).unwrap_or("?"),
                        ),
                        if item
                            .get("enabled")
                            .and_then(Value::as_bool)
                            .unwrap_or(false)
                        {
                            "on".to_string()
                        } else {
                            "off".to_string()
                        },
                        cell_from_value(item.get("executionCount").unwrap_or(&Value::Null)),
                    ]
                })
                .collect()
        })
        .unwrap_or_default();

    output.table(&["ID", "NAME", "EVENT", "STATE", "RUNS"], rows, &value);
    Ok(())
}

fn show(client: &Client, output: &Output, id: &str) -> Result<()> {
    let value: Value = client.get_value(&format!("/api/triggers/{}/executions", id))?;

    if output.is_json() {
        output.emit_value(&value)?;
        return Ok(());
    }

    if let Some(trigger) = value.get("trigger") {
        let name = trigger.get("name").and_then(Value::as_str).unwrap_or("—");
        let event = format!(
            "{}/{}",
            trigger
                .get("provider")
                .and_then(Value::as_str)
                .unwrap_or("?"),
            trigger
                .get("eventType")
                .and_then(Value::as_str)
                .unwrap_or("?"),
        );
        let enabled = trigger
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        output.info(&format!("name:     {}", name));
        output.info(&format!("event:    {}", event));
        output.info(&format!("enabled:  {}", enabled));
        if let Some(prompt) = trigger.get("actionPrompt").and_then(Value::as_str) {
            output.info(&format!("prompt:   {}", truncate(prompt, 120)));
        }
    }

    let executions = value.get("executions").and_then(Value::as_array);
    let rows: Vec<Vec<String>> = executions
        .map(|arr| {
            arr.iter()
                .map(|item| {
                    vec![
                        cell_from_value(item.get("id").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("status").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("matchedAt").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("eventType").unwrap_or(&Value::Null)),
                    ]
                })
                .collect()
        })
        .unwrap_or_default();

    output.info("executions:");
    output.table(
        &["ID", "STATUS", "MATCHED AT", "EVENT"],
        rows,
        &Value::Array(executions.cloned().unwrap_or_default()),
    );
    Ok(())
}

fn set_enabled(client: &Client, output: &Output, id: &str, enabled: bool) -> Result<()> {
    let body = json!({ "enabled": enabled });
    let value: Value = client.patch_value(&format!("/api/triggers/{}", id), &body)?;
    if output.is_json() {
        output.emit_value(&value)?;
    } else {
        output.success(&format!(
            "trigger {} {}",
            id,
            if enabled { "enabled" } else { "disabled" }
        ));
    }
    Ok(())
}

fn delete(client: &Client, output: &Output, id: &str) -> Result<()> {
    client.delete(&format!("/api/triggers/{}", id))?;
    if output.is_json() {
        output.emit(&json!({ "ok": true, "id": id }))?;
    } else {
        output.success(&format!("trigger {} deleted", id));
    }
    Ok(())
}
