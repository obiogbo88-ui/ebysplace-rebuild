const INVISIBLE_OR_COPY_WHITESPACE = /[\s\u200B-\u200D\uFEFF]+/g;

export function trimEnvValue(value: string | undefined | null) {
  return (value ?? "").trim().replace(/^[\'\"]|[\'\"]$/g, "").trim();
}

export function normalizeSecretKey(value: string | undefined | null) {
  return trimEnvValue(value).replace(INVISIBLE_OR_COPY_WHITESPACE, "");
}

export function normalizeEnvUrl(value: string | undefined | null) {
  return normalizeSecretKey(value).replace(/\/+$/, "");
}
