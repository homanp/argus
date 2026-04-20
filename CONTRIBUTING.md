# Contributing to Argus

Thanks for contributing to Argus.

## Development setup

1. Install the project prerequisites:
   - Node.js 22+ and `npm`
   - Rust stable with `cargo`
   - Tauri platform prerequisites from the [Tauri docs](https://v2.tauri.app/start/prerequisites/)
2. Install dependencies:

```bash
npm install
```

## Running the app

Start the frontend dev server:

```bash
npm run dev
```

Run the desktop app with Tauri:

```bash
npm run tauri dev
```

## Before you open a pull request

Run the same checks used by the repo hook and CI:

```bash
npm run format
npm run lint
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path cli/Cargo.toml
```

If you need to fix formatting automatically:

```bash
npm run format:fix
```

## CLI development

The `argus` CLI lives in [`cli/`](cli/) as its own Cargo crate. It wraps the
relay HTTP API at `http://127.0.0.1:8787`, so the relay must be running
(`npm run relay:dev`) for most commands to work.

Run it during development without installing:

```bash
cargo run --manifest-path cli/Cargo.toml -- doctor
cargo run --manifest-path cli/Cargo.toml -- triggers list
cargo run --manifest-path cli/Cargo.toml -- missions list --all
```

Format and check the crate:

```bash
cargo fmt --manifest-path cli/Cargo.toml --all
cargo check --manifest-path cli/Cargo.toml
```

### Cutting a CLI release

Push a git tag that matches `cli-vX.Y.Z` (bump the `version` in
`cli/Cargo.toml` first):

```bash
git tag cli-v0.1.0
git push origin cli-v0.1.0
```

[`.github/workflows/cli-release.yml`](.github/workflows/cli-release.yml)
builds four tarballs (darwin arm64 / darwin x64 / linux x64 / linux arm64),
generates `SHASUMS256.txt`, and publishes them alongside `install.sh` as a
GitHub Release.

## Pull request guidelines

- Keep changes focused and easy to review.
- Use a descriptive PR title and fill out the PR template.
- Include a short test plan in the PR description.
- If your change affects behavior, include screenshots or notes about the visible result when useful.
- Make sure pre-commit hooks are enabled by running `npm install` at least once.

## Code style

- Frontend files are formatted with Prettier and linted with ESLint.
- Rust files are formatted with `cargo fmt`.
- Do not commit generated build output such as `dist/` or `src-tauri/target/`.

## Issues

Use the GitHub issue templates for bug reports and feature requests whenever possible.
