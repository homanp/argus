use anyhow::Result;
use clap::Subcommand;
use serde_json::{json, Value};

use crate::client::Client;
use crate::format::{cell_from_value, truncate, Output};

#[derive(Subcommand, Debug)]
pub enum MissionsCommand {
    /// List missions (awaiting decision first).
    List {
        /// Show all statuses, not just `awaiting_decision`.
        #[arg(long)]
        all: bool,
    },
    /// Show a mission's analysis, plan, and signals.
    Show { id: String },
    /// Approve a mission action (use `argus missions show <id>` to see keys).
    Decide {
        id: String,
        #[arg(value_name = "ACTION_KEY")]
        action_key: String,
    },
    /// Dismiss a mission without running any action.
    Dismiss { id: String },
    /// Trigger a mission-engine scan immediately.
    Scan,
}

pub fn run(client: &Client, output: &Output, cmd: MissionsCommand) -> Result<()> {
    match cmd {
        MissionsCommand::List { all } => list(client, output, all),
        MissionsCommand::Show { id } => show(client, output, &id),
        MissionsCommand::Decide { id, action_key } => decide(client, output, &id, &action_key),
        MissionsCommand::Dismiss { id } => dismiss(client, output, &id),
        MissionsCommand::Scan => scan(client, output),
    }
}

fn list(client: &Client, output: &Output, all: bool) -> Result<()> {
    let value: Value = client.get_value("/api/missions")?;

    let arr: Vec<Value> = value
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|item| {
            all || item
                .get("status")
                .and_then(Value::as_str)
                .map(|s| s == "awaiting_decision")
                .unwrap_or(false)
        })
        .collect();

    let rows: Vec<Vec<String>> = arr
        .iter()
        .map(|item| {
            vec![
                cell_from_value(item.get("id").unwrap_or(&Value::Null)),
                cell_from_value(item.get("status").unwrap_or(&Value::Null)),
                truncate(item.get("title").and_then(Value::as_str).unwrap_or("—"), 60),
                cell_from_value(item.get("priority").unwrap_or(&Value::Null)),
                cell_from_value(item.get("confidence").unwrap_or(&Value::Null)),
            ]
        })
        .collect();

    output.table(
        &["ID", "STATUS", "TITLE", "PRIORITY", "CONFIDENCE"],
        rows,
        &Value::Array(arr),
    );
    Ok(())
}

fn show(client: &Client, output: &Output, id: &str) -> Result<()> {
    let value: Value = client.get_value(&format!("/api/missions/{}", id))?;

    if output.is_json() {
        output.emit_value(&value)?;
        return Ok(());
    }

    if let Some(mission) = value.get("mission") {
        let title = mission.get("title").and_then(Value::as_str).unwrap_or("—");
        let status = mission.get("status").and_then(Value::as_str).unwrap_or("—");
        let confidence = mission
            .get("confidence")
            .and_then(Value::as_f64)
            .map(|n| format!("{:.2}", n))
            .unwrap_or_else(|| "—".to_string());
        output.info(&format!("title:       {}", title));
        output.info(&format!("status:      {}", status));
        output.info(&format!("confidence:  {}", confidence));
        if let Some(rec) = mission.get("recommendation").and_then(Value::as_str) {
            output.info(&format!("recommendation: {}", truncate(rec, 200)));
        }

        if let Some(actions) = mission.get("actions").and_then(Value::as_array) {
            let rows: Vec<Vec<String>> = actions
                .iter()
                .map(|a| {
                    vec![
                        cell_from_value(a.get("key").unwrap_or(&Value::Null)),
                        cell_from_value(a.get("hotkey").unwrap_or(&Value::Null)),
                        cell_from_value(a.get("label").unwrap_or(&Value::Null)),
                    ]
                })
                .collect();
            output.info("actions:");
            output.table(
                &["KEY", "HOTKEY", "LABEL"],
                rows,
                &Value::Array(actions.clone()),
            );
        }
    }
    Ok(())
}

fn decide(client: &Client, output: &Output, id: &str, action_key: &str) -> Result<()> {
    let body = json!({ "actionKey": action_key });
    let value: Value = client.post_value(&format!("/api/missions/{}/decide", id), &body)?;
    if output.is_json() {
        output.emit_value(&value)?;
    } else {
        output.success(&format!(
            "mission {} decided with action {}",
            id, action_key
        ));
    }
    Ok(())
}

fn dismiss(client: &Client, output: &Output, id: &str) -> Result<()> {
    client.post_empty(&format!("/api/missions/{}/dismiss", id))?;
    if output.is_json() {
        output.emit(&json!({ "ok": true, "id": id }))?;
    } else {
        output.success(&format!("mission {} dismissed", id));
    }
    Ok(())
}

fn scan(client: &Client, output: &Output) -> Result<()> {
    let value: Value = client.post_empty("/api/missions/scan")?;
    if output.is_json() {
        output.emit_value(&value)?;
    } else {
        output.success("mission scan triggered");
        if let Some(started) = value.get("startedAt").and_then(Value::as_str) {
            output.info(&format!("started at: {}", started));
        }
    }
    Ok(())
}
