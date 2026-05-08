import { normalizeEnvUrl, normalizeSecretKey, trimEnvValue } from "./envSecrets";

export const ENV = {
  cookieSecret: normalizeSecretKey(process.env.JWT_SECRET),
  databaseUrl: trimEnvValue(process.env.DATABASE_URL),
  isProduction: process.env.NODE_ENV === "production",
  openAiApiKey: normalizeSecretKey(process.env.OPENAI_API_KEY),
  openAiBaseUrl: normalizeEnvUrl(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1",
  googleMapsApiKey: normalizeSecretKey(process.env.GOOGLE_MAPS_API_KEY),
};
