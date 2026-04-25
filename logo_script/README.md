# Logo Icon Generator

Generate Electron-compatible icon assets from `logo.png`.

## Prerequisites

- [uv](https://github.com/astral-sh/uv) installed on your system

## Usage

```bash
uv run --with Pillow generate_icons.py
```

This installs `Pillow` in an isolated environment and runs the script — no manual `pip install` needed.

## Input

Place your logo file as `logo.png` in the same directory as this script.

## Output

All generated files go into `electron_logo_assets/`:

| File | Platform / Purpose |
|---|---|
| `icon.ico` | Windows (multi-size: 16–256px) |
| `icon.icns` | macOS |
| `icon.iconset/` | macOS iconset source folder (10 sizes) |
| `icon.png` | 512×512, standard Electron icon |
| `icon-16x16.png` ~ `icon-1024x1024.png` | 9 individual PNG sizes |
| `electron_logo_assets.zip` | All assets packaged |

## Electron Builder Configuration

```json
{
  "build": {
    "icon": "build/icon",
    "mac": { "icon": "build/icon.icns" },
    "win": { "icon": "build/icon.ico" },
    "linux": { "icon": "build/icon.png" }
  }
}
```

Copy the relevant icon files into your project's `build/` directory.

## Notes

- The logo is centered on a transparent canvas before resizing, so non-square logos are handled correctly.
- Re-run the command any time you update `logo.png` — it will overwrite existing output.
