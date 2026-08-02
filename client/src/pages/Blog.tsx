import { Link } from "wouter";
import { ArrowRight, CalendarDays, ChevronLeft, Clock3 } from "lucide-react";
import { blogPosts, getBlogPostBySlug } from "@/lib/blogContent";
import { SiteFooter, SiteHeader } from "@/pages/Home";

type BlogPageProps = {
  params?: {
    slug?: string;
  };
};

const BLOG_IMAGE_FALLBACK_SRC =
  "https://jcyoipbiplzrocrrhwkp.supabase.co/storage/v1/object/public/ebysplace-media/ebysplace_service_beads_accessories_05425a55-585b8bc439.png";

export default function Blog({ params }: BlogPageProps) {
  const post = params?.slug ? getBlogPostBySlug(params.slug) : undefined;

  if (params?.slug && !post) {
    return (
      <div className="luxury-shell">
        <SiteHeader />
        <main className="section-pad">
          <section className="container max-w-3xl">
            <div className="lux-card text-center">
              <p className="pill mx-auto w-fit">Blog</p>
              <h1 className="serif mt-4 text-4xl font-bold leading-tight sm:text-5xl">
                Article not found
              </h1>
              <p className="mt-4 text-base font-medium text-white/65">
                That article is unavailable right now, but the braid journal is
                still live.
              </p>
              <Link className="btn-gold mx-auto mt-8 w-fit" href="/blog">
                Back to all articles
              </Link>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (post) {
    const relatedPosts = blogPosts
      .filter(item => item.slug !== post.slug)
      .slice(0, 2);

    return (
      <div className="luxury-shell">
        <SiteHeader />
        <main className="section-pad">
          <section className="container max-w-5xl">
            <Link
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-primary"
              href="/blog"
            >
              <ChevronLeft className="h-4 w-4" /> Back to all articles
            </Link>
            <div className="mt-6 overflow-hidden rounded-[2rem] border border-primary/20 bg-[#f5ead7] shadow-[0_20px_60px_rgba(74,48,20,.14)]">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="p-6 text-[#24170d] sm:p-8 lg:p-10">
                  <p className="pill w-fit border-[#d8bd74]/70 bg-white text-[#5b3a12]">
                    {post.category}
                  </p>
                  <h1 className="serif mt-5 text-4xl font-bold leading-tight sm:text-5xl">
                    {post.title}
                  </h1>
                  <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-[#4a3014] sm:text-lg">
                    {post.excerpt}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-bold uppercase tracking-[0.16em] text-[#7a541e]">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> {post.publishDate}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4" /> {post.readTime}
                    </span>
                  </div>
                </div>
                <div className="min-h-[18rem] bg-[#171009]">
                  <img
                    src={post.imageUrl}
                    alt={post.imageAlt}
                    className="h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                    onError={event => {
                      if (event.currentTarget.src !== BLOG_IMAGE_FALLBACK_SRC)
                        event.currentTarget.src = BLOG_IMAGE_FALLBACK_SRC;
                    }}
                  />
                </div>
              </div>
            </div>

            <article className="mx-auto mt-10 max-w-3xl">
              <div className="grid gap-8">
                {post.galleryImages?.length ? (
                  <section className="lux-card">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="pill w-fit">Photo story</p>
                        <h2 className="serif mt-4 text-3xl font-bold text-primary">
                          Style gallery
                        </h2>
                      </div>
                      <p className="max-w-xl text-sm font-medium leading-7 text-white/62">
                        A responsive image set to show the shape, finish, and
                        neat detailing that make this look read as premium.
                      </p>
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {post.galleryImages.map(image => (
                        <figure
                          key={image.url}
                          className="overflow-hidden rounded-[1.5rem] border border-primary/15 bg-[#171009]"
                        >
                          <img
                            src={image.url}
                            alt={image.alt}
                            className="h-72 w-full object-cover sm:h-64"
                            loading="lazy"
                            decoding="async"
                            onError={event => {
                              if (
                                event.currentTarget.src !==
                                BLOG_IMAGE_FALLBACK_SRC
                              )
                                event.currentTarget.src =
                                  BLOG_IMAGE_FALLBACK_SRC;
                            }}
                          />
                          <figcaption className="px-4 py-3 text-sm font-medium leading-6 text-white/68">
                            {image.alt}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </section>
                ) : null}
                {post.sections.map(section => (
                  <section key={section.heading} className="lux-card">
                    <h2 className="serif text-3xl font-bold text-primary">
                      {section.heading}
                    </h2>
                    <div className="mt-4 grid gap-4 text-base font-medium leading-8 text-white/72">
                      {section.paragraphs.map(paragraph => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>

            {post.references?.length ? (
              <section className="mx-auto mt-10 max-w-3xl">
                <div className="lux-card">
                  <p className="pill w-fit">References</p>
                  <h2 className="serif mt-4 text-3xl font-bold text-primary">
                    Professional notes
                  </h2>
                  <ul className="mt-5 grid gap-3 text-sm font-medium leading-7 text-white/68">
                    {post.references.map(reference => (
                      <li
                        key={reference}
                        className="rounded-2xl border border-primary/15 bg-black/10 px-4 py-3"
                      >
                        {reference}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            <section className="mt-10">
              <div className="lux-card grid gap-5 rounded-[1.75rem] bg-[#f3e7d2] text-[#24170d] md:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <p className="pill w-fit border-[#d8bd74]/70 bg-white text-[#5b3a12]">
                    Next step
                  </p>
                  <h2 className="serif mt-4 text-3xl font-bold">
                    Ready for a protective style that still feels comfortable?
                  </h2>
                  <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-[#4a3014]">
                    Explore services, choose the finish that fits your routine,
                    and secure your appointment online.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                  <Link className="btn-gold justify-center" href="/booking">
                    Book now
                  </Link>
                  <Link className="btn-dark justify-center" href="/services">
                    View services
                  </Link>
                </div>
              </div>
            </section>

            {relatedPosts.length ? (
              <section className="mt-10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="pill w-fit">More from the journal</p>
                    <h2 className="serif mt-4 text-3xl font-bold leading-tight md:text-4xl">
                      Other articles
                    </h2>
                  </div>
                  <Link className="btn-dark" href="/blog">
                    Browse all posts
                  </Link>
                </div>
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  {relatedPosts.map(item => (
                    <Link
                      key={item.slug}
                      href={`/blog/${item.slug}`}
                      className="lux-card group block overflow-hidden p-0 text-left transition hover:-translate-y-1 hover:border-primary/55"
                    >
                      <div className="media-portrait overflow-hidden rounded-t-[1.75rem] bg-[#171009]">
                        <img
                          src={item.imageUrl}
                          alt={item.imageAlt}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                          onError={event => {
                            if (
                              event.currentTarget.src !==
                              BLOG_IMAGE_FALLBACK_SRC
                            )
                              event.currentTarget.src = BLOG_IMAGE_FALLBACK_SRC;
                          }}
                        />
                      </div>
                      <div className="p-6">
                        <p className="pill w-fit text-xs">{item.category}</p>
                        <h3 className="serif mt-4 text-2xl font-bold text-[#24170d] transition group-hover:text-primary">
                          {item.title}
                        </h3>
                        <p className="mt-3 text-sm font-medium leading-7 text-[#4a3014]">
                          {item.excerpt}
                        </p>
                        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                          Read article <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="section-pad">
        <section className="container">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="pill w-fit">Braid journal</p>
              <h1 className="serif mt-4 text-4xl font-bold leading-tight md:text-6xl">
                Latest from the Eby’s Place blog
              </h1>
              <p className="mt-4 text-base font-semibold leading-8 text-white/72 md:text-lg">
                Practical braid care, appointment prep, and protective style
                guidance designed to help you choose well and wear your style
                comfortably.
              </p>
            </div>
            <Link className="btn-gold" href="/booking">
              Book an appointment
            </Link>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {blogPosts.map(post => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="lux-card group block overflow-hidden p-0 text-left transition hover:-translate-y-1 hover:border-primary/55 hover:shadow-[0_22px_55px_rgba(189,140,52,.24)]"
              >
                <div className="media-portrait overflow-hidden rounded-t-[1.75rem] bg-[#171009]">
                  <img
                    src={post.imageUrl}
                    alt={post.imageAlt}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    onError={event => {
                      if (event.currentTarget.src !== BLOG_IMAGE_FALLBACK_SRC)
                        event.currentTarget.src = BLOG_IMAGE_FALLBACK_SRC;
                    }}
                  />
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-primary/85">
                    <span className="pill text-[0.65rem]">{post.category}</span>
                    <span>{post.publishDate}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <h2 className="serif mt-4 text-3xl font-bold text-[#24170d] transition group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-4 text-sm font-medium leading-7 text-[#4a3014]">
                    {post.excerpt}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                    Read article <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
