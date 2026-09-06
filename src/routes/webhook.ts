import { Router } from "express";
import { env } from "../config/env";
import {
  parseInboundMessages,
  sendTypingIndicator,
  sendTextMessage,
  getMediaUrl,
  downloadMedia,
  verifyWebhookSignature,
} from "../services/whatsapp";
import { transcribeAudio } from "../services/speechToText";
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

    let text: string;
    let isVoice = false;

    if (message.type === "audio") {
      try {
        const { url, mimeType } = await getMediaUrl(message.mediaId!);
        const audio = await downloadMedia(url);
        text = await transcribeAudio(audio, mimeType);
        isVoice = true;
      } catch (err) {
        console.error(`Failed to transcribe voice note from ${message.from}:`, err);
        await sendTextMessage(message.from, "Sorry, I couldn't catch that voice note — could you type it instead?");
        continue;
      }
      if (!text) {
        await sendTextMessage(message.from, "Sorry, I couldn't catch that voice note — could you type it instead?");
        continue;
      }
    } else {
      text = message.text!;
    }

    await enqueueMessage(
      message.from,
      text,
      (conversationKey, batched, wasVoice) => {
        handleBatchedTurn(conversationKey, batched, wasVoice).catch((err) =>
          console.error(`Failed to handle turn for ${conversationKey}:`, err)
        );
      },
      isVoice
    );
  }
});
