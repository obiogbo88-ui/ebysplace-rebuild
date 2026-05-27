# Virtual Braid Try-On

This standalone feature is now named **Virtual Braid Try-On** and is ready for later integration into `ebysplace.com`.

## What changed

- The generation flow now uses **one single identity-lock prompt builder** in `app.js`: `buildIdentityLockedBraidPrompt(selectedStyle)`.
- Old prompt fragments, legacy instructions, and fallback prompt paths are removed from this standalone flow.
- The AI edit mask is restricted to the hair and braid region while the face area is explicitly protected.
- After AI generation returns, the original uploaded face region is composited back onto the result using a soft feathered blend.
- The displayed preview uses the final face-locked composite image.
- The downloaded image uses the same final face-locked composite image.

## Architecture

- `index.html` contains the user-facing Virtual Braid Try-On interface and copy.
- `app.js` handles upload, style selection, single prompt generation, hair-focused mask preparation, face-lock compositing, preview, download, and 3-attempts-per-device tracking with a dynamic 24-hour refresh countdown.
- `api/tryon.php` keeps the API key server-side and sends only the cleaned single prompt flow plus image/mask payload to the image editing model.

## Security

- API keys are server-side only (`OPENAI_API_KEY`) inside `api/tryon.php`.
- No API key or sensitive server configuration is exposed to the frontend.
