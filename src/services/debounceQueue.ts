import Redis from "ioredis";
import { env } from "../config/env";

const redis = new Redis(env.redisUrl);

type FlushHandler = (conversationKey: string, messages: string[]) => void;

const timers = new Map<string, { quietTimer: NodeJS.Timeout; maxTimer: NodeJS.Timeout }>();

function queueKey(conversationKey: string) {
  return `debounce:${conversationKey}`;
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

  if (messages.length > 0) {
    onFlush(conversationKey, messages);
  }
}

export async function enqueueMessage(
  conversationKey: string,
  text: string,
  onFlush: FlushHandler
): Promise<void> {
  console.log(`Enqueuing message for ${conversationKey}: "${text}"`);
  await redis.rpush(queueKey(conversationKey), text);

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
