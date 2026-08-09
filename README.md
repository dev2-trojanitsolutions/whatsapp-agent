# Trojan WhatsApp Sales Agent

WhatsApp sales agent for **Trojan Technologies** (Qatar printer & copier sales/service). Single WhatsApp number, sales-agent-only scope — see the architecture plan for the full design and what's deferred to later phases.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` — from your Meta App / WhatsApp Business Account.
   - `WHATSAPP_VERIFY_TOKEN` — any string you choose; you'll enter the same value when configuring the webhook in Meta's dashboard.
   - `GEMINI_API_KEY` — get a free key at [aistudio.google.com](https://aistudio.google.com); the free tier costs nothing.
   - `DATABASE_URL`, `REDIS_URL` — point at a local or hosted Postgres/Redis instance.
   - `SALES_TEST_NUMBER` — the WhatsApp number (E.164, no `+`) that leads get forwarded to for now.

2. Install dependencies:
   ```
   npm install
   ```

3. Create the database tables:
   ```
   npm run migrate
   ```

4. Run in development:
   ```
   npm run dev
   ```

5. Expose the server publicly (e.g. `ngrok http 3000`) and set the webhook URL in Meta's WhatsApp app settings to `https://<your-tunnel>/webhook`, using the `WHATSAPP_VERIFY_TOKEN` from your `.env`.

## How a message flows

1. WhatsApp calls `POST /webhook` → message text is pushed into a Redis-backed per-conversation queue (`src/services/debounceQueue.ts`).
2. After 8s of quiet (or 25s max), the queue flushes and hands the batched text to the orchestrator (`src/services/orchestrator.ts`).
3. The orchestrator looks up (or creates) the customer and conversation, checks for human takeover and business hours, then calls the LLM via Google Gemini (`src/services/llm.ts`) with the knowledge base and persona as system prompt.
4. If the LLM decides the message shows real sales interest, it calls the `notify_sales_team` tool — the orchestrator writes a `leads` row and forwards the summary to `SALES_TEST_NUMBER`.
5. The reply text is sent back to the customer over the Cloud API.

## Not built yet (see architecture plan for phasing)

- Human takeover UI (the `human_takeover` flag exists on `conversations` but nothing sets it yet — flip it manually in the DB for now).
- Real notification channel (currently forwards to one test number).
- IT support agent, and onboarding Trojan IT Solutions' India business line.
