/**
 * Minimal width/height sniffer for JPEG, PNG and WebP — the formats phone
 * cameras and browsers actually produce for AI Try-On uploads. No decode,
 * just enough header parsing to read the dimensions, so we don't need a
 * full image library (sharp, jimp, …) just to pick an output canvas shape.
 * Returns null for anything else; callers should fall back to a default.
 */
export function probeImageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24) return null;

  // PNG: 8-byte signature, then an IHDR chunk with width/height as two
  // big-endian uint32s at a fixed offset.
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  // WebP: RIFF container. VP8X/VP8L/VP8 each encode dimensions differently.
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const chunkId = bytes.toString("ascii", 12, 16);
    if (chunkId === "VP8X" && bytes.length >= 30) {
      const width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
      const height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
      return { width, height };
    }
    if (chunkId === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }
    if (chunkId === "VP8 " && bytes.length >= 30) {
      const width = bytes.readUInt16LE(26) & 0x3fff;
      const height = bytes.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
    return null;
  }

  // JPEG: walk the marker segments until an SOF marker (start of frame),
  // which carries height/width as big-endian uint16s.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15 carry dimensions;
      // 0xC4/0xC8/0xCC are DHT/JPG/DAC and must be skipped, not read as SOF.
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      const segmentLength = bytes.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
    return null;
  }

  return null;
}

const OPENAI_IMAGE_SIZES = [
  { size: "1024x1024", ratio: 1024 / 1024 },
  { size: "1024x1536", ratio: 1024 / 1536 },
  { size: "1536x1024", ratio: 1536 / 1024 },
] as const;

/**
 * Picks whichever OpenAI-supported output canvas is closest in shape to the
 * source photo, so the model can keep the customer's original framing and
 * zoom instead of having to crop or reframe a tall/narrow selfie into a
 * forced square. Compares in log space so e.g. "twice as wide" and "twice
 * as tall" count as equally distant from square.
 */
export function pickOpenAIImageSize(dimensions: { width: number; height: number } | null): (typeof OPENAI_IMAGE_SIZES)[number]["size"] {
  if (!dimensions || !dimensions.width || !dimensions.height) return "1024x1024";
  const sourceRatio = dimensions.width / dimensions.height;
  let best: (typeof OPENAI_IMAGE_SIZES)[number] = OPENAI_IMAGE_SIZES[0];
  let bestDistance = Infinity;
  for (const candidate of OPENAI_IMAGE_SIZES) {
    const distance = Math.abs(Math.log(candidate.ratio) - Math.log(sourceRatio));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best.size;
}
