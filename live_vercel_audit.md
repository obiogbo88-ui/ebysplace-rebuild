# Live Vercel Audit Notes

The live deployment URL provided by the user is `https://ebysplace-rebuild-ii9ekp4vk-obiogbo88-uis-projects.vercel.app/`.

Initial browser navigation redirected to the Vercel login page rather than serving the Eby’s Place site. A header check returned `HTTP/2 401` from Vercel with `server: Vercel`, `x-robots-tag: noindex`, and a `_vercel_sso_nonce` cookie, which indicates the deployment is currently protected behind Vercel authentication or SSO rather than being publicly accessible.

This is a live-production issue separate from the application code: until the deployment protection is disabled or a production domain/deployment is made public, an unauthenticated visitor cannot view any route on the supplied URL. I will continue the repair pass by auditing the local production-equivalent app and source, while also tracking this Vercel access gate as a deployment setting issue to be fixed by the site owner in Vercel if necessary.

## Route Access Matrix

Every tested route on the supplied Vercel URL currently returns `401` before the application loads. The affected routes include `/`, `/services`, `/booking`, `/shop`, `/gallery`, `/ai-try-on`, `/braiders-near-me`, `/reviews`, `/admin`, policy routes, and `/api/trpc`. This means the live URL cannot yet be used for a full unauthenticated visual audit until Vercel deployment protection is disabled or the public production deployment URL is provided.

## Local Preview Homepage Findings

The local preview homepage loads and renders the Eby’s Place visual brand, navigation, hero image, service cards, shop preview, testimonials, newsletter area, About section, footer, and WhatsApp shortcut. Visible issues to investigate include the first shop-preview product displaying a price of `£0.00`, which may be a seeded product-data issue, and the need to confirm whether image URLs used on the preview are production-safe rather than relying on Manus-only `/manus-storage/*` paths.

## Local Preview Services and Booking Findings

The Services route renders multiple categories and a broader braiding catalogue in the local preview, including Knotless, Boho Goddess, Box, Goddess, Fulani, Cornrows, Stitch, Lemonade, and Tribal Braids in the first category view. This suggests the production complaint that only one service appears may be linked to production database seeding or production API access rather than the current frontend source alone.

The Booking route loads and shows a staged four-step deposit booking flow. However, the visible service selector initially exposes only five service options in the viewport metadata, which may indicate the booking page is using a limited service subset, an active-only filter, or a data-loading issue. This needs source and database inspection because the Services page shows a richer catalogue than the Booking selector excerpt.

## Local Preview Shop and Gallery Findings

The Shop route loads product cards and the checkout form, but at least one seeded product displays `£0.00`, which is inappropriate for a live shop product unless intentionally free. The shop content also includes a mix of stock statuses, and the checkout button is visible before cart population, requiring source verification for disabled-state and Stripe handoff behaviour.

The Gallery route loads filters and three visible gallery cards, but the second visible card labelled `Soft twist detail` appears as a dark/blank image area rather than a valid hairstyle image. This indicates at least one broken or unsuitable gallery image reference in the seed data or stored content. The gallery also appears underpopulated compared with the full service catalogue, so the seed pass should add more production-safe gallery entries.

## Local Preview AI Try-On and Braiders Near Me Findings

The AI Try-On route renders the upload area, original/generated panels, and a style selector, but the selector currently exposes only five styles: Knotless Braids, Box Braids, Goddess Braids, Fulani Braids, and Cornrows. The salon workflow guidance expects at least eight braid styles, including Lemonade Braids, Faux Locs, and Senegalese Twists, so this page needs a style-list expansion.

The Braiders Near Me route currently behaves mostly as a platform handoff page. It does not show a searchable directory, demo braider cards, style filters, sort controls, distance calculation, or geolocation prompts. This is a significant missing item against the Kouvia/Eby’s Place requirement: the page should be useful to customers immediately, even before live external braider registrations accumulate.

## Local Preview Reviews and Admin Findings

The Reviews route renders three seeded testimonials and a review-submission form with name, rating, experience, and moderation submission controls. The homepage repeats the same three testimonials twice in its visible markdown, so the homepage testimonial carousel/grid logic should be checked to avoid accidental duplication.

The Admin route loads successfully in the local authenticated preview and shows Overview, Bookings, Orders, Products, Services, Gallery, Reviews, and Admin Users controls. It reports 5 bookings, 0 orders, 0 pending reviews, 4 products, 22 services, and 19 AI try-ons. This means the previously reported `TypeError: Invalid URL` is likely production-environment specific, tied to Vercel runtime variables, webhook/origin construction, external analytics endpoints, image/storage URL handling, or an optional service that is present locally but not production-safe.

## Local HTTP Route Matrix

The local development server returns `200` for `/`, `/services`, `/booking`, `/shop`, `/gallery`, `/ai-try-on`, `/braiders-near-me`, `/reviews`, `/admin`, `/privacy`, `/shopping-policy`, `/returns-policy`, and `/terms`. A direct `GET /api/trpc` returns `404`, which is normal if the tRPC endpoint expects procedure-specific paths or POST/query parameters rather than a bare browser GET.

## Source Mapping Findings

The Vercel admin `TypeError: Invalid URL` maps most directly to `client/src/const.ts`. `getLoginUrl()` calls `new URL(`${oauthPortalUrl}/app-auth`)` without guarding for a missing or malformed `VITE_OAUTH_PORTAL_URL`; `useAuth()` and `DashboardLayout` can evaluate this helper while rendering the admin sign-in state, so a missing Vercel OAuth portal variable can break the page before the user can sign in.

The missing Braiders Near Me functionality maps to `client/src/pages/Braiders.tsx`, which is currently a one-line static marketing handoff to Kouvia. It does not include a usable local directory, demo braider cards, search, distance/location hints, style filters, sorting, or registration prompts.

The underpopulated gallery issue maps to `server/db.ts`, where initial gallery seed data includes only six items and is only inserted when the gallery table is empty. Existing stale or broken gallery records are therefore not repaired by normal seed execution. The same seed pattern affects products: `seedProducts` only inserts when no product exists, which means stale products such as a zero-priced public product can persist indefinitely.

Production media remains tied to `/manus-storage/*` references in `server/db.ts`, `client/src/pages/Home.tsx`, and `client/index.html`. Vercel includes a `/manus-storage/:path*` rewrite to the Express app and `server/_core/storageProxy.ts` proxies those paths through Forge, but the proxy currently returns a generic 502/500 if Forge URL values are missing or invalid. That makes graceful image fallbacks in the UI important for public pages.

The AI Try-On source file already contains a broad style list in `client/src/pages/TryOn.tsx`; the earlier five-style observation is likely stale deployment/build drift rather than a missing source-code list. This should still be validated after redeployment.

## Local visual smoke verification after repair patches

The repaired `/braiders-near-me` route now renders a useful searchable Kouvia directory preview rather than a thin handoff page. The visible page includes search by town/style/name, style and sort filters, a Use my location control, registration and Kouvia CTAs, and four demo braider cards with ratings, distances, specialties, availability, and review counts.

The repaired `/admin` route now renders a stable authenticated admin dashboard locally. The previously reported `TypeError: Invalid URL` is not visible in the local production-equivalent smoke check; the page shows role-based backend access, command-centre shortcuts, protected overview counts, analytics, recent activity, and collapsible management areas.

The repaired `/shop` route now shows visible non-zero public product prices for the seeded braid-care catalogue, including Braid Care Starter Kit at £28.00, Premium Braiding Hair at £6.50, Satin Edge Scarf at £18.00, and Scalp Comfort Oil at £14.00. The previously observed inappropriate £0.00 public product is no longer visible in the smoke check.

The repaired `/gallery` route now shows a broader gallery grid with filters for All, Braids, Twists, Locs, and Kids. Visible cards include Knotless Braids, Knotless braid finish, Box Braids, Goddess Braids, Fulani Braids, Lemonade Braids, Boho Braids, Senegalese Twists, Passion Twists, Faux Locs, Butterfly Locs, Kids Braids, and Starter Locs, with images loading in the viewport instead of a mostly underpopulated gallery.
