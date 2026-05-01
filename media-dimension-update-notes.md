# Eby’s Place Media Dimension and Background Update Notes

This update aligns the rebuilt Eby’s Place media presentation more closely with the current public Eby’s Place website while keeping the rebuilt site responsive and deployment-safe.

## Reference and implementation summary

| Area | Target behaviour | Implementation |
|---|---|---|
| Homepage video | The landing video should feel like the current Eby’s Place large hero video area rather than a small card | `Home.tsx` now renders the landing video as a full-width hero panel using `.hero-video-reference`, with `min-height: calc(100vh - 5rem)` on desktop and `calc(100svh - 5rem)` on mobile. |
| Service images | Service cards should use consistent portrait-style salon imagery similar to the current Eby’s Place service media | `Home.tsx` and `Services.tsx` now use the shared `.media-portrait` utility for each service image. |
| Gallery images | Gallery thumbnails should share the same exact portrait frame treatment as service imagery | `Gallery.tsx` now uses `.media-portrait` for gallery thumbnails. |
| Admin uploads | Uploaded service and gallery image previews should match the public display dimensions before publishing | `Admin.tsx` now uses `.media-portrait` for service upload thumbnails and gallery upload previews. |
| Background brightness | The site should be a bit lighter while preserving the black-and-gold luxury identity | `index.css` uses lighter OKLCH background/card tokens, a warmer brown-black shell gradient, and lighter translucent section surfaces such as `bg-white/[0.04]` and `bg-white/[0.045]`. |

## Shared CSS definitions

The shared dimension rules are in `client/src/index.css`:

```css
.media-portrait { aspect-ratio: 4 / 5; }
.media-portrait img,
.media-portrait video { width: 100%; height: 100%; object-fit: cover; }
.hero-video-reference { min-height: calc(100vh - 5rem); }
@media (max-width: 767px) { .hero-video-reference { min-height: calc(100svh - 5rem); } }
```

The global background is now slightly lighter and warmer through the following token and shell updates:

```css
--color-background: oklch(0.135 0.014 70);
--color-card: oklch(0.18 0.018 70);
.luxury-shell {
  background: radial-gradient(circle at 20% 5%, rgba(216,184,102,.25), transparent 34%),
    radial-gradient(circle at 86% 10%, rgba(176,113,48,.2), transparent 36%),
    linear-gradient(135deg, #120d08 0%, #24180d 48%, #11100d 100%);
}
```

## Verification evidence

The focused verification completed after the changes:

| Check | Result |
|---|---|
| Vitest | Passed: 2 test files, 9 tests |
| TypeScript | Passed with no reported errors |
| Production build | Passed; Vite emitted only the existing large-chunk advisory |
| Server restart | Passed; development server running |
| Responsive viewport check | Passed across home, services, booking, gallery, and admin at mobile 390px, tablet 768px, and desktop 1440px with `0px` horizontal overflow on every page |

