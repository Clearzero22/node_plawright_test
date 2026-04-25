from PIL import Image
from pathlib import Path
import zipfile

src = Path(__file__).parent / "logo.png"
out_dir = Path(__file__).parent / "electron_logo_assets"
out_dir.mkdir(exist_ok=True)

img = Image.open(src).convert("RGBA")
w, h = img.size
side = max(w, h)
canvas = Image.new("RGBA", (side, side), (255, 255, 255, 0))
canvas.alpha_composite(img, ((side - w) // 2, (side - h) // 2))

sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
for s in sizes:
    resized = canvas.resize((s, s), Image.Resampling.LANCZOS)
    resized.save(out_dir / f"icon-{s}x{s}.png")

canvas.resize((512, 512), Image.Resampling.LANCZOS).save(out_dir / "icon.png")

ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
canvas.save(out_dir / "icon.ico", sizes=ico_sizes)

try:
    canvas.resize((1024, 1024), Image.Resampling.LANCZOS).save(out_dir / "icon.icns")
except Exception:
    pass

iconset = out_dir / "icon.iconset"
iconset.mkdir(exist_ok=True)
mac_map = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}
for name, s in mac_map.items():
    canvas.resize((s, s), Image.Resampling.LANCZOS).save(iconset / name)

zip_path = out_dir.parent / "electron_logo_assets.zip"
if zip_path.exists():
    zip_path.unlink()
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for f in out_dir.rglob("*"):
        z.write(f, f.relative_to(out_dir.parent))

print(f"Done. Assets written to: {out_dir}")
print(f"Zip: {zip_path}")
