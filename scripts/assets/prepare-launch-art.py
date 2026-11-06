"""Encode the three approved launch paintings without changing their pixels."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCES = [
    ('golden-salon', 'art/launch-screen/review-v2/background-01-golden-salon.png'),
    ('last-spin', 'art/launch-screen/review-v6/background-02-last-spin.png'),
    ('curtain-rises', 'art/launch-screen/review-v8/background-03-curtain-rises.png'),
]
REVIEW_SOURCES = [
    'review-v1/background.png', 'review-v1/loading-wordmark.png',
    'review-v2/background-01-golden-salon.png', 'review-v2/background-02-midnight-roulette.png', 'review-v2/background-03-crimson-stage.png',
    'review-v3/background-02-last-spin.png', 'review-v3/background-03-curtain-rises.png',
    'review-v4/background-02-last-spin.png', 'review-v5/background-02-last-spin.png', 'review-v6/background-02-last-spin.png',
    'review-v7/background-03-curtain-rises.png', 'review-v8/background-03-curtain-rises.png',
]

# Explicit provenance inventory, not a wildcard exemption for new runtime PNGs.
reviews = []
for name in REVIEW_SOURCES:
    source = ROOT / 'art/launch-screen' / name
    with Image.open(source) as image:
        reviews.append(dict(file=source.relative_to(ROOT).as_posix(), dimensions=list(image.size),
                            sha256=hashlib.sha256(source.read_bytes()).hexdigest()))
(ROOT / 'art/launch-screen/review-sources.json').write_text(
    json.dumps(dict(purpose='offline design review originals; never referenced by the runtime', images=reviews), indent=2) + '\n', encoding='utf8')

records = []
for name, source in SOURCES:
    original = ROOT / source
    target = ROOT / 'images/launch' / (name + '.webp')
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(original) as painting:
        rgba = painting.convert('RGBA')
        rgba.save(target, 'WEBP', lossless=True, exact=True, quality=90, method=6)
        with Image.open(target) as check:
            if check.size != rgba.size or check.convert('RGBA').tobytes() != rgba.tobytes():
                raise ValueError('Launch painting pixels changed: ' + name)
        records.append(dict(id=name, source=source, output=target.relative_to(ROOT).as_posix(),
                            dimensions=list(rgba.size), bytes=target.stat().st_size,
                            sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest(),
                            rgbaSha256=hashlib.sha256(rgba.tobytes()).hexdigest(),
                            outputSha256=hashlib.sha256(target.read_bytes()).hexdigest()))
(ROOT / 'art/launch-screen/approved-assets.json').write_text(
    json.dumps(dict(approved=True, encoding='lossless WebP; exact RGBA verified', images=records), indent=2) + '\n', encoding='utf8')
print(json.dumps(dict(images=len(records), bytes=sum(r['bytes'] for r in records), exactPixels=True)))
