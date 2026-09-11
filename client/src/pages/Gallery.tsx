import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Reveal } from "@/lib/motion";
import { SiteFooter, SiteHeader } from "./Home";

const categories = ["All", "Braids", "Twists", "Locs", "Kids Styles"];

export default function Gallery() {
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<any | null>(null);
  const { data = [] } = trpc.public.gallery.useQuery({ category });
  const images = data as any[];

  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <Reveal>
          <p className="pill w-fit">Gallery</p>
          <h1 className="serif mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            Hairstyle inspiration gallery.
          </h1>
          <p className="mt-4 max-w-3xl text-white/65">
            Filter by style family and open each photo for a closer
            consultation-ready look before choosing a booking style.
          </p>
        </Reveal>

        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Gallery categories">
          {categories.map(item => (
            <button
              key={item}
              type="button"
              className={item === category ? "btn-gold py-2" : "btn-dark py-2"}
              aria-pressed={item === category}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {images.length === 0 ? (
          <div className="lux-card mt-10 text-white/70">
            No published gallery images in this category yet.
          </div>
        ) : (
          <div className="mt-10 grid auto-rows-[16rem] grid-cols-2 gap-3 sm:auto-rows-[20rem] md:grid-cols-4 md:gap-4">
            {images.map((image, index) => {
              const featured = index % 5 === 0;
              return (
                <button
                  type="button"
                  className={`group relative overflow-hidden rounded-2xl text-left ${
                    featured ? "col-span-2 row-span-2" : "col-span-1"
                  }`}
                  key={image.id}
                  onClick={() => setSelected(image)}
                >
                  <img
                    src={image.imageUrl}
                    alt={image.altText}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(0,0,0,.78))] opacity-0 transition group-hover:opacity-100" />
                  <div className="absolute inset-x-0 bottom-0 translate-y-3 p-4 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                    <span className="pill text-[0.65rem]">{image.category}</span>
                    <p className="serif mt-2 text-lg font-bold text-[#F4EFE6]">
                      {image.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[92vh] max-w-4xl overflow-auto rounded-[2rem] border border-primary/30 bg-card p-5 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <img
              className="max-h-[70vh] w-full rounded-2xl object-contain"
              src={selected.imageUrl}
              alt={selected.altText}
              loading="eager"
              decoding="async"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="pill w-fit text-xs">{selected.category}</p>
                <h2 className="serif mt-2 text-3xl font-bold text-primary">
                  {selected.title}
                </h2>
                <p className="mt-2 text-white/60">{selected.altText}</p>
              </div>
              <button className="btn-gold" onClick={() => setSelected(null)}>
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
