from __future__ import annotations

import json
import os
from pathlib import Path
from urllib import request, error

from PIL import Image, ImageOps

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "ebysplace-media"
SOURCE = Path("/home/ubuntu/webdev-static-assets/ebysplace-supabase-migration-cache/migration-downloads/manus-storage-images/ebysplace-logo-gold-cropped_721223da.png")
OUTPUT_DIR = Path("/home/ubuntu/webdev-static-assets/ebysplace-media-repairs")
OUTPUT = OUTPUT_DIR / "ebysplace-about-story-portrait.png"
OBJECT_KEY = "ebysplace-about-story-portrait.png"

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
if not SOURCE.exists():
    raise SystemExit(f"Source image not found: {SOURCE}")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

with Image.open(SOURCE) as image:
    image = image.convert("RGBA")
    width, height = image.size
    # Use only the clean braided silhouette from the logo asset. This avoids presenting a fake CEO photo while
    # giving the About portrait slot a branded visual that survives the circular crop used on the site.
    left = int(width * 0.04)
    top = int(height * 0.02)
    right = int(width * 0.96)
    bottom = int(height * 0.63)
    cropped = image.crop((left, top, right, bottom))
    background = Image.new("RGBA", cropped.size, (14, 9, 6, 255))
    background.alpha_composite(cropped)
    square = ImageOps.pad(background, (900, 900), method=Image.Resampling.LANCZOS, color=(14, 9, 6, 255), centering=(0.5, 0.45))
    canvas = Image.new("RGBA", (1024, 1024), (14, 9, 6, 255))
    canvas.alpha_composite(square.resize((900, 900), Image.Resampling.LANCZOS), (62, 62))
    canvas.save(OUTPUT, "PNG", optimize=True)

upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{OBJECT_KEY}"
headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "image/png",
    "x-upsert": "true",
}
with OUTPUT.open("rb") as handle:
    data = handle.read()
req = request.Request(upload_url, data=data, headers=headers, method="POST")
try:
    with request.urlopen(req, timeout=60) as response:
        upload_body = response.read().decode("utf-8", errors="replace")
        upload_status = response.status
except error.HTTPError as exc:
    raise SystemExit(f"Upload failed {exc.code}: {exc.read().decode('utf-8', errors='replace')}") from exc

public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{OBJECT_KEY}"
patch_url = f"{SUPABASE_URL}/rest/v1/websiteSections?sectionKey=eq.about_us"
patch_headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}
patch_body = json.dumps({"portraitImageUrl": public_url, "imageUrl": public_url}).encode("utf-8")
patch_req = request.Request(patch_url, data=patch_body, headers=patch_headers, method="PATCH")
try:
    with request.urlopen(patch_req, timeout=60) as response:
        patch_body_text = response.read().decode("utf-8", errors="replace")
        patch_status = response.status
except error.HTTPError as exc:
    raise SystemExit(f"Patch failed {exc.code}: {exc.read().decode('utf-8', errors='replace')}") from exc

head_req = request.Request(public_url, method="HEAD")
try:
    with request.urlopen(head_req, timeout=60) as response:
        head_status = response.status
except error.HTTPError as exc:
    head_status = exc.code

print(json.dumps({
    "output": str(OUTPUT),
    "objectKey": OBJECT_KEY,
    "publicUrl": public_url,
    "uploadStatus": upload_status,
    "patchStatus": patch_status,
    "headStatus": head_status,
    "patchResponse": json.loads(patch_body_text or "[]"),
}, indent=2))
