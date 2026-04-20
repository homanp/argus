# argus CLI

Thin Rust CLI wrapping the local Argus relay (`http://127.0.0.1:8787`).
Ships as a single static binary via GitHub Releases + `install.sh`.

## Run during development

The relay must be running (`npm run relay:dev` from the repo root).

```bash
cargo run --manifest-path cli/Cargo.toml -- doctor
cargo run --manifest-path cli/Cargo.toml -- triggers list
cargo run --manifest-path cli/Cargo.toml -- missions list --all
```

Point at a different relay with `--relay-url` or `ARGUS_RELAY_URL`.
Add `--json` to any command for machine-readable output.

## Release

Cut a release by pushing a git tag that matches `cli-v*.*.*`:

```bash
git tag cli-v0.1.0
git push origin cli-v0.1.0
```

The workflow in [../.github/workflows/cli-release.yml](../.github/workflows/cli-release.yml)
cross-compiles darwin arm64 / darwin x64 / linux x64 / linux arm64 tarballs,
generates `SHASUMS256.txt`, and attaches everything (plus `install.sh`) to the
GitHub Release.

## Local release build

```bash
cargo build --release --manifest-path cli/Cargo.toml
./cli/target/release/argus --help
```
