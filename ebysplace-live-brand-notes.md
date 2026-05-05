# Eby’s Place Live Brand Notes

Source reviewed: https://ebysplace.com/ on 2026-05-05.

The live site presents Eby’s Place as a luxury, pain-free braiding brand. The hero uses a full-bleed monochrome braid photograph/video background with a dark gradient overlay and a warm brown translucent rectangular overlay. Navigation is minimal, uppercase, and spread across the top. The visible logo is text-based, reading “EBY’S PLACE”.

The primary visual palette observed in the first viewport is dark charcoal/black, warm espresso brown, champagne/gold accents, off-white text, and muted taupe/beige overlays. The hero headline combines a large high-contrast serif style for “Zero pain. Zero trauma.” with an elegant italic champagne-gold line for “Just perfection.” Supporting labels and navigation use small uppercase letter-spaced text.

The page content emphasizes pain-free braiding, zero tension, follicle protection, premium service, and calm luxury. Key sections observed from the page text include the hero, “The truth no one says,” “Curated Perfection,” “The Experience,” “The Collection,” “The Pain-Free Guarantee,” reviews, newsletter, and footer. Product cards shown on the live site include 4X Pre Stretched Hair 38", Silky French Curl, and 32" Deep Wave Bulk.

Implementation implications: align global colours to dark charcoal, espresso brown, champagne gold, warm cream, and taupe; use a stronger serif display treatment with italic gold accents; prefer full-bleed braid imagery and subtle dark overlays; preserve existing functionality while adapting project backgrounds and image treatments to this live brand language.

## Parsed Live-Site Tokens and Assets

The live site loads Google fonts with `Lexend`, `Montserrat`, and `Playfair Display`. The current project should use `Playfair Display` for large editorial display headings and italic gold accents, with `Montserrat` or `Lexend` for clean uppercase navigation, body labels, buttons, and supporting text.

| Brand element | Live-site evidence | Project direction |
|---|---|---|
| Primary dark | `#1A1A1A`, `#2A1A12` | Use charcoal and espresso as main backgrounds. |
| Accent gold | `#C2A378`, `#CFA876` | Use champagne gold for CTAs, pills, highlights, and italic display words. |
| Warm cream | `#F4EFE6`, `#FCFBF8`, `#FDFCFB` | Use for light sections and elevated card surfaces. |
| Deep burgundy | `#800020`, `#52201C` | Use sparingly for rich contrast and luxury detail. |
| Muted taupe | `#6B5749` | Use for secondary copy and panel overlays. |
| Typography | `Playfair Display`, `Montserrat`, `Lexend` | Match the live-site hierarchy and uppercase tracking. |

Key live-site imagery found in the DOM includes the Cloudinary hero video `https://res.cloudinary.com/dfbweqelf/video/upload/v1774527976/Ebys_Place_Header_Video_lueve9.mp4`, service images for knotless braids, box braids, lemonade braids, and boho braids, an appointment/studio Unsplash image, and product images for 4X Pre Stretched Hair, French Curls Bone Straight, and 32 Deep Wave Bulk. These assets should guide the project’s updated homepage hero, service cards, and product presentation.

Product image URLs identified on ebysplace.com are:

| Product | Live image URL |
|---|---|
| 4X Pre Stretched Hair | `https://res.cloudinary.com/dfbweqelf/image/upload/q_auto/f_auto/v1775901387/Gemini_Generated_Image_dsfcb9dsfcb9dsfc_jb9ldo.png` |
| French Curls Bone Straight | `https://res.cloudinary.com/dfbweqelf/image/upload/q_auto/f_auto/v1775908472/Gemini_Generated_Image_9rifac9rifac9rif_wcol7o.png` |
| 32 Deep Wave Bulk | `https://res.cloudinary.com/dfbweqelf/image/upload/q_auto/f_auto/v1775909268/Gemini_Generated_Image_jnptwdjnptwdjnpt_3_gopnhg.png` |

Service image URLs identified on ebysplace.com include:

| Service | Live image URL |
|---|---|
| Knotless Braids | `https://res.cloudinary.com/dfbweqelf/image/upload/v1774685398/1774615605353_u46ye4.png` |
| Box Braids | `https://res.cloudinary.com/dfbweqelf/image/upload/v1774696211/1774692679808_oftdgt.png` |
| Lemonade Braids | `https://res.cloudinary.com/dfbweqelf/image/upload/v1774696915/1774693278817_rptgp0.png` |
| Boho Braids | `https://res.cloudinary.com/dfbweqelf/image/upload/v1774696249/1774692951485_ssb3ci.png` |

## Live About Page Findings

The live About page is available at `https://ebysplace.com/about%20us` and uses the title “About Eby's Place | Luxury Hair Braiding Studio in Somerset.” Its hero continues the luxury editorial system with a dark, warm-brown image overlay, a small uppercase gold eyebrow line, a large Playfair-style serif headline, and an italic gold subline. The visible page text frames the brand around painless aesthetics, engineered scalp comfort, a private Somerset studio, and heritage braiding expertise.

The live About page copy includes “The Art of the Painless Aesthetic,” “From Passion to Power,” and “Hair is identity.” For the current project’s homepage About section, the user specifically asked that the description beneath the round image should show, so the implementation should expose the stored About description directly under the circular portrait instead of only relying on surrounding headings or fallback iconography.
