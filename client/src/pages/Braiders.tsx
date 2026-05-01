import { SiteFooter, SiteHeader } from "./Home";

export default function Braiders() {
  return (
    <div className="luxury-shell">
      <SiteHeader />
      <main className="container section-pad">
        <div className="lux-card grid gap-8 lg:grid-cols-[1fr_.8fr]">
          <div>
            <p className="pill w-fit">Braiders Near Me</p>
            <h1 className="serif mt-4 text-5xl font-bold md:text-6xl">
              Find braiders connected to Eby’s Place.
            </h1>
            <p className="mt-5 text-white/68">
              Customers can discover registered braiders, and professionals can
              register their services through Kouvia.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a className="btn-gold" href="https://kouvia.com" target="_blank" rel="noreferrer">
                Find a Braider
              </a>
              <a className="btn-dark" href="https://kouvia.com/register" target="_blank" rel="noreferrer">
                Register as a Braider
              </a>
            </div>
          </div>
          <div className="lux-card bg-black/24">
            <h2 className="serif text-3xl font-bold">For clients and braiders</h2>
            <div className="mt-5 grid gap-3 text-white/68">
              <p>Browse braiders near you.</p>
              <p>Register your braiding services.</p>
              <p>Keep bookings and availability easier to manage.</p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
