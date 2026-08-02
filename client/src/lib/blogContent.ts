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
  galleryImages?: Array<{ url: string; alt: string }>;
  references?: string[];
  sections: BlogPostSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "make-knotless-braids-last-longer",
    title: "How to make knotless braids last longer",
    category: "Aftercare",
    excerpt:
      "A realistic maintenance routine for keeping knotless braids fresh, tidy, and comfortable between appointments.",
    publishDate: "2026-07-18",
    readTime: "5 min read",
    imageUrl:
      "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_hair_wash_prep_ccec3da2-22210fa889.png",
    imageAlt: "Hair wash and preparation for protective braiding aftercare",
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
    excerpt:
      "The best protective style is not just about trend or length. It also has to match your routine, maintenance time, and comfort level.",
    publishDate: "2026-07-26",
    readTime: "4 min read",
    imageUrl:
      "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_tribal_braids_f0ce8622-90e4a26bf0.png",
    imageAlt: "Tribal braids showcasing a curated protective style finish",
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
  return blogPosts.find(post => post.slug === slug);
}
