export function buildTryOnPrompt(styleName: string): string {
  return [
    "You are performing a photorealistic hairstyle try-on edit for a premium hair salon, not a full portrait regeneration. The uploaded photo is the ground truth reference — treat it as immutable.",
    "",
    "PRESERVE THE PERSON (do not alter, even slightly): the customer's exact facial identity and facial structure — eyes, eyebrows, nose, lips, ears, jawline, face shape, skin tone, complexion, age, and any facial hair. Do not beautify, reshape, retouch, or smooth the face. The result must be recognisably the same person, not a different model.",
    "",
    "PRESERVE THE ORIGINAL PHOTO: keep the original camera angle, body position, proportions, clothing, background, and lighting/shadows exactly as they are. Do not generate a new photograph — only edit the hair region of this one.",
    "",
    `HAIRSTYLE ACCURACY: apply ${styleName} realistically to the customer's actual hairline and head shape. Respect the natural hairline, follow the head shape, and ensure the style originates naturally from the scalp with realistic sections and parting — no floating, pasted-on, or helmet-like hair. Hair must have realistic texture, density, thickness, and direction, and interact naturally with the forehead, ears, neck, and shoulders. Reproduce ${styleName} accurately and specifically (e.g. knotless braids need realistic knotless roots and clean sections; box braids need clearly defined square sections and consistent thickness; cornrows need clean scalp-parted rows; locs/faux locs need realistic individual loc formations, separation, and texture; twists need a recognisable twisted texture) rather than a generic approximation.`,
    "",
    "FRAME FOR THE FULL HAIRSTYLE: if the selected style is longer or larger than the customer's current hair, extend the image canvas outward (downward and to the sides as needed) so the entire hairstyle is fully visible, with no part of it cut off, cropped, or clipped by the image edge. Showing the complete hairstyle takes priority over preserving the exact original crop dimensions — never truncate the hair to fit the original frame.",
    "",
    "AVOID: distorted faces, extra fingers or body parts, duplicated hair, unnatural hairlines, blurry or melted braids, tangled or fused braids, inconsistent braid thickness, impossible scalp sections, floating hair, excessive smoothing, plastic-looking skin, unrealistic shine, or any change to clothing or background.",
    "",
    "COLOUR: if a hair colour is specified, change only the hair colour — keep the customer's natural skin tone and every other colour unchanged.",
    "",
    "The final result must look like a professional salon photograph — premium, trustworthy, and realistic, so the customer feels like they're seeing themselves wearing the style, not looking at a generated stranger.",
  ].join("\n");
}
