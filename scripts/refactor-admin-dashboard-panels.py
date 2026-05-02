from pathlib import Path

path = Path('/home/ubuntu/ebysplace-rebuild/client/src/pages/Admin.tsx')
text = path.read_text()

replacements = [
    (
        '  { label: "Content", sectionId: "content", description: "Open homepage content and CEO image controls." },\n',
        ''
    ),
    (
        '''  const uploadWebsiteSectionImage = trpc.admin.uploadWebsiteSectionImage.useMutation({
    onSuccess: (uploaded) => {
      setContent((current) => ({ ...current, imageUrl: uploaded.url }));
      refresh();
      toast.success("About Us CEO image uploaded and saved");
    },
    onError: (error: any) => toast.error(error.message),
  });
''',
        ''
    ),
    (
        '  const updateContent = trpc.admin.updateWebsiteSection.useMutation(opts);\n',
        ''
    ),
    (
        '  const [content, setContent] = useState({ sectionKey: "about_us", title: "", eyebrow: "", body: "", ctaLabel: "", ctaHref: "", imageUrl: "" });\n',
        ''
    ),
    (
        '''
  async function handleWebsiteSectionImageUpload(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await uploadWebsiteSectionImage.mutateAsync({ sectionKey: content.sectionKey || "about_us", dataUrl, fileName: file.name });
    } catch (error: any) {
      toast.error(error.message || "About Us CEO image upload failed");
    }
  }
''',
        '\n'
    ),
    (
        '''        <section id="bookings" className="mt-10 lux-card">
          <h2 className="serif text-3xl font-bold">Bookings manager</h2>
''',
        '''        <div className="mt-8 grid gap-6">
          <AdminPanel id="bookings" eyebrow="Appointments" title="Bookings manager" description="Open appointment requests, deposits, dates, and status controls only when you need to manage the diary." icon={CalendarDays} open={isPanelOpen("bookings")} onToggle={() => togglePanel("bookings")}>
'''
    ),
    (
        '''        <section id="orders" className="mt-8 lux-card">
          <h2 className="serif text-3xl font-bold">Shop orders and delivery</h2>
''',
        '''          <AdminPanel id="orders" eyebrow="Fulfilment" title="Shop orders and delivery" description="Review paid orders, customer delivery details, and fulfilment statuses in a protected Eby’s Place order workspace." icon={ShoppingBag} open={isPanelOpen("orders")} onToggle={() => togglePanel("orders")}>
'''
    ),
    (
        '''        <section id="reviews" className="mt-8 lux-card">
          <h2 className="serif text-3xl font-bold">Reviews moderator</h2>
''',
        '''          <AdminPanel id="reviews" eyebrow="Trust & reputation" title="Reviews moderator" description="Approve or reject customer reviews from a focused moderation panel without crowding the daily overview." icon={MessageSquare} open={isPanelOpen("reviews")} onToggle={() => togglePanel("reviews")}>
'''
    ),
    (
        '''        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          <div id="products" className="lux-card">
            <h2 className="serif text-3xl font-bold"><Package className="mr-2 inline text-primary" />Products, prices, stock & SEO</h2>
            <p className="mt-2 text-sm text-white/65">Edit product names, prices, search-friendly slugs, SEO titles, and meta descriptions here. Changes refresh the admin dashboard and public shop after saving.</p>
''',
        '''          <AdminPanel id="products" eyebrow="Shop catalogue" title="Products, prices, stock & SEO" description="Open product names, prices, search-friendly slugs, SEO titles, colour choices, and stock controls when catalogue maintenance is needed." icon={Package} open={isPanelOpen("products")} onToggle={() => togglePanel("products")}>
'''
    ),
    (
        '''          <div id="services" className="lux-card">
            <h2 className="serif text-3xl font-bold"><Scissors className="mr-2 inline text-primary" />Services prices editor</h2>
            <p className="mt-2 text-sm text-white/55">Edit service prices and duration, upload a model image for each exact service name, or paste a storage URL manually.</p>
''',
        '''          <AdminPanel id="services" eyebrow="Service menu" title="Services prices editor" description="Maintain braid-service pricing, duration, and service imagery from a dedicated owner-only panel." icon={Scissors} open={isPanelOpen("services")} onToggle={() => togglePanel("services")}>
'''
    ),
    (
        '''        <section className="mt-8 grid gap-8 lg:grid-cols-3">
          <div id="gallery" className="lux-card">
            <Images className="text-primary" />
            <h2 className="serif mt-3 text-3xl font-bold">Gallery uploader</h2>
            <p className="mt-2 text-sm text-white/55">Use the expandable add-more control to keep the dashboard clear while still uploading fresh gallery work when needed.</p>
''',
        '''          <AdminPanel id="gallery" eyebrow="Portfolio" title="Gallery uploader" description="Open the gallery uploader when adding fresh braid, twist, loc, kids-style, or behind-the-chair images." icon={Images} open={isPanelOpen("gallery")} onToggle={() => togglePanel("gallery")}>
'''
    ),
    (
        '''          <div id="users" className="lux-card">
            <Users className="text-primary" />
            <h2 className="serif mt-3 text-3xl font-bold">Admin users</h2>
            <p className="mt-3 text-white/60">
              Authentication uses Manus OAuth with admin role protection on every backend dashboard procedure. Promote
              additional admins by updating the user role in the database management panel.
            </p>
          </div>
        </section>
''',
        '''          <AdminPanel id="users" eyebrow="Owner access" title="Admin users" description="Review secure owner access guidance and keep role-protected management controls separate from customer-facing pages." icon={Users} open={isPanelOpen("users")} onToggle={() => togglePanel("users")}>
            <p className="text-white/60">
              Eby’s Place uses secure owner sign-in with admin role protection on every backend dashboard procedure. Promote
              additional admins by updating the user role in the database management panel.
            </p>
          </AdminPanel>
        </div>
'''
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Missing expected block:\n{old[:240]}')
    text = text.replace(old, new, 1)

# Replace first three direct section closings with AdminPanel closings after bookings, orders, reviews.
for _ in range(3):
    marker = '        </section>\n'
    idx = text.find(marker, text.find('<AdminPanel id="bookings"'))
    if idx == -1:
        raise SystemExit('Could not find a direct section closing to convert')
    text = text[:idx] + '          </AdminPanel>\n' + text[idx + len(marker):]

# Convert product and service div closings plus the old surrounding section closing.
product_start = text.find('<AdminPanel id="products"')
service_start = text.find('<AdminPanel id="services"')
if product_start == -1 or service_start == -1:
    raise SystemExit('Product or service panel start missing')
old_between = '          </div>\n\n          <AdminPanel id="services"'
between_idx = text.find(old_between, product_start)
if between_idx == -1:
    raise SystemExit('Product closing before service panel missing')
text = text[:between_idx] + '          </AdminPanel>\n\n          <AdminPanel id="services"' + text[between_idx + len(old_between):]
old_service_end = '          </div>\n        </section>\n\n          <AdminPanel id="gallery"'
service_end_idx = text.find(old_service_end, service_start)
if service_end_idx == -1:
    raise SystemExit('Service closing and old section boundary missing')
text = text[:service_end_idx] + '          </AdminPanel>\n\n          <AdminPanel id="gallery"' + text[service_end_idx + len(old_service_end):]

# Remove the old Content & analytics card entirely.
content_block_start = text.find('          <div className="lux-card">\n            <TrendingUp className="text-primary" />\n            <h2 className="serif mt-3 text-3xl font-bold">Content & analytics</h2>')
if content_block_start != -1:
    users_start = text.find('          <AdminPanel id="users"', content_block_start)
    if users_start == -1:
        raise SystemExit('Could not locate admin users panel after content block')
    text = text[:content_block_start] + text[users_start:]

# Gallery card closing to AdminPanel closing, if still a div close before users.
gallery_closing = '          </div>\n\n          <AdminPanel id="users"'
gallery_idx = text.find(gallery_closing, text.find('<AdminPanel id="gallery"'))
if gallery_idx == -1:
    raise SystemExit('Gallery closing before users missing')
text = text[:gallery_idx] + '          </AdminPanel>\n\n          <AdminPanel id="users"' + text[gallery_idx + len(gallery_closing):]

path.write_text(text)
print('Admin dashboard panels refactored.')
