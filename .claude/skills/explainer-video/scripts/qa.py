"""Contact sheet: one frame per beat in a labelled grid, for a quick visual check
for clipped/overflowing text before a video ships. In a full render the frames
are pulled from the finished MP4 (what the viewer sees, Ken Burns included);
in --preview they are the slide PNGs.
"""
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw, ImageFont

COLS, TW, TH, LABEL_H, GAP = 4, 640, 360, 58, 14


def _font(size, bold=False):
    for p, idx in (("/System/Library/Fonts/Avenir Next.ttc", 2 if bold else 0),
                   ("/System/Library/Fonts/Helvetica.ttc", 1 if bold else 0)):
        try:
            return ImageFont.truetype(p, size, index=idx)
        except Exception:
            continue
    return ImageFont.load_default()


def frames_from_video(video, times, workdir):
    os.makedirs(workdir, exist_ok=True)

    def grab(it):
        k, t = it
        p = os.path.join(workdir, f"qa_{k:03d}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1",
                        "-vf", f"scale={TW}:{TH}:flags=lanczos", p], check=True)
        return p
    with ThreadPoolExecutor(8) as ex:
        return list(ex.map(grab, enumerate(times)))


def sheet(images, labels, out, title=""):
    n = len(images)
    rows = (n + COLS - 1) // COLS
    head = 64 if title else 0
    W = COLS * TW + (COLS + 1) * GAP
    H = head + rows * (TH + LABEL_H) + (rows + 1) * GAP
    canvas = Image.new("RGB", (W, H), (32, 31, 30))
    d = ImageDraw.Draw(canvas)
    f_lab, f_txt, f_head = _font(20, True), _font(18), _font(28, True)
    if title:
        d.text((GAP + 4, 18), title, fill=(235, 230, 222), font=f_head)
    for i, (p, lab) in enumerate(zip(images, labels)):
        r, c = divmod(i, COLS)
        x = GAP + c * (TW + GAP)
        y = head + GAP + r * (TH + LABEL_H + GAP)
        im = Image.open(p).convert("RGB")
        if im.size != (TW, TH):
            im = im.resize((TW, TH), Image.Resampling.LANCZOS)
        canvas.paste(im, (x, y))
        tag, text = lab
        d.text((x + 2, y + TH + 8), tag, fill=(228, 168, 83), font=f_lab)
        tw = d.textlength(tag, font=f_lab)
        line = text
        while line and d.textlength(line, font=f_txt) > TW - tw - 20:
            line = line[:-2]
        if line != text:
            line = line.rstrip() + "…"
        d.text((x + tw + 14, y + TH + 10), line, fill=(200, 194, 185), font=f_txt)
    canvas.save(out)
    return out
