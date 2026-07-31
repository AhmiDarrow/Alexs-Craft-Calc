"""Compose Alien Purple soap-bar app icon masters + PWA sizes from ComfyUI art."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SRC = Path(
    r"C:\Users\Administrator\.remedy\attachments"
    r"\1e953f26-d5db-4aad-9a1c-6f89a655b620\remedy_comfy_00019_.png"
)
PROJ = Path(r"C:\Users\Administrator\Projects\alien-craft-calc")
PUBLIC = PROJ / "public"
PUBLIC.mkdir(exist_ok=True)

BG = (10, 6, 20, 255)  # #0a0614
SIZE = 1024


def round_corners(im: Image.Image, radius_frac: float = 0.22) -> Image.Image:
    im = im.convert("RGBA")
    s = im.size[0]
    r = max(1, int(s * radius_frac))
    mask = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=r, fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(im, (0, 0))
    out.putalpha(mask)
    return out


def save_size(im: Image.Image, path: Path, size: int, rounded: bool = False) -> None:
    out = im.resize((size, size), Image.Resampling.LANCZOS)
    if rounded:
        out = round_corners(out, 0.22)
    out.save(path, "PNG")
    print(f"wrote {path} ({size})")


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    margin = int(side * 0.06)
    box = (left + margin, top + margin, left + side - margin, top + side - margin)
    soap = img.crop(box).resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (SIZE, SIZE), BG)

    # Soft violet glow behind the bar
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx = cy = SIZE // 2
    for r in range(420, 80, -8):
        alpha = int(28 * (1 - (r - 80) / 340))
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(168, 85, 247, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(24))
    canvas = Image.alpha_composite(canvas, glow)

    # ~10% padding so the bar stays readable at small sizes
    pad = int(SIZE * 0.10)
    inner = SIZE - pad * 2
    soap_fit = soap.resize((inner, inner), Image.Resampling.LANCZOS)
    canvas.paste(soap_fit, (pad, pad), soap_fit)

    master = canvas
    master_path = PUBLIC / "app-icon-source.png"
    master.save(master_path, "PNG")
    print(f"wrote {master_path}")

    rounded = round_corners(master, 0.22)
    rounded_path = PUBLIC / "app-icon-rounded.png"
    rounded.save(rounded_path, "PNG")
    print(f"wrote {rounded_path}")

    save_size(master, PUBLIC / "pwa-512.png", 512)
    save_size(master, PUBLIC / "pwa-192.png", 192)
    save_size(master, PUBLIC / "pwa-maskable-512.png", 512)
    save_size(master, PUBLIC / "apple-touch-icon.png", 180)
    save_size(master, PUBLIC / "favicon-32.png", 32)
    save_size(master, PUBLIC / "icon-soap.png", 512, rounded=True)
    save_size(master, PUBLIC / "brand-soap.png", 128, rounded=True)

    tauri_src = PROJ / "app-icon.png"
    master.save(tauri_src, "PNG")
    print(f"wrote {tauri_src}")
    print("done")


if __name__ == "__main__":
    main()
