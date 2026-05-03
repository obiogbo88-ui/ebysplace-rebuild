#!/usr/bin/env python3
from __future__ import annotations

import os
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path('/home/ubuntu/ebysplace-rebuild')
OUTPUT = ROOT / 'all-media-urls.txt'

MEDIA_EXTS = {
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif', '.bmp',
    '.tif', '.tiff', '.mp4', '.webm', '.mov', '.m4v', '.mp3', '.wav', '.ogg', '.m4a', '.pdf'
}
TEXT_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css', '.svg', '.xml', '.webmanifest'}

INCLUDE_PREFIXES = (
    'client/src/', 'client/index.html', 'client/public/', 'server/db.ts', 'server/routers.ts',
    'server/stripeWebhook.ts', 'server/vercel.ts', 'server/_core/', 'shared/', 'storage/',
    'drizzle/', 'vercel.json', 'package.json'
)
EXCLUDE_PATTERNS = (
    '.test.', '.spec.', '/node_modules/', '/.git/', '/dist/', '/coverage/', '/.manus-logs/', '/.vercel/',
    'client/src/pages/ComponentShowcase.tsx'
)

URL_RE = re.compile(r"(?P<url>(?:https?:)?//[^\s'\"<>`)]+|/(?:manus-storage|assets|images|media|uploads|icons|favicon|apple-touch-icon|og-image|logo)[^\s'\"<>`)]*)")
STRING_RE = re.compile(r"['\"](?P<value>[^'\"]{1,700})['\"]")
CSS_URL_RE = re.compile(r"url\((?P<value>[^)]+)\)")
ENV_RE = re.compile(r"(?:import\.meta\.env\.|process\.env\.)(?P<name>[A-Z0-9_]+)")
IMAGE_BY_SLUG_RE = re.compile(r'imageBySlug\["(?P<slug>[^"]+)"\]')
SERVICE_BLOCK_RE = re.compile(r'\{[^{}]*?slug:\s*"(?P<slug>[^"]+)"[\s\S]*?imageUrl:\s*"(?P<url>/manus-storage/[^"]+)"[\s\S]*?\}', re.MULTILINE)

CATEGORIES = [
    'Hero Images And Homepage Media',
    'Logo, Favicon, Metadata, And Brand Assets',
    'Service Images',
    'Product Images',
    'Gallery Images',
    'AI Try-On Media',
    'Review And Testimonial Media',
    'Storage, Proxy, And Runtime Media Paths',
    'Other Site Media References',
]

records: dict[tuple[str, str], dict] = {}
slug_to_url: dict[str, str] = {}

def rel(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace(os.sep, '/')


def should_scan(path: Path) -> bool:
    relative = rel(path)
    normalized = '/' + relative
    if any(pattern in normalized or pattern in relative for pattern in EXCLUDE_PATTERNS):
        return False
    return any(relative == prefix.rstrip('/') or relative.startswith(prefix) for prefix in INCLUDE_PREFIXES)


def clean(value: str) -> str:
    return value.strip().strip('"\'`').rstrip('.,;:').replace('&amp;', '&')


def parsed_suffix(value: str) -> str:
    try:
        return Path(urlparse(value).path).suffix.lower()
    except ValueError:
        return ''


def looks_like_media(value: str) -> bool:
    v = clean(value)
    if not v or len(v) < 2 or '\\' in v or '.test(' in v:
        return False
    lower = v.lower().split('?')[0].split('#')[0]
    if lower.startswith('$') and any(token in lower for token in ['logo', 'image', 'icon', 'media', 'asset']):
        return True
    if '/manus-storage/' in lower or lower.startswith('/manus-storage'):
        return True
    if any(token in lower for token in ['images.unsplash.com', 'res.cloudinary.com']):
        return True
    if lower.startswith(('http://', 'https://', '//', '/', './', '../')):
        suffix = parsed_suffix(lower)
        return suffix in MEDIA_EXTS or any(token in lower for token in ['/favicon', 'apple-touch-icon', 'og-image', '/logo'])
    return Path(lower).suffix.lower() in MEDIA_EXTS


def categorize(url: str, source: str, line_text: str, forced: str | None = None) -> str:
    if forced:
        return forced
    combined = f'{url} {source} {line_text}'.lower()
    if any(k in combined for k in ['home.tsx', 'hero', 'header_video', 'homepage']):
        return 'Hero Images And Homepage Media'
    if any(k in combined for k in ['logo', 'favicon', 'icon', 'manifest', 'og-image', 'apple-touch', 'metadata', 'index.html']):
        return 'Logo, Favicon, Metadata, And Brand Assets'
    if any(k in combined for k in ['service', 'services']):
        return 'Service Images'
    if any(k in combined for k in ['product', 'shop', 'order']):
        return 'Product Images'
    if 'gallery' in combined:
        return 'Gallery Images'
    if any(k in combined for k in ['try-on', 'tryon', 'ai try']):
        return 'AI Try-On Media'
    if any(k in combined for k in ['review', 'testimonial']):
        return 'Review And Testimonial Media'
    if any(k in combined for k in ['manus-storage', 'storageproxy', 'storage proxy']):
        return 'Storage, Proxy, And Runtime Media Paths'
    return 'Other Site Media References'


def add_record(url: str, source: Path, line_no: int, line_text: str, note: str | None = None, forced_category: str | None = None):
    url = clean(url)
    if not looks_like_media(url) or url.startswith('data:'):
        return
    relative_source = rel(source)
    category = categorize(url, relative_source, line_text, forced_category)
    key = (category, url)
    entry = records.setdefault(key, {'url': url, 'category': category, 'sources': set(), 'notes': set()})
    entry['sources'].add(f'{relative_source}:{line_no}')
    if note:
        entry['notes'].add(note)

# Build the service slug -> image URL map so product and gallery references that use imageBySlug are explicit.
db_path = ROOT / 'server/db.ts'
if db_path.exists():
    db_text = db_path.read_text(encoding='utf-8', errors='ignore')
    for match in SERVICE_BLOCK_RE.finditer(db_text):
        slug_to_url[match.group('slug')] = match.group('url')

for path in ROOT.rglob('*'):
    if not path.is_file() or not should_scan(path):
        continue
    suffix = path.suffix.lower()
    if suffix in MEDIA_EXTS:
        public_path = '/' + rel(path)
        if public_path.startswith('/client/public/'):
            public_path = '/' + public_path.removeprefix('/client/public/')
        add_record(public_path, path, 1, 'local site media file', 'Local repository media file; migrate/upload if this path is used by deployed pages.')
        continue
    if suffix not in TEXT_EXTS:
        continue
    text = path.read_text(encoding='utf-8', errors='ignore')
    db_sections = {}
    if rel(path) == 'server/db.ts':
        db_sections = {
            'seedProducts': text.find('const seedProducts'),
            'seedReviews': text.find('const seedReviews'),
            'seedGallery': text.find('const seedGallery'),
            'afterSeedGallery': text.find('function isPositivePrice'),
        }
    char_pos = 0
    for line_no, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith(('//', '*')):
            char_pos += len(line) + 1
            continue
        forced_category = None
        if rel(path) == 'server/db.ts':
            if db_sections['seedProducts'] <= char_pos < db_sections['seedReviews']:
                forced_category = 'Product Images'
            elif db_sections['seedGallery'] <= char_pos < db_sections['afterSeedGallery']:
                forced_category = 'Gallery Images'
        for pattern in (URL_RE, CSS_URL_RE, STRING_RE):
            for match in pattern.finditer(line):
                value = match.groupdict().get('url') or match.groupdict().get('value')
                if value:
                    add_record(value, path, line_no, line, forced_category=forced_category)
        for match in IMAGE_BY_SLUG_RE.finditer(line):
            slug = match.group('slug')
            resolved = slug_to_url.get(slug)
            if resolved:
                add_record(resolved, path, line_no, line, f'Resolved from imageBySlug["{slug}"].', forced_category)
        for match in ENV_RE.finditer(line):
            env_name = match.group('name')
            if any(token in env_name.lower() for token in ['logo', 'image', 'icon', 'media', 'asset']):
                add_record(f'${env_name}', path, line_no, line, 'Runtime environment media value; resolve the actual deployment value before R2 migration.')
        char_pos += len(line) + 1

by_category = defaultdict(list)
for entry in records.values():
    by_category[entry['category']].append(entry)
for entries in by_category.values():
    entries.sort(key=lambda e: e['url'].lower())

total_usage_rows = sum(len(entries) for entries in by_category.values())
unique_urls = len({entry['url'] for entry in records.values()})
lines: list[str] = []
lines.append('Eby’s Place Complete Media URL Inventory')
lines.append('Generated for Cloudflare R2 migration planning.')
lines.append('')
lines.append(f'Total category-specific media usages: {total_usage_rows}')
lines.append(f'Total unique media URLs/paths: {unique_urls}')
lines.append('')
lines.append('Scope: runtime frontend source, server seed data, tRPC/server routes, metadata, manifests, CSS, deploy configuration, shared/storage code, and local media files in client/public. Test files, audit notes, generated build output, dependencies, and scanner implementation artifacts are excluded so this file reflects media used by the site itself. Shared service images reused by products or gallery are intentionally repeated under each relevant category.')
lines.append('')

for category in CATEGORIES:
    entries = by_category.get(category, [])
    if not entries:
        continue
    lines.append('=' * 88)
    lines.append(category)
    lines.append('=' * 88)
    lines.append('')
    for idx, entry in enumerate(entries, 1):
        lines.append(f'{idx}. {entry["url"]}')
        lines.append(f'   Sources: {", ".join(sorted(entry["sources"]))}')
        if entry['notes']:
            lines.append(f'   Notes: {"; ".join(sorted(entry["notes"]))}')
        lines.append('')

OUTPUT.write_text('\n'.join(lines).rstrip() + '\n', encoding='utf-8')
print(f'Wrote {OUTPUT} with {total_usage_rows} category-specific usages and {unique_urls} unique URLs/paths.')
