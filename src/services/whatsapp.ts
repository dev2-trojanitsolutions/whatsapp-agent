import axios from "axios";
import crypto from "crypto";
import { env } from "../config/env";

const GRAPH_URL = `https://graph.facebook.com/v20.0/${env.whatsapp.phoneNumberId}/messages`;

const client = axios.create({
  baseURL: GRAPH_URL,
  headers: {
    Authorization: `Bearer ${env.whatsapp.accessToken}`,
    "Content-Type": "application/json",
  },
});

export async function sendTextMessage(to: string, body: string): Promise<void> {
  await client.post("", {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

export async function sendTypingIndicator(messageId: string): Promise<void> {
  try {
    await client.post("", {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    });
  } catch {
    // Non-critical — typing indicator failing shouldn't block the reply.
  }
}

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", env.whatsapp.appSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export interface InboundMessage {
  from: string;
  id: string;
  text: string;
}

export function parseInboundMessages(body: any): InboundMessage[] {
  const messages: InboundMessage[] = [];
  const entries = body?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (msg.type === "text") {
          messages.push({ from: msg.from, id: msg.id, text: msg.text.body });
        }
      }
    }
  }
  return messages;
}
