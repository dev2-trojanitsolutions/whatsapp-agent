import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),

  whatsapp: {
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
    accessToken: required("WHATSAPP_ACCESS_TOKEN"),
    verifyToken: required("WHATSAPP_VERIFY_TOKEN"),
    appSecret: required("WHATSAPP_APP_SECRET"),
  },

  gemini: {
    apiKey: required("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
  },

  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),

  salesTestNumber: required("SALES_TEST_NUMBER"),

  businessHours: {
    timezone: process.env.BUSINESS_TIMEZONE ?? "Asia/Qatar",
    days: (process.env.BUSINESS_DAYS ?? "0,1,2,3,4").split(",").map(Number),
    start: process.env.BUSINESS_HOURS_START ?? "08:00",
    end: process.env.BUSINESS_HOURS_END ?? "18:00",
  },

  debounce: {
    quietMs: Number(process.env.DEBOUNCE_QUIET_MS ?? 8000),
    maxWaitMs: Number(process.env.DEBOUNCE_MAX_WAIT_MS ?? 25000),
  },
};
