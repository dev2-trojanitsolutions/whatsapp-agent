import axios from "axios";
import crypto from "crypto";
import FormData from "form-data";
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

export async function sendAudioMessage(to: string, mediaId: string): Promise<void> {
  await client.post("", {
    messaging_product: "whatsapp",
    to,
    type: "audio",
    audio: { id: mediaId },
  });
}

export async function getMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
  const res = await axios.get(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${env.whatsapp.accessToken}` },
  });
  return { url: res.data.url, mimeType: res.data.mime_type };
}

export async function downloadMedia(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${env.whatsapp.accessToken}` },
    responseType: "arraybuffer",
  });
  return Buffer.from(res.data);
}

export async function uploadMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", buffer, { filename, contentType: mimeType });

  const res = await axios.post(
    `https://graph.facebook.com/v20.0/${env.whatsapp.phoneNumberId}/media`,
    form,
    { headers: { Authorization: `Bearer ${env.whatsapp.accessToken}`, ...form.getHeaders() } }
  );
  return res.data.id;
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
  type: "text" | "audio";
  text?: string;
  mediaId?: string;
}

export function parseInboundMessages(body: any): InboundMessage[] {
  const messages: InboundMessage[] = [];
  const entries = body?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        if (msg.type === "text") {
          messages.push({ from: msg.from, id: msg.id, type: "text", text: msg.text.body });
        } else if (msg.type === "audio") {
          messages.push({ from: msg.from, id: msg.id, type: "audio", mediaId: msg.audio.id });
        }
      }
    }
  }
  return messages;
}
