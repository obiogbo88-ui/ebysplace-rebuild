# Project TODO

- [x] Preserve Eby’s Place brand identity with consistent black-and-gold luxury styling, premium typography, refined copy, and mobile-friendly layouts across all public and admin pages
- [x] Build homepage hero section with luxury pain-free braiding positioning and primary booking CTA
- [x] Build homepage pain-free philosophy section focused on scalp health, tension-free styling, edge protection, and comfort
- [x] Build homepage popular styles grid with duration, pricing, and direct booking CTAs
- [x] Build homepage experience highlights section covering structured scheduling, calm studio experience, family-friendly care, and premium comfort
- [x] Build homepage shop preview section with product cards and add-to-bag entry points
- [x] Build homepage testimonials carousel sourced from approved live reviews
- [x] Build homepage newsletter signup form and footer navigation
- [x] Build services and pricing page with category tabs for Braids, Twists, Locs, Kids Styles, and Add-ons
- [x] Build service cards with duration, prices, descriptions, and “Book This Style” CTAs linked to the booking flow
- [x] Build appointment booking flow with service selection, date picker, time picker, client details, phone, email, and delivery address capture
- [x] Integrate Stripe for exactly £20 non-refundable booking deposit payment messaging and checkout flow
- [x] Build ecommerce shop with product listings, colour variant selectors, stock badges, and add-to-bag functionality
- [x] Build cart management with item quantity updates, removal, delivery address capture, and checkout flow
- [x] Build order management data model and admin order tracking views
- [x] Build AI Hairstyle Try-On feature with S3-first image upload, braid style selector, face-preserving prompt, generated preview, and result display
- [x] Build Braiders Near Me page with clear CTA handoff to the SaaS platform for customer matching and braider registration
- [x] Build gallery page with category filters and modal/lightbox for individual hairstyle images
- [x] Build secure role-based admin dashboard using authenticated admin access
- [x] Build admin content management tools for homepage sections and website copy
- [x] Build admin services and pricing editor
- [x] Build admin bookings manager with booking status and deposit status visibility
- [x] Build admin shop, orders, product, price, stock, variant, and image management tools
- [x] Build admin gallery uploader and gallery management view using S3 references rather than local media storage
- [x] Build customer review submission with star ratings and review text
- [x] Build admin review moderation workflow and approved-review homepage display
- [x] Build site analytics overview in the admin dashboard using live platform analytics where available and internal summary metrics
- [x] Implement SEO metadata across pages with keyword-rich titles, meta descriptions, Open Graph tags, and LocalBusiness JSON-LD
- [x] Add robots.txt and sitemap.xml
- [x] Add or update Vitest tests covering core backend procedures and role restrictions
- [x] Run type checks, tests, and project status validation before delivery

- [x] Refine site colours and theme to match the current Eby’s Place website more closely rather than the earlier darker premium variation
- [x] Add the provided Eby’s Place logo across the header, hero, footer, and metadata where appropriate using web-safe asset handling
- [x] Replace the generic “Premium black-and-gold braiding salon” badge copy with the Eby’s Place slogan “Zero pain. Zero trauma. Just perfection.”
- [x] Adjust homepage wording and section copy to follow the original Eby’s Place write-up and tone more closely
- [x] Add a dedicated homepage video placeholder area for the current Eby’s Place video to be embedded later
- [x] Re-check automation coverage for bookings, Stripe deposit flow, orders, reviews, admin moderation, AI try-on, newsletter, and owner/admin monitoring flows
- [x] Verify and improve desktop and mobile responsive layouts after the brand refinements

- [x] Expand the Eby’s Place service catalogue to include all observed braiding styles and services, including Knotless Braids, Box Braids, Goddess Braids, Fulani Braids, Cornrows, Stitch Braids, Lemonade Braids, Boho Braids, Tribal Braids, Twists, Locs, Kids Styles, and Add-ons
- [x] Ensure the expanded service catalogue appears consistently on the Services page, booking service selector, homepage style areas, and admin service management tools

- [x] Blend the Eby’s Place logo into the page background without visible boxed boundaries while preserving strong contrast and brand visibility
- [x] Adjust surrounding colours and hero/header treatment so the logo stands out naturally against the black-and-gold palette
- [x] Create HD model imagery matched to the correct service categories and styles for the services and gallery experience
- [x] Add service image support so admin users can upload and update images for individual services
- [x] Add gallery image upload support so admin users can upload new gallery images directly instead of pasting URLs only
- [x] Verify the new media workflows with Vitest coverage, TypeScript checks, and responsive status validation

- [x] Complete Stripe checkout integration for booking deposits with dynamic success and cancellation redirects
- [x] Add Stripe webhook handling for deposit payment confirmation and test webhook verification
- [x] Update booking payment status automatically after successful Stripe checkout or webhook events
- [x] Send automated owner notifications when bookings and Stripe deposit events occur, with existing admin monitoring for orders, reviews, and related dashboard events
- [x] Send automated customer/user notifications for booking submission, deposit checkout, and payment confirmation through in-app toasts and confirmation pages
- [x] Add automated tests covering Stripe checkout metadata, webhook behaviour, and notification-triggered booking/payment flows

- [x] Match every HD model image to the exact service name in the catalogue so image titles, alt text, service cards, and gallery labels use names such as “Knotless Braids”, “Box Braids”, and “Goddess Braids” without generic labels

- [x] Locate the current Eby’s Place landing video source and embed or mirror it into the new homepage landing section when technically accessible and appropriate
- [x] If the current landing video cannot be directly reused, keep a polished branded video area ready for the owner to upload or replace the source later

- [x] Run a full final test pass after all requested branding, media, upload, Stripe, and notification work is complete, including automated tests, TypeScript/build checks, server health, and responsive/status validation
- [x] Run and document explicit final responsive verification across home, services, booking, gallery, and admin at mobile, tablet, and desktop breakpoints after the last asset and UI changes
- [x] Match the homepage video block dimensions, service image dimensions, gallery image dimensions, and admin upload preview dimensions to the current Eby’s Place website as closely as possible while preserving responsive behaviour
- [x] Make the overall website background a bit lighter while preserving the Eby’s Place black-and-gold brand feel and readable contrast
- [x] Make selecting a booking style advance the customer through a clear staged flow until deposit payment
- [x] Enlarge and embolden the Eby’s Place logo so it is readable in the header, hero, and key branded areas
- [x] Remove the shaded overlay treatment from the “Luxury Pain-Free Braiding” hero write-up card while preserving text readability
- [x] Verify whether the AI Try-On feature is usable now and fix any blocking issue found in the upload/style/generation flow

- [x] Fix AI Try-On image-reading failures for prepared customer photos, including HEIC/iPhone conversion support, signed image URLs for generation, high-contrast readable errors, tests, build, and health verification
- [x] Remove the logo overlay from the landing page hero photo while preserving the existing landing structure
- [x] Broaden/enlarge the remaining top and lower Eby’s Place logo treatments for stronger readability
- [x] Shift the current Eby’s Place landing look to a lighter background and increase write-up contrast/readability
- [x] Allow admin users to edit product names from the product management interface
- [x] Add SEO-optimized product metadata fields for shop products, including SEO title, SEO description, and URL slug where appropriate
- [x] Ensure edited product names and SEO metadata are used consistently in the shop/admin UI and covered by automated tests
- [x] Verify and adjust every main page for clean mobile and desktop views, including Home, Services, Booking, Shop, AI Try-On, Braiders Near Me, Gallery, Reviews, and Admin
- [x] Ensure product name and SEO metadata changes are visible, editable, and refreshed in the admin dashboard as well as the public shop
- [x] Let customers click available product colours/variants and see the product presentation update to match the selected colour
- [x] Uplift the shop page buying experience with clearer selected-colour feedback, stronger product visuals, and improved add-to-bag interactions
- [x] Recreate the About Us section using the current ebysplace.com About Us visual style and tone while fitting the rebuilt site structure
- [x] Add concise About Us copy that tells the Eby’s Place story from passion to power
- [x] Leave a dedicated CEO image space in About Us that can be uploaded and managed from the admin dashboard/backend
- [x] Ensure the About Us section and CEO image upload workflow are responsive on mobile and desktop
