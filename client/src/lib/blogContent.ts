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
    slug: "halobraid-robotics-future-of-braiding",
    title: "HaloBraid: The Robotic Braiding Device Changing the Salon Industry",
    category: "Industry news",
    excerpt:
      "A Harvard-born braid assist device is rewriting the economics of the braiding salon — faster appointments, less physical strain, and a smarter path to scale.",
    publishDate: "2026-08-02",
    readTime: "6 min read",
    imageUrl:
      "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_knotless_braids_ee7bcfb0-f944f71cb3.png",
    imageAlt: "Professional braiding salon appointment — the foundation HaloBraid is transforming",
    featured: true,
    galleryImages: [
      {
        url: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_cornrows_2b5007dd-7637e158cc.png",
        alt: "HaloBraid robotic device in action — precise cornrow finishing at speed",
      },
      {
        url: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_box_braids_c219e578-5ddc057b3d.png",
        alt: "HaloBraid braid assist completing box braids with consistent tension",
      },
      {
        url: "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_starter_locs_3cfa3435-0f2729451d.png",
        alt: "HaloBraid device supporting a protective loc installation session",
      },
    ],
    sections: [
      {
        heading: "What is HaloBraid?",
        paragraphs: [
          "HaloBraid is the first professional braid assist device designed specifically for salon stylists. Co-founded by Yinka Ogunbiyi — a Harvard-trained biomechanical engineer — and David Afolabi, it was built to address one of the most persistent challenges in the textured hair industry: the physical toll and time cost of traditional hand braiding.",
          "The device blends robotics and machine learning to take over the repetitive, physically demanding stage of a braid after the stylist has set the pattern and tension by hand. The result is up to five times faster completion without sacrificing the quality or creative control that clients expect from a premium stylist.",
        ],
      },
      {
        heading: "Why it matters for stylists",
        paragraphs: [
          "Braiding is one of the most labour-intensive services in personal care. A full set of box braids or knotless braids can take six to eight hours, which limits how many clients a stylist can serve in a day and contributes to serious hand, wrist, and shoulder injuries over a career.",
          "HaloBraid directly addresses both problems. By automating the repetitive motion, it allows stylists to serve more clients per day, reduce physical strain, and maintain the kind of consistent finish that builds a loyal client base. The device does not replace the stylist — it amplifies what they can do.",
        ],
      },
      {
        heading: "How it works in practice",
        paragraphs: [
          "The stylist begins each braid using their own technique and preferred tension. HaloBraid then takes over the repeating segment of the braid, advancing with precise, consistent movement until the full length is complete. The stylist remains in control of the start, the style, and any creative variation — the device simply removes the mechanical repetition.",
          "The machine uses sensors and machine learning to maintain even tension throughout, helping deliver a cleaner, more uniform finish than prolonged hand braiding at the end of a long working day. Early testing has been carried out on thousands of braids, with results consistently matching professional hand-braided quality.",
        ],
      },
      {
        heading: "The investment and industry recognition",
        paragraphs: [
          "HaloBraid won the 2025 President's Innovation Challenge at Harvard, one of the most prestigious student entrepreneurship competitions in the United States, taking home $75,000 in funding. The win confirmed not only the technical quality of the product but the scale of the market opportunity it addresses.",
          "In 2026, Halo secured $7 million in venture capital, with backing from Alexis Ohanian's fund Seven Seven Six among others. That funding is accelerating product development, salon pilot programmes, and the commercial launch expected in late 2026. Salons and stylists interested in early access can join the waitlist at halobraid.com.",
        ],
      },
      {
        heading: "What this means for the protective styles industry",
        paragraphs: [
          "The global market for textured hair services has grown significantly, but the supply side has not kept pace. There are not enough trained stylists to meet demand, and those who are practising are working at the physical limits of what hand braiding allows. HaloBraid offers a meaningful path to closing that gap.",
          "For established salons, the device creates the potential to double appointment capacity without additional staff or extended hours. For newer stylists, it removes the physical barrier to building a full client list in the early years of a career. For clients, it means shorter waiting times and a more consistent result across every appointment.",
          "At Eby's Place, we follow innovations like HaloBraid closely because our commitment has always been to combine precision, comfort, and care. Tools that support stylists without compromising the craft align exactly with that standard. We look forward to seeing how this technology develops and what it offers the wider protective styles community.",
        ],
      },
    ],
    references: [
      "HaloBraid — halobraid.com",
      "TechCrunch: HaloBraid raises $7M from Seven Seven Six to end the six-hour hair salon appointment (June 2026)",
      "Harvard Business School President's Innovation Challenge — 2025 winner",
      "PR Newswire: Halo announces $7M in funding to launch HaloBraid, the first braid assist device for professional stylists (2026)",
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
