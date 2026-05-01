import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SiteFooter, SiteHeader } from "./Home";

const categories = ["All", "Braids", "Twists", "Locs", "Kids"];

export default function Gallery() {
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<any | null>(null);
  const { data = [] } = trpc.public.gallery.useQuery({ category });
  return <div className="luxury-shell"><SiteHeader /><main className="container section-pad"><p className="pill w-fit">Gallery</p><h1 className="serif mt-4 text-5xl font-bold md:text-6xl">Hairstyle inspiration gallery.</h1><p className="mt-4 max-w-3xl text-white/65">Filter by style family and open each photo for a closer consultation-ready look before choosing a booking style.</p><div className="mt-8 flex flex-wrap gap-2">{categories.map((item) => <button key={item} className={item === category ? "btn-gold py-2" : "btn-dark py-2"} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="mt-10 grid gap-5 md:grid-cols-3">{(data as any[]).map((image) => <button className="lux-card text-left" key={image.id} onClick={() => setSelected(image)}><img className="h-80 w-full rounded-2xl object-cover" src={image.imageUrl} alt={image.altText} /><span className="pill mt-4 inline-block text-xs">{image.category}</span><figcaption className="mt-3 font-bold text-primary">{image.title}</figcaption></button>)}</div>{selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" onClick={() => setSelected(null)}><div className="max-h-[92vh] max-w-4xl overflow-auto rounded-[2rem] border border-primary/30 bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><img className="max-h-[70vh] w-full rounded-2xl object-contain" src={selected.imageUrl} alt={selected.altText} /><div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div><p className="pill w-fit text-xs">{selected.category}</p><h2 className="serif mt-2 text-3xl font-bold text-primary">{selected.title}</h2><p className="mt-2 text-white/60">{selected.altText}</p></div><button className="btn-gold" onClick={() => setSelected(null)}>Close preview</button></div></div></div>}</main><SiteFooter /></div>;
}
