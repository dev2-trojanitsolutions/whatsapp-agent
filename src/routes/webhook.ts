import { Router } from "express";
import { env } from "../config/env";
import { parseInboundMessages, sendTypingIndicator, verifyWebhookSignature } from "../services/whatsapp";
import { enqueueMessage } from "../services/debounceQueue";
import { handleBatchedTurn } from "../services/orchestrator";

export const webhookRouter = Router();

// Meta's one-time webhook verification handshake.
webhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.whatsapp.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

webhookRouter.post("/", async (req, res) => {
  const signature = req.header("x-hub-signature-256");
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  const messages = parseInboundMessages(req.body);
  for (const message of messages) {
    await sendTypingIndicator(message.id);
    await enqueueMessage(message.from, message.text, (conversationKey, batched) => {
      handleBatchedTurn(conversationKey, batched).catch((err) =>
        console.error(`Failed to handle turn for ${conversationKey}:`, err)
      );
    });
  }
});
