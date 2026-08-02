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
    slug: "halo-braids-style-guide",
    title:
      "Halo braids: a polished protective style for elegant, low-fuss wear",
    category: "Halo braids",
    excerpt:
      "Halo braids work beautifully when you want a refined protective style that photographs well, feels secure, and still looks soft enough for everyday wear.",
    publishDate: "2026-08-02",
    readTime: "6 min read",
    imageUrl:
      "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png",
    imageAlt:
      "Elegant braided crown-inspired styling with neat parts and a polished finish",
    featured: true,
    galleryImages: [
      {
        url: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_fulani_braids_0575047c-0358a6ffb9.png",
        alt: "Front view of a neat halo-inspired braid finish",
      },
      {
        url: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_stitch_braids_562f3424-edda69b630.png",
        alt: "Detailed braid pattern showing clean sections and a smooth crown area",
      },
      {
        url: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_cornrows_2b5007dd-7637e158cc.png",
        alt: "Protective braid styling shaped neatly around the head for a structured look",
      },
    ],
    sections: [
      {
        heading: "Why halo braids still feel timeless",
        paragraphs: [
          "Halo braids stand out because they create shape, elegance, and structure without relying on excessive bulk. The look frames the face beautifully, feels occasion-ready, and still fits clients who want a polished style for work, travel, church, celebrations, or a busy week where hair needs to stay neat.",
          "When planned well, the style gives the impression of effort without demanding constant restyling. That balance is a big reason it remains a reliable choice for clients who want protective styling to feel both graceful and practical.",
        ],
      },
      {
        heading: "Who halo braids suit best",
        paragraphs: [
          "Halo braids are especially useful for clients who want a secure up-style, a lighter feel around the shoulders, or a finish that keeps the hair lifted away from the face. They are also a smart option when you want an event look that still protects your natural hair underneath.",
          "The best result depends on braid size, tension balance, and how much fullness you want around the crown. A good consultation should cover scalp sensitivity, desired longevity, and whether you prefer a softer romantic finish or a more defined architectural shape.",
        ],
      },
      {
        heading: "What makes the style look premium",
        paragraphs: [
          "The quality of halo braids is often decided by the details: clean parting, balanced braid placement, a smooth hairline, and an overall shape that looks intentional from every angle. If any of those elements are rushed, the style can quickly lose the elevated finish that makes it so striking.",
          "At Eby’s Place, the goal is never just to create a braid shape. It is to deliver a result that looks polished in person, photographs well, and feels comfortable enough to wear with confidence from day one.",
        ],
      },
      {
        heading: "How to keep halo braids looking fresh",
        paragraphs: [
          "Night protection matters here just as much as installation quality. A satin wrap helps preserve the hairline, reduce friction around the crown, and stop the style from drying out or frizzing too quickly.",
          "Keep product use light and purposeful. A small amount of scalp moisture and occasional edge care will usually do more for longevity than layering heavy products that attract build-up.",
        ],
      },
    ],
  },
  {
    slug: "make-knotless-braids-last-longer",
    title: "How to make knotless braids last longer",
    category: "Aftercare",
    excerpt:
      "A realistic maintenance routine for keeping knotless braids fresh, tidy, and comfortable between appointments.",
    publishDate: "2026-07-18",
    readTime: "5 min read",
    imageUrl:
      "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png",
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
    excerpt:
      "The best protective style is not just about trend or length. It also has to match your routine, maintenance time, and comfort level.",
    publishDate: "2026-07-26",
    readTime: "4 min read",
    imageUrl:
      "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_boho_braids_ee8557bc-0b74da3a99.png",
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
  return blogPosts.find(post => post.slug === slug);
}
