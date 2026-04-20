use owo_colors::OwoColorize;
use serde::Serialize;
use serde_json::Value;

/// Output formatter — respects the global `--json` flag and keeps
/// human-readable output compact for terminals.
pub struct Output {
    json: bool,
}

impl Output {
    pub fn new(json: bool) -> Self {
        Self { json }
    }

    pub fn is_json(&self) -> bool {
        self.json
    }

    /// Emit a single value as pretty-printed JSON. Call sites should first
    /// check `is_json()` — this is the JSON-mode escape hatch for records
    /// built on the fly (e.g. `{ "ok": true }` acknowledgements) that don't
    /// already exist as a `serde_json::Value`.
    pub fn emit<T: Serialize>(&self, value: &T) -> anyhow::Result<()> {
        println!("{}", serde_json::to_string_pretty(value)?);
        Ok(())
    }

    pub fn emit_value(&self, value: &Value) -> anyhow::Result<()> {
        println!("{}", serde_json::to_string_pretty(value)?);
        Ok(())
    }

    /// Pretty-print a list of rows as a simple aligned table. When `--json`
    /// is active, emit the underlying JSON array instead.
    pub fn table(&self, headers: &[&str], rows: Vec<Vec<String>>, json_rows: &Value) {
        if self.json {
            match serde_json::to_string_pretty(json_rows) {
                Ok(s) => println!("{}", s),
                Err(_) => println!("[]"),
            }
            return;
        }

        if rows.is_empty() {
            println!("{}", "No results.".dimmed());
            return;
        }

        let mut widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
        for row in &rows {
            for (i, cell) in row.iter().enumerate() {
                if i < widths.len() && cell.len() > widths[i] {
                    widths[i] = cell.len();
                }
            }
        }

        let header_line: Vec<String> = headers
            .iter()
            .zip(widths.iter())
            .map(|(h, w)| format!("{:width$}", h, width = w))
            .collect();
        println!("{}", header_line.join("  ").bold().to_string());

        for row in rows {
            let line: Vec<String> = row
                .iter()
                .zip(widths.iter())
                .map(|(c, w)| format!("{:width$}", c, width = w))
                .collect();
            println!("{}", line.join("  "));
        }
    }

    pub fn info(&self, message: &str) {
        if self.json {
            return;
        }
        println!("{}", message);
    }

    pub fn success(&self, message: &str) {
        if self.json {
            return;
        }
        println!("{} {}", "ok".green().bold(), message);
    }

    pub fn warn(&self, message: &str) {
        if self.json {
            return;
        }
        eprintln!("{} {}", "warn".yellow().bold(), message);
    }

    pub fn error(&self, err: &anyhow::Error) {
        if self.json {
            let payload = serde_json::json!({ "error": err.to_string() });
            eprintln!(
                "{}",
                serde_json::to_string_pretty(&payload).unwrap_or_else(|_| err.to_string())
            );
        } else {
            eprintln!("{} {}", "error".red().bold(), err);
            let mut source = err.source();
            while let Some(s) = source {
                eprintln!("  {} {}", "caused by:".dimmed(), s);
                source = s.source();
            }
        }
    }
}

/// Trim a string to at most `max` characters, ending with `...` if truncated.
pub fn truncate(value: &str, max: usize) -> String {
    if value.chars().count() <= max {
        value.to_string()
    } else {
        let mut s: String = value.chars().take(max.saturating_sub(1)).collect();
        s.push('…');
        s
    }
}

/// Best-effort human representation of a JSON value for a table cell.
pub fn cell_from_value(value: &Value) -> String {
    match value {
        Value::Null => "—".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}
