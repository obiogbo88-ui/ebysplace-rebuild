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
    slug: "halobraid-robot-future-of-braiding",
    title: "HaloBraid: The Robot That Is Changing Professional Hair Braiding Forever",
    category: "Industry news",
    excerpt:
      "Meet HaloBraid — the world's first braid-assist robot that helps professional stylists complete braids up to five times faster, without sacrificing quality or comfort.",
    publishDate: "2026-08-02",
    readTime: "6 min read",
    imageUrl:
      "https://i.ytimg.com/vi/VshhekKnM10/maxresdefault.jpg",
    imageAlt: "HaloBraid robotic braid-assist device in a professional salon setting",
    featured: true,
    sections: [
      {
        heading: "What is HaloBraid?",
        paragraphs: [
          "HaloBraid is the world's first robotic braid-assist device, purpose-built for professional stylists who specialise in textured hair. Developed by Yinka Ogunbiyi — a Nigerian-American Harvard alumna with a background in both engineering and business — the device does not replace stylists. Instead, it works beside them, taking over the most repetitive and physically demanding part of the process: completing each braid after the stylist sets the pattern.",
          "The concept is elegant in its simplicity. The stylist begins each braid by hand, establishing the tension, parting, and initial structure. They then hand the braid to HaloBraid, which finishes the length at up to five times the speed of a manual technique, with consistent tension and a gentle touch that prioritises client comfort. Creative control stays with the stylist throughout.",
        ],
      },
      {
        heading: "Why it matters: the real cost of braiding",
        paragraphs: [
          "A full set of box braids or knotless braids can take between six and twelve hours to complete. That is not just a long appointment for clients — it is an enormous physical strain on the stylists performing the work. Repetitive hand movements at that intensity over an entire career contribute to high rates of carpal tunnel syndrome, tendinitis, and arthritis among professional braiders.",
          "At the same time, those long appointment windows limit how many clients a stylist can serve each week, capping income and growth potential. HaloBraid is designed to break both of those constraints: reducing appointment time significantly and protecting the long-term health of the people doing the work.",
          "According to HaloBraid's own research, ninety-five percent of braid wearers say they would get their hair braided more often if appointments took less time. The technology does not just change what happens inside the salon — it expands who can access the service regularly.",
        ],
      },
      {
        heading: "The story behind the machine",
        paragraphs: [
          "Ogunbiyi's path to building HaloBraid began during the COVID-19 pandemic, when she found herself unable to access a salon and struggled to braid her own hair. That personal frustration pointed to a much larger, systemic gap: the global braiding industry had not seen meaningful technological innovation in thousands of years, despite serving tens of millions of clients annually.",
          "Ogunbiyi co-founded Halo with David Afolabi, and the team spent years developing hundreds of prototypes with direct input from working stylists. The result is a device designed not in isolation, but shaped by the professionals who would actually use it every day. HaloBraid went on to win the Harvard Business School President's Innovation Challenge and has drawn serious investment attention.",
          "In June 2026, Halo announced a seven-million-dollar seed funding round led by Alexis Ohanian's Seven Seven Six venture capital fund — a signal that the beauty-tech industry is beginning to take textured hair services seriously as a market worth building for.",
        ],
      },
      {
        heading: "What this means for salons and clients",
        paragraphs: [
          "For salon owners, HaloBraid is a capacity and sustainability tool. Serving more clients in the same number of working hours improves revenue without extending the working day. Reducing physical strain on stylists means less sick time, longer careers, and a more stable team.",
          "For clients, faster appointments with consistent quality open up access to styles that many people currently reserve for special occasions because of the time commitment. If a full braid set can be completed in a fraction of the usual time, it becomes a realistic part of a regular protective style rotation.",
          "The device is launching commercially to salons later in 2026, with over seven thousand salon owners and stylists already on the waitlist. If you are interested in being among the first salons to adopt the technology, you can register your interest at halobraid.com.",
        ],
      },
      {
        heading: "Where Eby's Place fits in",
        paragraphs: [
          "At Eby's Place, we pay close attention to everything shaping the future of protective styling — from the techniques we refine inside the salon to the tools and conversations emerging across the industry. HaloBraid represents a genuine shift in what is possible, and it is exactly the kind of innovation that puts stylist health and client experience at the centre.",
          "Whether technology like HaloBraid becomes part of how we work in the future or simply shapes the wider conversation, our commitment stays the same: high-quality braiding done with care, skill, and respect for your hair and your time. Book an appointment to experience that standard today.",
        ],
      },
    ],
    references: [
      "HaloBraid — Official website and waitlist: halobraid.com",
      "Halo announces $7M in funding to launch HaloBraid, the first braid-assist device for professional stylists — PR Newswire, June 2026",
      "HaloBraid raises $7M from Seven Seven Six to end the six-hour hair salon appointment — TechCrunch, June 2026",
      "Meet Yinka Ogunbiyi, the woman behind the world's first hair-braiding robot — TheGrio, July 2026",
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
