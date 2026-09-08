// These used to point at "ebysplace_service_*" files at the bucket root.
// Those objects were relocated under a "manus-storage/" prefix at some point
// and are now 404s at the paths below — see the "services/*" uploads instead,
// which are the current admin-curated photos and what these now point to.
const SERVICE_IMAGE_FALLBACKS: Record<string, string> = {
  "knotless-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780485392787-knotless-braids-1000287170_d39f6d6a.jpg",
  "box-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780488974029-box-braids-box-braid-by-ebys-place_dad6680b.jpg",
  "goddess-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780490107616-goddess-braids-goddess-braid-by-ebysplace_04edadf7.jpg",
  "fulani-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1785706279507-fulani-braids-fulani-braids-by-ebys-place_7a0556dc.jpg",
  "cornrows": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780860772549-cornrows-mens-cornrow-at-ebysplace_371d862a.jpg",
  "stitch-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_stitch_braids_562f3424-edda69b630.png",
  "lemonade-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780489878516-lemonade-braids-lemonade-braid-by-ebysplace_3637a926.jpg",
  "boho-goddess-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1781628724885-boho-braids-boho-braids-by-ebysplace_bfd33320.jpg",
  "tribal-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_tribal_braids_f0ce8622-90e4a26bf0.png",
  "senegalese-twists": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1785706312948-senegalese-twists-senegalese-twist-by-ebys-plaace_1cea93e3.jpg",
  "passion-twists": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1785706389348-passion-twists-passion-twist-by-ebys-place_40223b6b.jpg",
  "faux-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1781629405215-faux-locs-faux-locs-by-ebysplace_19d44a09.jpg",
  "butterfly-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1781630201149-butterfly-locs-butterfly-locs-by-ebys-place_ca5db6e7.jpg",
  "starter-locs": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780861744058-starter-locs-mens-starter-locs_e7d58062.jpg",
  "kids-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1781630816392-kids-braids-kids-braids_4a38f678.jpg",
  "kids-cornrows": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png",
  "kids-box-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1781631205850-kids-box-braids-kids-box-braids_e2317782.jpg",
  "kids-knotless-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1781630789368-kids-knotless-braids-kids-braids_33a7ffcd.jpg",
  "kids-twists": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1785707118528-kids-twists-kids-twist-by-ebysplace_33378b31.jpg",
  "back-to-school-styles": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_kids_cornrows_e12e1096-6893e96fa8.png",
  "men-cornrows": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780860772549-cornrows-mens-cornrow-at-ebysplace_371d862a.jpg",
  "men-box-braids": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780488974029-box-braids-box-braid-by-ebys-place_dad6680b.jpg",
  "men-twists": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1785706312948-senegalese-twists-senegalese-twist-by-ebys-plaace_1cea93e3.jpg",
  "fulani-braids-men": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1785706279507-fulani-braids-fulani-braids-by-ebys-place_7a0556dc.jpg",
  "locs-men": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/services/1780861744058-starter-locs-mens-starter-locs_e7d58062.jpg",
  "hair-wash-prep": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png",
  "beads-accessories": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png",
  "edge-control-styling": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_edge_control_styling_675ed964-0d252ca79f.png",
  "braid-takedown": "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_braid_takedown_6240fcb4-8c93f3e6e6.png",
};

function slugifyServiceName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type ServiceImageReference = {
  imageUrl?: string | null;
  slug?: string | null;
  name?: string | null;
  fallbackImageUrl?: string | null;
};

export function getServiceImageFallback(service: ServiceImageReference) {
  if (service.fallbackImageUrl) return service.fallbackImageUrl;
  if (service.slug && SERVICE_IMAGE_FALLBACKS[service.slug]) return SERVICE_IMAGE_FALLBACKS[service.slug];
  if (service.name) return SERVICE_IMAGE_FALLBACKS[slugifyServiceName(service.name)] || null;
  return null;
}

export function getServiceImageSrc(service: ServiceImageReference) {
  return service.imageUrl || getServiceImageFallback(service);
}

/**
 * Shared onError handler for service-image <img> tags: swap to the known
 * fallback once, and if that also fails (or there's no fallback), hide the
 * image's container instead of leaving a broken-image glyph on the page.
 */
export function createServiceImageErrorHandler(
  service: ServiceImageReference,
  containerSelector = ".media-portrait, .media-service"
) {
  return (event: { currentTarget: HTMLImageElement }) => {
    const img = event.currentTarget;
    const fallback = getServiceImageFallback(service);
    if (fallback && img.src !== fallback) {
      img.src = fallback;
      return;
    }
    const container = img.closest(containerSelector) as HTMLElement | null;
    if (container) container.style.display = "none";
  };
}
