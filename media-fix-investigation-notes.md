# Media Fix Investigation Notes

The current Supabase inspection confirmed that all four product rows in the `products` table have public Supabase URLs under the `ebysplace-media` bucket and each URL returned HTTP 200 via `HEAD`. The product image keys currently referenced are service-style image assets: `ebysplace_service_edge_control_styling_675ed964-0d252ca79f.png`, `ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png`, `ebysplace_service_beads_accessories_05425a55-585b8bc439.png`, and `ebysplace_service_boho_braids_ee8557bc-0b74da3a99.png`.

The `about_us` website section currently has both `imageUrl` and `portraitImageUrl` set to empty strings in Supabase, so the CEO/About portrait cannot load on Vercel. The seed data in `server/db.ts` also has empty About image fields, meaning a fallback database path would continue to render a placeholder unless updated.

The Home page shop preview currently renders product cards without an `<img>` tag, so product images cannot appear in that preview even when product image URLs are valid. The Shop page does render `product.imageUrl`, but it does not include an error fallback.

A broad image search for an exact public CEO/founder portrait did not reveal a reliable matching Eby’s Place founder portrait. Available local Supabase-migration assets include brand/logo images and service/product-style images, but no clearly identifiable CEO portrait file.

## Visual asset review

The first generated About portrait fallback was created from the link-preview artwork and uploaded successfully, but visual inspection showed a partial `Bea` text fragment in the lower-right crop. The separate cropped logo asset contains the full Eby’s Place mark with a clean silhouette and transparent/dark background, making it a better source for a circular branded About portrait fallback than the link-preview crop.
