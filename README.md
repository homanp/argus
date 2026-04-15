# argus

**the post-prompt agent**

_today's AI waits for you to type. argus doesn't._

---

## why this exists

every AI product on the market today is reactive. you type a prompt, it responds. you ask a question, it answers. you upload a file, it summarizes. the pattern is identical across chatgpt, claude, copilot, perplexity, cursor, and every agent platform that raised a hundred million dollars last year. nothing happens until you start the conversation.

this is strange, because we keep calling these things agents. the word "agent" comes from the latin _agere_, which means to do, to act. a thing that only acts when you prompt it isn't really an agent. it's a search box with more words.

what we actually shipped as an industry is **prompt-gated AI**. a billion dollars worth of brilliant models sitting in a waiting room, doing nothing until a human types the first word. the intelligence is real. the proactivity is not.

this is the gap argus closes. argus is the part that happens before the prompt. it watches the events you care about across every tool you use, notices the things that matter, decides what to do about them, and either does them or surfaces a decision for you. the intelligence doesn't wait for you to summon it. it's already running.

we think of argus as a **post-prompt agent**. the loop isn't "you type, it responds." the loop is "the world changes, argus notices, argus acts, and occasionally argus asks you about something only you can decide." you're no longer the trigger. you're the exception handler.

the test for whether something is really an agent or just a chatbot in costume is simple: does it do anything when you're not looking at it? if the answer is no, it's prompt-gated. if the answer is yes, you have an agent.

---

## what "proactive" actually means

being proactive is not the same as being chatty. plenty of AI products send you notifications, but the notifications are still downstream of a prompt you gave them earlier. "let me know when my flight price drops" is just a delayed prompt. the agent is still waiting to be told what to care about, one job at a time.

real proactivity means the agent forms its own model of what you care about and keeps that model current without being asked. it learns that you protect your prep blocks, that you respond to investors fast, that you've offered credits instead of refunds 61% of the time in the last year, that your daughter's track finals matter more than a $126 flight savings. nobody told argus any of this. it figured it out from watching how you actually behave.

and then the real test: does the agent act on that model without checking in for every small decision? argus auto-handles 239 things a day because the confidence is high and the action is reversible. only 4 things end up in the inbox. the 4 things aren't "tasks queued for you to do." they're the specific cases where a human value judgment is required and argus knows it.

this is the inversion. most AI products try to earn their keep by doing more, talking more, surfacing more. argus earns its keep by doing less visible work, more silent work, and only appearing when it has to.

the best agent is the one you forget is running.

---

## what it actually does

four real scenarios from a single day.

**a $2,400 refund request comes in via stripe.** argus pulls the customer's 12 months of history, cross-references linkedin (the company just announced a restructure), checks the brin trust score, and looks at how i've handled 23 similar churn cases in the past. 61% of the time i offered a credit instead of a full refund. argus recommends a 50% credit and shows me the 6-step plan it would execute if i approve. i press 1. it's done in 9 seconds.

**an investor asks to reschedule.** argus notices the only good slot collides with a prep block i said never to schedule over. it tells me i've broken that rule 3 times in 90 days, all for investors, and that this investor's last reschedule took 11 days to land. it doesn't pick for me. it surfaces the trade-off. this is a values call, not a data call.

**a github PR fixes a real bug but changes the public API.** the fix touches 4 downstream services and a public endpoint that gets 340 external calls per day. argus recommends splitting into two PRs with a 2-week deprecation notice, the same pattern my team has used 6 times before without a single customer complaint. this one isn't handled by the default agent. i run argus code on grok for code work, and it shows up tagged that way in the inbox.

**a flight price drop hits my threshold.** normally argus just books it. but this time the departure conflicts with my daughter's regional track finals. argus suggests the next-day flight at $126 more and tells me she's been training for this qualifier for months. confidence 0.68. "values call." it won't override a parent.

the pattern in all four: argus doesn't just react to events. it pulls context from everywhere, forms an opinion, and shows its work before asking.

---

## show your work

every decision argus surfaces has four things: an **analysis** in prose that reads like a memo from a thoughtful analyst, a **plan** showing exactly what argus will do if you approve (with per-step tool calls, time estimates, and reversibility indicators), the raw **missions** it ingested, and a timeline of **similar past decisions** from your own history.

the missions section is the one that people don't expect. instead of stats, you see the actual receipts. the webhook payload that triggered the decision. the API response argus pulled. the linkedin post it scraped, with the URL. the brin trust score and its four dimensions. the SQL query argus ran against its own memory of your past decisions.

if you want to audit whether argus is making things up, click "view raw" on any mission item. nothing is hidden.

most agent products show you a conclusion and ask for approval. argus shows you the conclusion, the reasoning, the plan, and every source it used to get there. the whole thing is legible.

---

## bring your own brain

argus doesn't care which LLM you run it on. claude, grok, gpt-5, gemini, mistral, or your own local llama. each agent can be scoped to specific tasks. code goes to grok. mail drafts go to gpt-5. customer data stays on the local llama and never leaves your machine.

this matters for two reasons.

first, you shouldn't be locked into one model vendor. the best agent for drafting an investor email is not the best agent for reviewing a PR. argus routes based on the task, not the vendor's marketing budget.

second, and this is the one that actually matters, some of your data should never touch a cloud LLM. customer records. strategy docs. legal correspondence. user conversations. with argus you pin those workloads to a local model and that's it. your data, your brain, your machine.

this is the thing anthropic, openai, and xai structurally cannot ship. their business model depends on you using their model. argus's doesn't. we make money on the trust layer underneath, not on the inference.

---

## the five things argus watches

argus is built around five concepts. each one is a first-class view in the UI, each one does one job well, and together they cover the full loop from event to action to notification.

**connectors** are the sources argus watches. gmail, calendar, stripe, github, linear, slack, x, rss feeds, custom webhooks. any system that can emit an event or expose an API is a connector. you add them once, scope their permissions, and argus starts watching.

**triggers** are reactive rules. when `stripe.charge.failed` and amount over $500, argus drafts an apology email and flags your inbox. when `github.pr.opened` by dependabot, argus verifies with brin, runs tests, and auto-merges if clean. each trigger has a condition and an action, both in plain english.

**schedules** are proactive rules. 30 minutes before any meeting, research the attendees and draft talking points. every friday at 16:00, pull the week's stripe numbers and post the revenue report to slack #wins. every morning at 07:00, read 24 rss feeds and draft a priority digest. schedules are how argus stays ahead of you.

**channels** are where argus reaches you. push, slack, email digest, imessage, apple watch, webhook to your own infrastructure. but channels aren't just endpoints. argus has smart routing rules that decide which channel to use based on the decision. high stakes and low confidence? push plus sms. code work during work hours? slack #engineering. auto-handled stuff? batch into the 17:00 email digest. security blocks? sms immediately. the routing is the brain.

**agents** are the LLMs that do the actual thinking. the default agent is opinionated and generalist. you can add specialized agents for specific tasks — argus code on grok, argus mail on gpt-5, a local llama for anything touching private data. each agent has a scope and argus routes automatically.

five concepts. each one is a wedge that closed cloud-first agent platforms structurally cannot match.

---

## the daily ritual

the whole product is designed around this loop:

you open argus in the morning. the "today" view shows everything in 10 seconds. needs you, right now, recent, sources, triggers. if nothing needs you, you close the window. if something does, you click into the inbox.

the inbox is a list of decision cards. each card has argus's recommendation, its reasoning in 3-4 sentences, a confidence score, and three inline action buttons with keyboard shortcuts. press 1, 2, or 3 and move on. most cards clear in under 15 seconds. the whole inbox clears in under 2 minutes.

if you want to dig in, the detail view has the full analysis, plan, missions, historical comparison, and a conversation thread where you can push back on argus's reasoning before deciding. this is where argus stops being a filter and becomes a thinking partner.

you do this three times a day. morning, midday, evening. each check-in is under a minute. the rest of the day argus is quietly handling 239 things you never had to think about.

that's what 98% handled looks like from the inside. it doesn't feel like magic. it feels like nothing at all. which is the point.

---

## who this is for

founders and operators who live in 10 browser tabs. developers who like the way linear feels and want that density for their own work and life. privacy-conscious engineers who refuse to pipe everything through a cloud LLM. security-minded teams who need to prove every agent action was verified. anyone who's tired of being interrupted by AI products that promised to save them time.

if you want a chatbot, argus is not for you. if you want an assistant that proves it's working by talking to you a lot, argus is not for you. if you want something that handles the boring stuff silently and only speaks up when it actually matters, welcome.

---

## getting started

argus is a tauri desktop app with a local relay server that receives webhooks on your behalf.

### prerequisites

- node.js 20+
- rust / cargo (for the tauri desktop shell)
- npm

### install dependencies

```bash
npm install
cd relay && npm install && cd ..
```

### start the relay

the relay is a small express server that stores connector state in SQLite (via drizzle ORM) and receives webhooks from providers like github. a cloudflare tunnel starts automatically so webhook URLs are publicly reachable without any manual setup.

```bash
cp relay/.env.example relay/.env
npm run relay:dev
```

you should see output like:

```
Argus relay listening on http://127.0.0.1:8787
Starting Cloudflare tunnel...
Tunnel ready: https://xxx.trycloudflare.com
```

the tunnel URL is what github will use to deliver webhooks. it changes on every restart (free tier), so you'll need to update the webhook URL in github if you restart the relay.

to skip the tunnel and use your own public domain instead, set `RELAY_BASE_URL` in `relay/.env`:

```
RELAY_BASE_URL=https://relay.your-domain.com
```

### start the desktop app

in a separate terminal:

```bash
npm run tauri dev
```

### connect github

1. create a [github personal access token](https://github.com/settings/tokens) with `repo` scope
2. open the app and navigate to **connectors**
3. click **view integration** on the github card
4. paste the token and click **connect github**
5. select the repos you want to watch — each one gets a unique webhook URL and secret
6. expand a repo to see the webhook URL and secret, then add a webhook in your github repo settings:
   - **settings → webhooks → add webhook**
   - paste the payload URL
   - set content type to `application/json`
   - paste the secret
   - choose which events to subscribe to
7. click **test webhook** to verify the local path works, then push a commit or open a PR to see real events flow through

### connect your coding agent

argus dispatches prompts to a local coding agent CLI when triggers fire or schedules tick. you need at least one agent CLI installed on your machine.

**supported agents:**

| agent                                                         | install                                    |
| ------------------------------------------------------------- | ------------------------------------------ | ----- |
| [claude code](https://docs.anthropic.com/en/docs/claude-code) | `npm install -g @anthropic-ai/claude-code` |
| [codex](https://github.com/openai/codex)                      | `npm install -g @openai/codex`             |
| [gemini cli](https://github.com/google-gemini/gemini-cli)     | `npm install -g @google/gemini-cli`        |
| [cursor](https://www.cursor.com/docs/cli/overview)            | included with Cursor desktop app           |
| [opencode](https://opencode.ai)                               | `curl -fsSL https://opencode.ai/install    | bash` |

once installed, open the app and navigate to **agents**. argus auto-detects which CLIs are available on your machine. pick one or enter a custom command manually, then hit **test** to verify it works.

**install the argus skill (coming soon):**

the argus skill gives your coding agent direct context about your triggers, schedules, and events. install it with [skills.sh](https://skills.sh):

```bash
npx skills add argus-ai/argus
```

**install the argus cli (coming soon):**

the argus CLI lets you manage connectors, triggers, schedules, and your agent configuration from the terminal without opening the desktop app:

```bash
curl -fsSL https://argus.dev/install | bash
```

### relay architecture

```
relay/
├── src/
│   ├── index.ts          # express server, API routes, webhook receiver
│   ├── agent.ts           # agent detection, configuration, and CLI runner
│   ├── scheduler.ts       # cron scheduler for scheduled prompts
│   ├── tunnel.ts          # auto-starts a cloudflare tunnel on boot
│   └── db/
│       ├── schema.ts      # drizzle ORM schema (integrations, repos, events, agent)
│       └── client.ts      # SQLite connection via better-sqlite3
├── data/
│   └── relay.db           # local SQLite database (auto-created)
├── .env.example
├── package.json
└── tsconfig.json
```

the relay owns all provider credentials and webhook secrets. the desktop app talks to the relay over `http://127.0.0.1:8787` and never stores API keys locally.

---

## contributing

argus is built in the open and we take contributions seriously. issues, PRs, and feature requests are all welcome. there's no CLA, no corporate approval process, no "community edition vs enterprise edition" split. one codebase, MIT license, forever.

see `CONTRIBUTING.md` for development setup and guidelines.

---

## license

MIT. do what you want with it.
