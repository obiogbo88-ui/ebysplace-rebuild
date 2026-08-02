-- Update men's service image URLs to use dedicated men's model photographs.
-- The old URLs pointed to shared women's style images; each men's service now
-- references its own distinct Supabase storage slot.

UPDATE public.services
SET "imageUrl" = 'https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_men_cornrows_braids_7a3f1b2e-4c8d9e0f12.png'
WHERE slug = 'men-cornrows';

UPDATE public.services
SET "imageUrl" = 'https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_men_box_braids_model_3b9c2d1a-6e4f5a7b89.png'
WHERE slug = 'men-box-braids';

UPDATE public.services
SET "imageUrl" = 'https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_men_twists_model_5d1e8f3c-2a7b4c6d90.png'
WHERE slug = 'men-twists';

UPDATE public.services
SET "imageUrl" = 'https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_locs_men_model_9f2a5c4b-1d3e7f8a06.png'
WHERE slug = 'locs-men';
