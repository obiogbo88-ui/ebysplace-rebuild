const INVISIBLE_OR_COPY_WHITESPACE = /[\s\u200B-\u200D\uFEFF]+/g;
const NON_ASCII_PRINTABLE = /[^\x20-\x7E]/g;

export function trimEnvValue(value: string | undefined | null) {
  return (value ?? "").trim().replace(/^[\'\"]|[\'\"]$/g, "").trim();
}

export function normalizeSecretKey(value: string | undefined | null) {
  // API keys are always plain ASCII. Strip anything else (smart quotes, em-dashes,
  // box-drawing characters, etc.) that can get pulled in by copy-pasting from a
  // formatted source \u2014 a stray one of these used to crash the fetch() call with
  // "Cannot convert argument to a ByteString" when it ended up in a header value.
  return trimEnvValue(value).replace(INVISIBLE_OR_COPY_WHITESPACE, "").replace(NON_ASCII_PRINTABLE, "");
}

export function normalizeEnvUrl(value: string | undefined | null) {
  return normalizeSecretKey(value).replace(/\/+$/, "");
}
