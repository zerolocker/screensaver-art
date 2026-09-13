#!/usr/bin/env python3
"""Render the title pill burned under the art in the social clips.

It mirrors the pill the screensaver itself shows under the art
(screensaver-macos/ScreensaverArtExtension/ScreensaverArtView.swift, buildTitlePill):
a dark, translucent, fully rounded pill with the piece's name in the system font
at medium weight, over a soft shadow. Sized for a 1080-wide frame seen on a phone.

Called by make-social-assets.mjs, which overlays the PNG with ffmpeg. Prints the
PNG's geometry as one line of JSON so the caller can place it. Pillow is already
a dependency of the nightly curation (the nano-banana-pro and veo3-video-gen
skills import it).
"""

import argparse
import json

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# SF Pro first (what the screensaver uses), then a font every Mac has.
FONT_PATHS = ['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Helvetica.ttc']

# The screensaver caps its pill at 85% of the screen width; so does this.
MAX_WIDTH_RATIO = 0.85
MIN_FONT_SIZE = 20

# Transparent border around the pill, so its shadow isn't clipped.
MARGIN = 24


def load_font(size):
    for font_path in FONT_PATHS:
        try:
            font = ImageFont.truetype(font_path, size)
        except OSError:
            continue
        try:
            font.set_variation_by_name('Medium')  # SF Pro is a variable font
        except (AttributeError, OSError, ValueError):
            pass  # not variable (Helvetica): its regular weight will do
        return font
    raise SystemExit('no usable font found in: ' + ', '.join(FONT_PATHS))


def main():
    parser = argparse.ArgumentParser(description='Render the social clips\' title pill.')
    parser.add_argument('--text', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--frame-width', type=int, default=1080)
    parser.add_argument('--font-size', type=int, default=32)
    args = parser.parse_args()

    measure = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    size = args.font_size
    while True:
        font = load_font(size)
        height = round(size * 2.4)
        pad_x = round(height * 0.42)
        width = round(measure.textlength(args.text, font=font)) + 2 * pad_x
        # A long title shrinks rather than wraps: a two-line pill reads as a caption.
        if width <= args.frame_width * MAX_WIDTH_RATIO or size <= MIN_FONT_SIZE:
            break
        size -= 1

    img = Image.new('RGBA', (width + 2 * MARGIN, height + 2 * MARGIN), (0, 0, 0, 0))
    box = (MARGIN, MARGIN, MARGIN + width, MARGIN + height)

    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (box[0], box[1] + 2, box[2], box[3] + 2), radius=height / 2, fill=(0, 0, 0, 80))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)))

    pill = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(pill)
    draw.rounded_rectangle(box, radius=height / 2, fill=(20, 20, 20, 150), outline=(255, 255, 255, 45), width=2)
    draw.text((MARGIN + width / 2, MARGIN + height / 2), args.text, font=font, fill=(245, 245, 245, 255), anchor='mm')
    img.alpha_composite(pill)

    img.save(args.out)
    print(json.dumps({'width': img.width, 'height': img.height, 'margin': MARGIN, 'fontSize': size}))


if __name__ == '__main__':
    main()
