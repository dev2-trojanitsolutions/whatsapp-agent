import Redis from "ioredis";
import { env } from "../config/env";

const redis = new Redis(env.redisUrl);

type FlushHandler = (conversationKey: string, messages: string[], wasVoice: boolean) => void;

const timers = new Map<string, { quietTimer: NodeJS.Timeout; maxTimer: NodeJS.Timeout }>();

function queueKey(conversationKey: string) {
  return `debounce:${conversationKey}`;
}

function voiceFlagKey(conversationKey: string) {
  return `debounce:voice:${conversationKey}`;
}

async function flush(conversationKey: string, onFlush: FlushHandler) {
  const existing = timers.get(conversationKey);
  if (existing) {
    clearTimeout(existing.quietTimer);
    clearTimeout(existing.maxTimer);
    timers.delete(conversationKey);
  }

  const key = queueKey(conversationKey);
  const messages = await redis.lrange(key, 0, -1);
  await redis.del(key);

  const wasVoice = (await redis.getdel(voiceFlagKey(conversationKey))) === "1";

  if (messages.length > 0) {
    onFlush(conversationKey, messages, wasVoice);
  }
}

export async function enqueueMessage(
  conversationKey: string,
  text: string,
  onFlush: FlushHandler,
  isVoice = false
): Promise<void> {
  console.log(`Enqueuing message for ${conversationKey}: "${text}"`);
  await redis.rpush(queueKey(conversationKey), text);
  if (isVoice) {
    await redis.set(voiceFlagKey(conversationKey), "1");
  }

  const existing = timers.get(conversationKey);
  if (existing) {
    clearTimeout(existing.quietTimer);
  }

  const quietTimer = setTimeout(() => {
    flush(conversationKey, onFlush);
  }, env.debounce.quietMs);

  const maxTimer = existing?.maxTimer ?? setTimeout(() => {
    flush(conversationKey, onFlush);
  }, env.debounce.maxWaitMs);

  timers.set(conversationKey, { quietTimer, maxTimer });
}
