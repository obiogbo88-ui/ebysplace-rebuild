# Eby’s Place Production Readiness Notes

This note records the final production-readiness pass for **Eby’s Place**. The application is prepared for Vercel with Supabase PostgreSQL as the production database, Supabase public storage for media, OpenAI `gpt-image-1` for AI Try-On generation, Stripe Checkout for booking deposits and product orders, and Twilio SMS/WhatsApp for best-effort customer and owner notifications.

| Area | Production behavior after repair | Verification result |
|---|---|---|
| Database seed | Supabase/PostgreSQL has been re-seeded with the full service catalogue, shop products, product variants, approved reviews, gallery images, and website sections. | Seed verification returned **20 services**, **4 products**, **5 product variants**, **24 reviews**, **12 gallery images**, **1 website section**, and **0 inaccessible checked media URLs**. |
| Media storage | Runtime media now uses clean Supabase public URLs under `https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/`. Obsolete local/proxy storage routes were removed from Vercel routing and server startup. | Source scans found no remaining active production references to obsolete proprietary storage routes. Public services and products returned clean Supabase media URLs during local production API smoke checks. |
| AI Try-On | `server/_core/imageGeneration.ts` calls OpenAI Images directly with `OPENAI_API_KEY` and uploads generated output to Supabase storage. | Tests, TypeScript validation, production build, and source scans passed after the helper rewrite. |
| Admin panel | Admin sign-in URL generation is environment-driven and avoids invalid URL crashes when OAuth configuration is missing. Admin data routes remain API-backed and Supabase-backed. | `/admin` returned the React production shell locally, and auth configuration is documented below for Vercel. |
| Booking system | Booking submissions create Supabase-backed records, trigger best-effort owner/customer notifications, and keep the £20 Stripe deposit flow server-side. | Regression tests cover booking creation, Stripe deposit session behavior, webhook confirmation, and non-blocking notifications. |
| Stripe payments | Stripe checkout is server-side for booking deposits and shop orders. Shop order prices, product names, variants, and stock are validated against database records before checkout creation. The webhook endpoint remains `/api/stripe/webhook`. | Webhook route returned a controlled JSON error for an invalid signature locally, and tests cover live-style and `evt_test_` webhook handling. |
| Twilio SMS/WhatsApp | Twilio requests are best-effort, use a short timeout, validate sender configuration, and do not block booking, checkout, or webhook processing. | Notification tests passed, including failure and invalid phone scenarios. |
| Vercel routing | `vercel.json` routes `/api/*` to the backend and all non-API routes to the React frontend shell. | Public route smoke checks returned HTTP 200 for `/`, `/services`, `/booking`, `/shop`, `/gallery`, `/reviews`, `/policies`, `/try-on`, and `/admin`. |
| Proprietary runtime cleanup | Active production source was cleaned of obsolete proprietary storage/debug runtime paths and unused helper dependencies. | Final validation ran tests, TypeScript, production build, and source scans successfully. |

## Required Vercel environment variables

The following environment variables should be configured in Vercel before the production domain is considered live. Values should be entered directly in Vercel Project Settings and must not be committed to the repository.

| Variable | Required | Purpose | Notes |
|---|---:|---|---|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string for content, bookings, orders, admin data, reviews, and gallery data. | Use the pooled/SSL-compatible Supabase database URL where possible. |
| `SUPABASE_URL` | Yes | Base Supabase project URL. | Expected project: `https://jcyoipbiplzrocrrhwkp.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase storage access for uploads and generated Try-On images. | Keep server-only; never expose in browser variables. |
| `OPENAI_API_KEY` | Yes | OpenAI image generation for AI Try-On and any standard OpenAI server helpers. | Used server-side by `gpt-image-1` image generation. |
| `STRIPE_SECRET_KEY` | Yes | Server-side Stripe Checkout sessions and webhook handling. | Use test keys until Stripe live mode is ready. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Yes | Browser-side Stripe publishable key. | Must match the same Stripe mode as `STRIPE_SECRET_KEY`. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Verifies `/api/stripe/webhook` signatures. | Configure the webhook URL in Stripe as `https://<production-domain>/api/stripe/webhook`. |
| `VITE_APP_ID` | Required for admin OAuth | Admin authentication application ID. | Without this, `/admin` shows a configuration warning instead of opening a broken sign-in URL. |
| `VITE_OAUTH_PORTAL_URL` | Required for admin OAuth | OAuth portal base URL. | Must be a valid HTTPS URL in Vercel. |
| `JWT_SECRET` | Yes | Signs/validates server session cookies. | Use a long random value. |
| `OAUTH_SERVER_URL` | Required for admin OAuth | Server-side OAuth backend URL. | Must match the OAuth provider used for the admin app. |
| `OWNER_NAME` | Recommended | Owner display name in admin/session contexts. | Used for owner/account-facing copy. |
| `OWNER_OPEN_ID` | Required for owner admin session flows | Owner identity mapping. | Required if OAuth owner role checks are used. |
| `EBYSPLACE_OWNER_PHONE_E164` | Recommended | Owner phone for operational notifications. | Use E.164 format, for example `+447...`. |
| `TWILIO_ACCOUNT_SID` | Recommended | Twilio account identifier. | Required for SMS/WhatsApp notifications. |
| `TWILIO_AUTH_TOKEN` | Recommended | Twilio API credential. | Required for SMS/WhatsApp notifications. |
| `TWILIO_SMS_FROM` | Recommended | SMS sender number. | Must be a valid Twilio sender, usually E.164. Invalid values are skipped safely. |
| `TWILIO_WHATSAPP_FROM` | Optional | WhatsApp sender. | Use Twilio format such as `whatsapp:+14155238886` when WhatsApp is approved/configured. |
| `VITE_ANALYTICS_ENDPOINT` | Optional | Analytics endpoint if production analytics are enabled. | Leave unset if not used. |
| `VITE_ANALYTICS_WEBSITE_ID` | Optional | Analytics site ID if production analytics are enabled. | Leave unset if not used. |
| `VITE_APP_TITLE` | Recommended | Browser/app title. | Suggested value: `Eby’s Place`. |
| `VITE_APP_LOGO` | Optional | Public logo URL. | Use a Supabase public media URL if configured. |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional | Frontend Google Maps key for map features. | Only needed if map-based features are enabled. |
| `GOOGLE_MAPS_API_KEY` | Optional | Server-side Google Maps API key. | Only needed for server-side map/geocoding helpers. |

## Cloudflare access and DNS handoff

Cloudflare access should be granted through the Cloudflare dashboard rather than by sharing passwords in chat. Cloudflare documents account collaboration through **Account Members**, where members receive policies with roles and scopes, and adding a member requires a Super Administrator with a verified email address.[1] If you want me or another collaborator to help with DNS, invite that collaborator from **Cloudflare Dashboard → Manage Account → Members → Invite**, scoped only to the relevant account/zone for `ebysplace.com`.

Vercel custom domains are added from a project’s **Settings → Domains** area, and Vercel displays the required DNS records after the domain is added.[2] For `ebysplace.com`, the safest cutover is to add both `ebysplace.com` and `www.ebysplace.com` to the Vercel project first, then copy the exact DNS records Vercel provides into Cloudflare. Vercel’s documentation notes that apex domains use an **A record**, subdomains use a **CNAME record**, and verification may require a **TXT record** if the domain is already associated elsewhere.[2]

| Step | Action | Owner |
|---|---|---|
| 1 | Add `ebysplace.com` and `www.ebysplace.com` in Vercel Project Settings → Domains. | Site owner or Vercel admin |
| 2 | In Cloudflare, invite the collaborator with narrowly scoped DNS access for the `ebysplace.com` zone, or use browser takeover so you remain in control. | Cloudflare Super Administrator |
| 3 | Add the DNS records shown by Vercel in Cloudflare DNS. | Cloudflare DNS editor |
| 4 | Keep existing email records, TXT verification records, and any business-critical DNS records unchanged unless Vercel explicitly requires a change. | Cloudflare DNS editor |
| 5 | Confirm Vercel domain verification, SSL issuance, `/api/*` routes, Stripe webhook URL, admin sign-in, booking deposit checkout, shop checkout, AI Try-On, and public image loading. | Site owner and deployment operator |
| 6 | If anything fails, revert the DNS record change in Cloudflare and keep the Vercel deployment available through its generated Vercel URL while troubleshooting. | Cloudflare DNS editor |

## Final validation performed

The final validation pass completed successfully after the cleanup and production rewrites. Automated regression tests passed with **12 test files** and **63 tests** passing. TypeScript validation completed with `tsc --noEmit`, and the Vite/esbuild production build completed successfully. Local production route smoke checks returned HTTP 200 for the primary React routes, while public tRPC smoke checks confirmed that `public.services` and `public.products` return Supabase-backed data and clean Supabase media URLs.

> Deployment note: If Vercel is connected to the GitHub production branch, pushing the final commit to GitHub should trigger automatic redeployment. If Vercel is not connected or automatic deployments are disabled, redeploy from the Vercel dashboard after the GitHub sync completes.

## References

[1]: https://developers.cloudflare.com/fundamentals/manage-members/manage/ "Cloudflare Docs: Manage account members"
[2]: https://vercel.com/docs/domains/working-with-domains/add-a-domain "Vercel Docs: Adding & Configuring a Custom Domain"
