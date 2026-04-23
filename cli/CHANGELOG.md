# Changelog

All notable changes to **argus-cli** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-23

### Changed

- `install.sh` now **builds the CLI from source by default** (clone + `cargo build --release`). Use `ARGUS_VERSION=cli-vX.Y.Z` or `ARGUS_RELEASE=1` to install a prebuilt release tarball when one exists.
- The installer **appends `~/.argus/bin` to `PATH`** in the user’s shell rc files (skippable with `ARGUS_NO_MODIFY_PATH=1`).

### Fixed

- Bash login setup no longer risks **shadowing an existing `~/.profile`** when creating `~/.bash_profile`.
- PATH snippets are written only into **rc files for shells the installer detects** as in use (instead of always editing every supported shell).

## [0.1.0] - 2026-04-20

### Added

- Initial release of the `argus` CLI: a Rust binary that talks to the local Argus relay (`http://127.0.0.1:8787` by default).
- Global flags: `--relay-url`, `ARGUS_RELAY_URL`, and `--json` for machine-readable output.
- `doctor` — check that the relay is reachable and report its configuration.
- `agent` — `show`, `set`, `remove`, `detect`, `test`, and `validate` for the local coding agent.
- `triggers` — `list`, `show`, `enable`, `disable`, and `delete`.
- `schedules` — `list`, `show`, `enable`, `disable`, and `delete` scheduled prompts.
- `missions` — `list` (optional `--all`), `show`, `decide`, `dismiss`, and `scan`.
- Release automation: GitHub Actions workflow triggered by tags matching `cli-v*.*.*`; publishes tarballs for darwin (arm64, x64) and linux (x64, arm64), `SHASUMS256.txt`, and attaches `install.sh`.
- Repository root `install.sh` to install the CLI binary from GitHub Releases.
