mod client;
mod commands;
mod format;

use anyhow::Result;
use clap::{Parser, Subcommand};

use crate::client::Client;
use crate::format::Output;

const DEFAULT_RELAY_URL: &str = "http://127.0.0.1:8787";

#[derive(Parser, Debug)]
#[command(
    name = "argus",
    version,
    about = "Manage Argus connectors, triggers, schedules, missions, and the local agent from the terminal.",
    long_about = None
)]
struct Cli {
    /// Base URL of the local Argus relay. Overrides ARGUS_RELAY_URL.
    #[arg(long, global = true, env = "ARGUS_RELAY_URL", default_value = DEFAULT_RELAY_URL)]
    relay_url: String,

    /// Emit JSON instead of human-readable output.
    #[arg(long, global = true)]
    json: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Check that the relay is reachable and report its configuration.
    Doctor,
    /// Manage the local coding agent configuration.
    #[command(subcommand)]
    Agent(commands::agent::AgentCommand),
    /// Manage triggers (reactive rules).
    #[command(subcommand)]
    Triggers(commands::triggers::TriggersCommand),
    /// Manage schedules (cron-driven prompts).
    #[command(subcommand)]
    Schedules(commands::schedules::SchedulesCommand),
    /// Manage missions (decisions awaiting review).
    #[command(subcommand)]
    Missions(commands::missions::MissionsCommand),
}

fn main() {
    let cli = Cli::parse();

    let output = Output::new(cli.json);
    let client = Client::new(cli.relay_url.clone());

    let result: Result<()> = match cli.command {
        Command::Doctor => commands::doctor::run(&client, &output),
        Command::Agent(cmd) => commands::agent::run(&client, &output, cmd),
        Command::Triggers(cmd) => commands::triggers::run(&client, &output, cmd),
        Command::Schedules(cmd) => commands::schedules::run(&client, &output, cmd),
        Command::Missions(cmd) => commands::missions::run(&client, &output, cmd),
    };

    if let Err(err) = result {
        output.error(&err);
        std::process::exit(1);
    }
}
