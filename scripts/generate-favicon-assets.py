from pathlib import Path
from PIL import Image, ImageDraw
import json

PROJECT = Path('/home/ubuntu/ebysplace-rebuild')
PUBLIC = PROJECT / 'client' / 'public'
STATIC = Path('/home/ubuntu/webdev-static-assets/ebysplace')
SOURCE_ICON_LOGO = STATIC / 'ebysplace-logo-transparent.png'
SOURCE_WIDE_LOGO = STATIC / 'top-header-logo-1000220440-cropped-transparent.png'
PUBLIC.mkdir(parents=True, exist_ok=True)

BG = (243, 232, 214, 255)  # warm Eby's Place cream
BLACK = (8, 7, 5, 255)
GOLD = (190, 151, 49, 255)


def alpha_bbox(img: Image.Image):
    alpha = img.getchannel('A') if img.mode == 'RGBA' else img.convert('RGBA').getchannel('A')
    return alpha.getbbox()


def contain_on_canvas(img: Image.Image, size: tuple[int, int], padding_ratio: float = 0.12, bg=BG):
    img = img.convert('RGBA')
    bbox = alpha_bbox(img)
    if bbox:
        img = img.crop(bbox)
    canvas = Image.new('RGBA', size, bg)
    max_w = int(size[0] * (1 - padding_ratio * 2))
    max_h = int(size[1] * (1 - padding_ratio * 2))
    img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    x = (size[0] - img.width) // 2
    y = (size[1] - img.height) // 2
    canvas.alpha_composite(img, (x, y))
    return canvas


def make_icon_source():
    logo = Image.open(SOURCE_ICON_LOGO).convert('RGBA')
    bbox = alpha_bbox(logo)
    if bbox:
        logo = logo.crop(bbox)
    # Crop the icon/emblem area above the wordmark so the favicon is readable at small sizes.
    w, h = logo.size
    icon_crop = logo.crop((0, 0, w, int(h * 0.56)))
    bbox = alpha_bbox(icon_crop)
    if bbox:
        icon_crop = icon_crop.crop(bbox)
    return icon_crop

icon_source = make_icon_source()

# Browser favicon and PWA/mobile shortcut icons.
for size, name in [
    (16, 'favicon-16x16.png'),
    (32, 'favicon-32x32.png'),
    (180, 'apple-touch-icon.png'),
    (192, 'android-chrome-192x192.png'),
    (512, 'android-chrome-512x512.png'),
]:
    contain_on_canvas(icon_source, (size, size), 0.10 if size < 64 else 0.14).convert('RGB').save(PUBLIC / name, optimize=True)

ico_images = [Image.open(PUBLIC / f'favicon-{size}x{size}.png').convert('RGBA') for size in (16, 32)]
ico_images.append(contain_on_canvas(icon_source, (48, 48), 0.10))
ico_images[0].save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico_images[1:])

manifest = {
    'name': "Eby’s Place",
    'short_name': "Eby’s Place",
    'description': 'Luxury pain-free braiding in Somerset, UK.',
    'start_url': '/',
    'scope': '/',
    'display': 'standalone',
    'background_color': '#f3e8d6',
    'theme_color': '#070604',
    'icons': [
        {'src': '/android-chrome-192x192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any maskable'},
        {'src': '/android-chrome-512x512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'},
    ],
}
(PUBLIC / 'site.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Social/link preview card. Store in static-assets for upload rather than keeping a large image in the project public folder.
preview = Image.new('RGBA', (1200, 630), BG)
draw = ImageDraw.Draw(preview)
# subtle branded border and gold accent line
for i in range(0, 12):
    draw.rectangle((i, i, 1199 - i, 629 - i), outline=(190, 151, 49, max(35 - i * 2, 8)))
draw.rectangle((72, 78, 1128, 552), outline=(190, 151, 49, 120), width=3)
wide_logo = Image.open(SOURCE_WIDE_LOGO).convert('RGBA')
wide_card = contain_on_canvas(wide_logo, (980, 360), 0.05, bg=(243, 232, 214, 0))
preview.alpha_composite(wide_card, ((1200 - wide_card.width) // 2, 112))
# Add a minimal brand line for previews while keeping the logo dominant.
try:
    from PIL import ImageFont
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf', 48)
except Exception:
    font = None
text = 'Zero pain. Zero trauma. Just perfection.'
text_bbox = draw.textbbox((0, 0), text, font=font)
draw.text(((1200 - (text_bbox[2] - text_bbox[0])) // 2, 500), text, fill=BLACK, font=font)
preview.convert('RGB').save(STATIC / 'ebysplace-link-preview.png', quality=92, optimize=True)

print('Generated favicon, mobile shortcut, manifest, and link-preview assets.')
print(STATIC / 'ebysplace-link-preview.png')
