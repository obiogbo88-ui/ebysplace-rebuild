from pathlib import Path

root = Path('/home/ubuntu/ebysplace-rebuild')

# Update Google Fonts in the document head.
index_html = root / 'client/index.html'
html = index_html.read_text()
if 'fonts.googleapis.com' not in html:
    html = html.replace(
        '</head>',
        '  <link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet">\n'
        '</head>'
    )
index_html.write_text(html)

# Append sitewide warm-light visual system overrides after the current stylesheet.
css_path = root / 'client/src/index.css'
css = css_path.read_text()
marker = '/* Warm cream high-converting redesign overrides */'
if marker not in css:
    css += r'''

/* Warm cream high-converting redesign overrides */
:root {
  --background: 36 44% 96%;
  --foreground: 0 0% 10%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 10%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 10%;
  --primary: 45 52% 54%;
  --primary-foreground: 0 0% 7%;
  --secondary: 36 44% 96%;
  --secondary-foreground: 0 0% 10%;
  --muted: 34 30% 90%;
  --muted-foreground: 0 0% 29%;
  --accent: 45 52% 54%;
  --accent-foreground: 0 0% 7%;
  --border: 37 28% 82%;
  --input: 37 28% 82%;
  --ring: 45 52% 54%;
}

html { background: #FAF7F2; }
body {
  background: #FAF7F2;
  color: #1A1A1A;
  font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.68;
}

@media (min-width: 768px) {
  body { font-size: 16px; }
}

h1, h2, h3, h4, h5, h6, .serif {
  font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  color: #1A1A1A;
  font-weight: 800;
  letter-spacing: -0.025em;
}

p, li, label, input, textarea, select, button, small, span, td, th {
  color: inherit;
}

a { color: #8F6F1D; text-decoration-color: transparent; text-underline-offset: 0.22em; }
a:hover { color: #C9A84C; text-decoration-line: underline; text-decoration-color: currentColor; }

.luxury-shell,
.bg-background,
main,
.min-h-screen {
  background-color: #FAF7F2;
  color: #1A1A1A;
}

.luxury-shell section:nth-of-type(even) { background-color: #FFFFFF; }
.luxury-shell section:nth-of-type(odd) { background-color: #FAF7F2; }
.luxury-shell footer { background: #FFFFFF; color: #1A1A1A; }

.site-header,
.lux-card,
.bg-card,
.card,
[data-radix-popper-content-wrapper] > *,
.rounded-\[2rem\],
.rounded-3xl {
  color: #1A1A1A;
}

.lux-card,
.bg-card,
.border-white\/10,
.border-white\/12,
.border-white\/15,
.border-white\/20 {
  background: #FFFFFF !important;
  border-color: rgba(201, 168, 76, 0.34) !important;
  box-shadow: 0 24px 70px rgba(26, 26, 26, 0.08);
}

.text-white,
.text-white\/90,
.text-white\/85,
.text-white\/80,
.text-white\/75,
.text-white\/72,
.text-white\/70,
.text-white\/68,
.text-white\/65,
.text-white\/60,
.text-white\/58,
.text-white\/55,
.text-white\/50,
.text-white\/45,
.text-white\/40 {
  color: #1A1A1A !important;
}

.text-\[\#f5ead6\], .text-\[\#ecd39d\], .text-\[\#e7d7b2\], .text-\[\#d8c7a4\] { color: #1A1A1A !important; }
.text-\[\#bda65d\], .text-\[\#9f8b52\], .text-\[\#75521c\], .text-\[\#4f3720\] { color: #4A4A4A !important; }
.text-primary, .gold-text { color: #C9A84C !important; }

.bg-black\/20,
.bg-black\/30,
.bg-black\/40,
.bg-black\/50,
.bg-black\/60,
.bg-white\/\[0\.04\],
.bg-white\/\[0\.045\],
.bg-white\/\[0\.06\],
.bg-white\/10,
.bg-white\/15 {
  background-color: #FFFFFF !important;
}

.btn-gold,
.btn-dark,
a[href='/booking'],
a[href^='/booking'].btn-gold,
button[type='submit'] {
  background: #111111 !important;
  color: #C9A84C !important;
  border: 1px solid #C9A84C !important;
  box-shadow: 0 18px 44px rgba(17, 17, 17, 0.18);
}

.btn-gold:hover,
.btn-dark:hover,
a[href='/booking']:hover,
a[href^='/booking'].btn-gold:hover,
button[type='submit']:hover {
  background: #C9A84C !important;
  color: #111111 !important;
  border-color: #111111 !important;
  text-decoration: none;
}

.pill {
  background: rgba(201, 168, 76, 0.16) !important;
  border: 1px solid rgba(201, 168, 76, 0.38) !important;
  color: #6F5416 !important;
  font-weight: 800;
}

input, textarea, select {
  background: #FFFFFF !important;
  color: #1A1A1A !important;
  border-color: rgba(201, 168, 76, 0.45) !important;
}
input::placeholder, textarea::placeholder { color: #5F5F5F !important; opacity: 1; }

.hero-video-reference .container h1,
.hero-video-reference .container p,
.hero-video-reference .hero-slogan-list,
.hero-video-reference .hero-slogan-list li {
  color: #FFFFFF !important;
}
.hero-video-reference .gold-text { color: #F5D66E !important; }

.warm-trust-strip {
  background: #FFFFFF;
  border: 1px solid rgba(201, 168, 76, 0.34);
  box-shadow: 0 24px 70px rgba(26, 26, 26, 0.08);
}

.mobile-sticky-booking {
  background: rgba(250, 247, 242, 0.96);
  border-top: 1px solid rgba(201, 168, 76, 0.42);
  box-shadow: 0 -18px 42px rgba(26, 26, 26, 0.14);
  backdrop-filter: blur(14px);
}

@media (max-width: 767px) {
  .luxury-shell { padding-bottom: 5.5rem; }
  h1 { font-size: clamp(2.4rem, 12vw, 4.2rem); }
  h2 { font-size: clamp(2rem, 9vw, 3.25rem); }
  .section-pad { padding-top: 3.5rem; padding-bottom: 3.5rem; }
}
'''
css_path.write_text(css)

# Add sticky mobile booking CTA app shell.
app_path = root / 'client/src/App.tsx'
app = app_path.read_text()
if 'MobileStickyBookingCta' not in app:
    app = app.replace('import { Route, Switch, useLocation } from "wouter";', 'import { Link, Route, Switch, useLocation } from "wouter";')
    app = app.replace(
        'function Router() {',
        '''function MobileStickyBookingCta() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  if (isAdmin) return null;
  return (
    <div className="mobile-sticky-booking fixed inset-x-0 bottom-0 z-50 px-4 py-3 md:hidden" aria-label="Sticky mobile booking action">
      <Link href="/booking" className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#111111] px-5 py-3 text-center text-sm font-extrabold uppercase tracking-[0.18em] text-[#C9A84C] shadow-[0_14px_30px_rgba(17,17,17,.26)] transition hover:bg-[#C9A84C] hover:text-[#111111]">
        Book Now · Secure £20 Deposit
      </Link>
    </div>
  );
}

function Router() {'''
    )
    app = app.replace('          <Router />', '          <Router />\n          <MobileStickyBookingCta />')
    app = app.replace('<ThemeProvider defaultTheme="dark">', '<ThemeProvider defaultTheme="light">')
app_path.write_text(app)

# Homepage lead-generation styling and trust signals.
home_path = root / 'client/src/pages/Home.tsx'
home = home_path.read_text()
home = home.replace('bg-card/95 p-4 shadow-[0_24px_80px_rgba(46,27,16,.22)]', 'bg-white p-4 shadow-[0_24px_80px_rgba(26,26,26,.12)]')
home = home.replace('bg-black/20 p-4 transition hover:border-primary/50 hover:bg-primary/10', 'bg-[#FAF7F2] p-4 transition hover:border-primary/50 hover:bg-[#fff8df]')
home = home.replace('text-white/58', 'text-[#4A4A4A]')
home = home.replace('border border-white/10 bg-black/20 p-4 text-sm text-[#4A4A4A]', 'border border-primary/20 bg-[#FAF7F2] p-4 text-sm text-[#4A4A4A]')
home = home.replace('mt-3 text-sm text-white/55', 'mt-3 text-sm font-medium text-[#4A4A4A]')
trust = '''\n        <section className="container relative z-20 mt-6">\n          <div className="warm-trust-strip grid gap-4 rounded-[1.75rem] p-4 sm:grid-cols-3 sm:p-5">\n            <div className="rounded-2xl bg-[#FAF7F2] p-4 text-center">\n              <strong className="serif block text-3xl text-[#111111]">500+</strong>\n              <span className="text-sm font-bold uppercase tracking-[0.18em] text-[#4A4A4A]">Happy clients</span>\n            </div>\n            <div className="rounded-2xl bg-[#FAF7F2] p-4 text-center">\n              <strong className="serif block text-3xl text-[#111111]">8+ years</strong>\n              <span className="text-sm font-bold uppercase tracking-[0.18em] text-[#4A4A4A]">Protective styling experience</span>\n            </div>\n            <div className="rounded-2xl bg-[#111111] p-4 text-center">\n              <strong className="serif block text-3xl text-[#C9A84C]">Pain-free</strong>\n              <span className="text-sm font-bold uppercase tracking-[0.18em] text-[#C9A84C]">Comfort guarantee badge</span>\n            </div>\n          </div>\n        </section>\n'''
if '500+' not in home:
    home = home.replace('        <HomepageLiveSearch />', '        <HomepageLiveSearch />' + trust)
home_path.write_text(home)

# Ensure review form page also inherits readable warm background if it has a dark shell marker.
reviews_path = root / 'client/src/pages/Reviews.tsx'
if reviews_path.exists():
    reviews = reviews_path.read_text()
    reviews = reviews.replace('bg-[#080604]', 'bg-[#FAF7F2]').replace('text-white', 'text-[#1A1A1A]')
    reviews_path.write_text(reviews)
