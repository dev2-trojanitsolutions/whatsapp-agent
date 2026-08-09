import express from "express";
import { env } from "./config/env";
import { webhookRouter } from "./routes/webhook";

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

app.use("/webhook", webhookRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(env.port, () => {
  console.log(`Trojan WhatsApp sales agent listening on port ${env.port}`);
});
