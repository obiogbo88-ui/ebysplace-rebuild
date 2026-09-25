export function buildTryOnPrompt(styleName: string): string {
  return [
    "You are performing a photorealistic hairstyle try-on edit for a premium hair salon, not a full portrait regeneration. The uploaded photo is the ground truth reference — treat it as immutable.",
    "",
    "PRESERVE THE PERSON (do not alter, even slightly): the customer's exact facial identity and facial structure — eyes, eyebrows, nose, lips, ears, jawline, face shape, skin tone, complexion, age, and any facial hair. Do not beautify, reshape, retouch, or smooth the face. The result must be recognisably the same person, not a different model.",
    "",
    "PRESERVE THE ORIGINAL PHOTO: keep the original camera angle, body position, proportions, clothing, background, and lighting/shadows exactly as they are. Do not generate a new photograph — only edit the hair region of this one.",
    "",
    "PRESERVE THE ORIGINAL FRAMING AND ZOOM (critical): the head and face must stay at the exact same size, scale, distance-from-camera and position within the frame as in the uploaded photo — this is a hair swap on the existing photo, not a recomposed or re-cropped shot. Do not zoom in, zoom out, shrink the subject, or move the subject to make hair fit. The amount of background and headroom visible above the head, and the amount of shoulders/chest visible below, must match the original photo, not be reduced or enlarged.",
    "",
    `HAIRSTYLE ACCURACY: apply ${styleName} realistically to the customer's actual hairline and head shape. Respect the natural hairline, follow the head shape, and ensure the style originates naturally from the scalp with realistic sections and parting — no floating, pasted-on, or helmet-like hair. Hair must have realistic texture, density, thickness, and direction, and interact naturally with the forehead, ears, neck, and shoulders. Reproduce ${styleName} accurately and specifically (e.g. knotless braids need realistic knotless roots and clean sections; box braids need clearly defined square sections and consistent thickness; cornrows need clean scalp-parted rows; locs/faux locs need realistic individual loc formations, separation, and texture; twists need a recognisable twisted texture) rather than a generic approximation.`,
    "",
    "IF LONGER HAIR NEEDS MORE ROOM: keep the head and face fixed at the original scale and position (per PRESERVE THE ORIGINAL FRAMING AND ZOOM above) and, only if the style genuinely will not fit, extend the canvas outward by adding more of the same background/clothing beyond the original edges — never by zooming out or shrinking the subject to squeeze more in. No part of the hairstyle should be cut off, cropped, or clipped by the image edge, but that is solved by giving the hair more canvas, not by making the person smaller.",
    "",
    "HEADROOM CHECK: before finalising, confirm the very top of the head (hairline, crown, and any hair standing or flowing upward) sits fully inside the canvas with the same visible background above it as the original photo had — no more, no less. If any part of the head or hair touches or is cut by the top edge, extend the canvas upward (adding background) rather than zooming out.",
    "",
    "AVOID: distorted faces, extra fingers or body parts, duplicated hair, unnatural hairlines, blurry or melted braids, tangled or fused braids, inconsistent braid thickness, impossible scalp sections, floating hair, excessive smoothing, plastic-looking skin, unrealistic shine, or any change to clothing or background.",
    "",
    "COLOUR: if a hair colour is specified, change only the hair colour — keep the customer's natural skin tone and every other colour unchanged.",
    "",
    "The final result must look like a professional salon photograph — premium, trustworthy, and realistic, so the customer feels like they're seeing themselves wearing the style, not looking at a generated stranger.",
  ].join("\n");
}
