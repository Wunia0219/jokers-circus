"""Export original transparent CG masters without resizing or recompression loss."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'public/downloads/yakyuken'
DEST.mkdir(parents=True, exist_ok=True)
for index in range(3):
    source = ROOT / f'art/yakyuken/dealer/stage-{index}-master.webp'
    with Image.open(source) as image:
        image.convert('RGBA').save(DEST / f'dealer-stage-{index}.png', optimize=True)
