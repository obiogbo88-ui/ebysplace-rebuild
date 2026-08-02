export type BlogPostSection = {
  heading: string;
  paragraphs: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  publishDate: string;
  readTime: string;
  imageUrl: string;
  imageAlt: string;
  featured?: boolean;
  sections: BlogPostSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "prepare-for-your-braid-appointment",
    title: "How to prepare for your braid appointment",
    category: "Appointment prep",
    excerpt: "The simple checklist we recommend before you arrive so your braids install smoothly, comfortably, and on time.",
    publishDate: "2026-07-10",
    readTime: "4 min read",
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png",
    imageAlt: "Hair wash and braid prep essentials laid out for an Eby’s Place appointment",
    featured: true,
    sections: [
      {
        heading: "Arrive with your style goals ready",
        paragraphs: [
          "Bring one or two reference photos and know the finish you want: neat everyday braids, a fuller statement look, or a lightweight protective style. Clear inspiration shortens consultation time and helps us guide you toward the right size, length, and finish.",
          "If you are unsure which option suits your scalp, schedule, or maintenance routine, we can help you choose at the chair.",
        ],
      },
      {
        heading: "Prep your hair and scalp gently",
        paragraphs: [
          "Detangle carefully before your appointment and avoid heavy product build-up. A clean, comfortable scalp supports a smoother install and helps your parts stay crisp for longer.",
          "If you need prep support, choose a service add-on so wash, blow-dry, or braid prep is handled professionally before installation begins.",
        ],
      },
      {
        heading: "Plan for comfort after your visit",
        paragraphs: [
          "Protective styling should still feel light and manageable once you leave. Have your scarf, bonnet, or aftercare ready at home so the style keeps its finish from day one.",
          "If this is your first braided install in a while, allow a calmer evening afterward so your scalp can settle without extra tension from constant restyling.",
        ],
      },
    ],
  },
  {
    slug: "make-knotless-braids-last-longer",
    title: "How to make knotless braids last longer",
    category: "Aftercare",
    excerpt: "A realistic maintenance routine for keeping knotless braids fresh, tidy, and comfortable between appointments.",
    publishDate: "2026-07-18",
    readTime: "5 min read",
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png",
    imageAlt: "Fresh knotless braids styled with a glossy, neat finish",
    featured: true,
    sections: [
      {
        heading: "Protect the style every night",
        paragraphs: [
          "Night protection makes the biggest difference. Wrap the edges and cover the full length with satin so the braids do not dry out, frizz up, or rub against cotton pillowcases.",
          "If you train, travel, or wear your hair down often, this step becomes even more important for preserving a polished finish.",
        ],
      },
      {
        heading: "Keep your scalp moisturised, not overloaded",
        paragraphs: [
          "Use light products and apply them intentionally between parts instead of coating the entire style. The goal is comfort and balance, not shine at the cost of build-up.",
          "Too much oil, mousse, or edge product can make a newer style look older much faster, especially around the hairline.",
        ],
      },
      {
        heading: "Know when to refresh instead of forcing extra wear",
        paragraphs: [
          "A refresh works well when the length still looks good but the front, crown, or nape need attention. That approach keeps the style looking premium without the stress of over-wearing it.",
          "If your roots, scalp, or braids are telling you it is time, book earlier rather than waiting until the style becomes uncomfortable.",
        ],
      },
    ],
  },
  {
    slug: "choose-the-right-protective-style",
    title: "Choosing the right protective style for your schedule",
    category: "Style guide",
    excerpt: "The best protective style is not just about trend or length. It also has to match your routine, maintenance time, and comfort level.",
    publishDate: "2026-07-26",
    readTime: "4 min read",
    imageUrl: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_boho_braids_ee8557bc-0b74da3a99.png",
    imageAlt: "Boho braids with soft curly ends styled for a premium finish",
    featured: true,
    sections: [
      {
        heading: "Match the style to your week",
        paragraphs: [
          "If you need a low-fuss finish for work, school runs, travel, or gym days, neat braid structures and cleaner ends are often easier to maintain. If you love softness and movement, choose a style knowing it may need more daily attention.",
          "A style that suits your actual routine will feel better for longer than one chosen only because it looks good in a photo.",
        ],
      },
      {
        heading: "Think about maintenance before length",
        paragraphs: [
          "Longer hair can be beautiful, but it changes the wear experience. More length often means more weight, more friction, and more time spent preserving the finish at night.",
          "If you are prioritising comfort, a balanced length can still look luxurious while being easier to manage.",
        ],
      },
      {
        heading: "Use consultation to avoid regret",
        paragraphs: [
          "Your stylist should help you weigh scalp sensitivity, tension preference, and how long you plan to keep the style in. Those details matter just as much as the final look.",
          "When in doubt, choose the option that protects your scalp first. Great braids should look polished without feeling punishing.",
        ],
      },
    ],
  },
];

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
