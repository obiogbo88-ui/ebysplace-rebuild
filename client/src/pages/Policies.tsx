import { Link } from "wouter";
import { SiteFooter, SiteHeader } from "./Home";

type PolicyKey = "privacy" | "shopping" | "returns" | "terms";

type PolicySection = {
  title: string;
  body: string;
};

type PolicyContent = {
  label: string;
  title: string;
  intro: string;
  sections: PolicySection[];
};

const policies: Record<PolicyKey, PolicyContent> = {
  privacy: {
    label: "Privacy Policy",
    title: "Privacy and cookies policy.",
    intro:
      "This concise policy explains how Eby’s Place may handle customer information when you browse, book an appointment, submit a review, use AI Try-On, or shop with us online.",
    sections: [
      {
        title: "Information we collect",
        body:
          "We may collect contact details, appointment details, order details, review submissions, uploaded images for AI Try-On, and messages you choose to send us. Payment details are handled securely by Stripe and are not stored by Eby’s Place.",
      },
      {
        title: "How we use information",
        body:
          "We use information to manage bookings, process shop orders, respond to enquiries, operate the website, moderate reviews, improve customer care, and keep appropriate business records.",
      },
      {
        title: "Cookies",
        body:
          "The website may use essential cookies for security, checkout, booking, and account functionality. Analytics or preference cookies should only be used where appropriate consent or settings are available.",
      },
      {
        title: "Your choices",
        body:
          "You can contact Eby’s Place to ask about the personal information connected to your booking, order, or enquiry. You can also manage cookies through your browser settings.",
      },
    ],
  },
  shopping: {
    label: "Shopping Policy",
    title: "Shopping policy.",
    intro:
      "This policy covers aftercare and product purchases made through the Eby’s Place online shop.",
    sections: [
      {
        title: "Product information",
        body:
          "We aim to describe products, prices, colours, and availability clearly. If an item becomes unavailable after purchase, we will contact you about a replacement, delay, or refund option.",
      },
      {
        title: "Payments",
        body:
          "Online payments are processed through Stripe. Please check your order information before checkout, including delivery details and product selections.",
      },
      {
        title: "Dispatch and delivery",
        body:
          "Dispatch times may vary by product and service demand. Delivery estimates are guidance only, but we will communicate material delays where possible.",
      },
      {
        title: "Customer support",
        body:
          "If you have a question about an order, contact Eby’s Place with your name, order reference, and the best contact details for a response.",
      },
    ],
  },
  returns: {
    label: "Returns Policy",
    title: "Returns and refund policy.",
    intro:
      "This policy is written for UK customers and is intended to sit alongside your statutory consumer rights.",
    sections: [
      {
        title: "Faulty or incorrect goods",
        body:
          "If an item is faulty, not as described, or not fit for its intended purpose, contact Eby’s Place as soon as possible so we can review the issue and offer the appropriate remedy.",
      },
      {
        title: "Online cancellation period",
        body:
          "For eligible online shop items, you can usually tell us within 14 days of receiving the item that you wish to cancel, then return it within the next 14 days. Refunds are normally processed within 14 days after we receive the returned item.",
      },
      {
        title: "Hygiene and personalised items",
        body:
          "Some items may only be returnable if faulty, including opened sealed hygiene items, used haircare goods, or personalised/custom-made items.",
      },
      {
        title: "Booking deposits",
        body:
          "Appointment deposits are handled under the booking terms shown during checkout. Where a deposit is described as non-refundable before payment, that booking condition applies unless consumer law requires otherwise.",
      },
    ],
  },
  terms: {
    label: "Terms of Use",
    title: "Website terms of use.",
    intro:
      "These terms explain the basic rules for using the Eby’s Place website, booking tools, AI Try-On, reviews, and shop pages.",
    sections: [
      {
        title: "Website content",
        body:
          "Website content is provided for general information, booking, and shopping. Prices, service durations, and availability may change, but checkout and booking screens should show the current information before you confirm.",
      },
      {
        title: "Bookings and payments",
        body:
          "Please provide accurate booking and contact information. Stripe handles payment processing, and appointment-specific conditions are presented before checkout.",
      },
      {
        title: "AI Try-On",
        body:
          "AI Try-On previews are for inspiration only. Results may vary and should not be treated as a guaranteed final hairstyle outcome.",
      },
      {
        title: "Reviews and submissions",
        body:
          "Reviews may be moderated before publication. Do not submit content that is unlawful, abusive, misleading, or infringes another person’s rights.",
      },
    ],
  },
};

const policyOrder: PolicyKey[] = ["privacy", "shopping", "returns", "terms"];

export function PolicyPage({ type }: { type: PolicyKey }) {
  const policy = policies[type];

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <p className="pill w-fit">Eby’s Place policies</p>
        <section className="mt-5 grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <aside className="lux-card bg-white/70">
            <h1 className="serif text-3xl font-bold text-[#24170d]">Policies</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-[#4a3014]">
              UK-oriented customer information for shopping, returns, privacy, and website use.
            </p>
            <nav className="mt-6 grid gap-2" aria-label="Policy pages">
              {policyOrder.map(item => (
                <Link
                  key={item}
                  href={`/policies/${item}`}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    item === type
                      ? "border-[#b9933e] bg-[#f0d889]/45 text-[#2a1a0b]"
                      : "border-[#d8bd74]/45 bg-white/45 text-[#5a3d1e] hover:border-[#b9933e]"
                  }`}
                >
                  {policies[item].label}
                </Link>
              ))}
            </nav>
          </aside>

          <article className="lux-card bg-white/78">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#8a641e]">
              {policy.label}
            </p>
            <h2 className="serif mt-3 text-4xl font-bold leading-tight text-[#24170d] sm:text-5xl">
              {policy.title}
            </h2>
            <p className="mt-5 text-base font-medium leading-8 text-[#4a3014]">
              {policy.intro}
            </p>
            <div className="mt-8 grid gap-5">
              {policy.sections.map(section => (
                <section
                  key={section.title}
                  className="rounded-3xl border border-[#d8bd74]/45 bg-[#fffaf1]/82 p-5"
                >
                  <h3 className="text-lg font-extrabold text-[#2a1a0b]">{section.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-7 text-[#4a3014]">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>
            <p className="mt-8 rounded-3xl border border-[#d8bd74]/45 bg-[#f5ead7] p-5 text-sm font-semibold leading-7 text-[#5a3d1e]">
              This page is a practical website policy summary and not a substitute for independent legal advice.
            </p>
          </article>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function PoliciesIndex() {
  return <PolicyPage type="privacy" />;
}
