use anyhow::Result;
use clap::Subcommand;
use serde_json::{json, Value};

use crate::client::Client;
use crate::format::{cell_from_value, truncate, Output};

#[derive(Subcommand, Debug)]
pub enum SchedulesCommand {
    /// List all schedules.
    List,
    /// Show a schedule with recent executions.
    Show { id: String },
    /// Enable a schedule.
    Enable { id: String },
    /// Disable a schedule.
    Disable { id: String },
    /// Delete a schedule and its execution history.
    Delete { id: String },
}

pub fn run(client: &Client, output: &Output, cmd: SchedulesCommand) -> Result<()> {
    match cmd {
        SchedulesCommand::List => list(client, output),
        SchedulesCommand::Show { id } => show(client, output, &id),
        SchedulesCommand::Enable { id } => set_enabled(client, output, &id, true),
        SchedulesCommand::Disable { id } => set_enabled(client, output, &id, false),
        SchedulesCommand::Delete { id } => delete(client, output, &id),
    }
}

fn list(client: &Client, output: &Output) -> Result<()> {
    let value: Value = client.get_value("/api/schedules")?;

    let rows: Vec<Vec<String>> = value
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|item| {
                    vec![
                        cell_from_value(item.get("id").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("name").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("cronExpression").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("timezone").unwrap_or(&Value::Null)),
                        if item
                            .get("enabled")
                            .and_then(Value::as_bool)
                            .unwrap_or(false)
                        {
                            "on".to_string()
                        } else {
                            "off".to_string()
                        },
                        cell_from_value(item.get("nextRunAt").unwrap_or(&Value::Null)),
                    ]
                })
                .collect()
        })
        .unwrap_or_default();

    output.table(
        &["ID", "NAME", "CRON", "TZ", "STATE", "NEXT RUN"],
        rows,
        &value,
    );
    Ok(())
}

fn show(client: &Client, output: &Output, id: &str) -> Result<()> {
    let value: Value = client.get_value(&format!("/api/schedules/{}/executions", id))?;

    if output.is_json() {
        output.emit_value(&value)?;
        return Ok(());
    }

    if let Some(schedule) = value.get("schedule") {
        let name = schedule.get("name").and_then(Value::as_str).unwrap_or("—");
        let cron = schedule
            .get("cronExpression")
            .and_then(Value::as_str)
            .unwrap_or("—");
        let tz = schedule
            .get("timezone")
            .and_then(Value::as_str)
            .unwrap_or("UTC");
        let enabled = schedule
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        output.info(&format!("name:     {}", name));
        output.info(&format!("cron:     {} ({})", cron, tz));
        output.info(&format!("enabled:  {}", enabled));
        if let Some(next) = schedule.get("nextRunAt").and_then(Value::as_str) {
            output.info(&format!("next run: {}", next));
        }
        if let Some(prompt) = schedule.get("prompt").and_then(Value::as_str) {
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
                        cell_from_value(item.get("startedAt").unwrap_or(&Value::Null)),
                        cell_from_value(item.get("finishedAt").unwrap_or(&Value::Null)),
                    ]
                })
                .collect()
        })
        .unwrap_or_default();

    output.info("executions:");
    output.table(
        &["ID", "STATUS", "STARTED", "FINISHED"],
        rows,
        &Value::Array(executions.cloned().unwrap_or_default()),
    );
    Ok(())
}

fn set_enabled(client: &Client, output: &Output, id: &str, enabled: bool) -> Result<()> {
    let body = json!({ "enabled": enabled });
    let value: Value = client.patch_value(&format!("/api/schedules/{}", id), &body)?;
    if output.is_json() {
        output.emit_value(&value)?;
    } else {
        output.success(&format!(
            "schedule {} {}",
            id,
            if enabled { "enabled" } else { "disabled" }
        ));
    }
    Ok(())
}

fn delete(client: &Client, output: &Output, id: &str) -> Result<()> {
    client.delete(&format!("/api/schedules/{}", id))?;
    if output.is_json() {
        output.emit(&json!({ "ok": true, "id": id }))?;
    } else {
        output.success(&format!("schedule {} deleted", id));
    }
    Ok(())
}
