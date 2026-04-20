import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  // Build artifacts from vite, cargo (tauri + cli), and relay TS — none of
  // these are hand-authored and at least one (tauri-codegen-assets *.js)
  // isn't valid ES parser input.
  globalIgnores(["dist", "src-tauri/target", "cli/target", "relay/dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ["src/components/ui/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/router.tsx", "src/components/activity-row.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
])
