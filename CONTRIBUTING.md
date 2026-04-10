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
```

If you need to fix formatting automatically:

```bash
npm run format:fix
```

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
