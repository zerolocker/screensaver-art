"""Images for the `images` template: resolve (local path or http URL), normalise,
and render smooth Ken Burns clips.

Ken Burns is done in PIL with sub-pixel crop rectangles (ffmpeg's zoompan rounds
to whole pixels, which judders on slow moves) and encoded once per
(image, size, duration, direction) — cached, so re-renders are free.
"""
import hashlib
import json
import math
import os
import shutil
import subprocess
import urllib.request

from PIL import Image

MAX_SIDE = 2600


def _h(*parts):
    return hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:20]


def locate(src, base_dir, cache_dir, kind="img"):
    """Local path (absolute, or relative to the spec / cwd) or http(s) URL -> local file."""
    src = str(src)
    os.makedirs(os.path.join(cache_dir, kind), exist_ok=True)
    if src.startswith(("http://", "https://")):
        raw = os.path.join(cache_dir, kind, "dl-" + _h(src) + os.path.splitext(src.split("?")[0])[1][:6])
        if not os.path.exists(raw):
            req = urllib.request.Request(src, headers={"User-Agent": "video-reply/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r, open(raw + ".tmp", "wb") as f:
                shutil.copyfileobj(r, f)
            os.replace(raw + ".tmp", raw)
        return raw
    cands = [os.path.expanduser(src)] if os.path.isabs(os.path.expanduser(src)) else \
        [os.path.join(base_dir, src), os.path.abspath(src)]
    path = next((c for c in cands if os.path.exists(c)), None)
    if not path:
        raise FileNotFoundError(f"{'image' if kind == 'img' else 'video'} not found: {src} (looked in {', '.join(cands)})")
    return path


def resolve(src, base_dir, cache_dir):
    """-> (normalised RGB image path, width, height)."""
    path = locate(src, base_dir, cache_dir, "img")
    st = os.stat(path)
    out = os.path.join(cache_dir, "img", "n-" + _h(os.path.abspath(path), st.st_size, st.st_mtime) + ".png")
    if not os.path.exists(out):
        im = Image.open(path)
        im = im.convert("RGB")
        if max(im.size) > MAX_SIDE:
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        im.save(out + ".tmp.png")
        os.replace(out + ".tmp.png", out)
    with Image.open(out) as im:
        w, h = im.size
    return out, w, h


def _ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, t)))


def kenburns(img_path, w, h, dur, fps, variant, cache_dir, zoom=1.075):
    """Render a w×h clip of `dur` seconds with a gentle eased zoom + drift."""
    os.makedirs(os.path.join(cache_dir, "kb"), exist_ok=True)
    st = os.stat(img_path)
    key = _h(img_path, st.st_size, w, h, round(dur, 2), fps, variant, zoom)
    out = os.path.join(cache_dir, "kb", key + ".mp4")
    if os.path.exists(out):
        return out
    src = Image.open(img_path).convert("RGB")
    # cover-crop to the frame aspect, at ~zoom× the frame size so zoom-in stays sharp
    ar = w / h
    sw, sh = src.size
    if sw / sh > ar:
        cw, ch = sh * ar, sh
    else:
        cw, ch = sw, sw / ar
    box = ((sw - cw) / 2, (sh - ch) / 2, (sw + cw) / 2, (sh + ch) / 2)
    bw, bh = int(round(w * zoom * 1.02)), int(round(h * zoom * 1.02))
    base = src.resize((bw, bh), Image.Resampling.LANCZOS, box=box)

    # variants: alternate zoom-in / zoom-out and drift direction
    zin = variant % 2 == 0
    dx, dy = [(1, -1), (-1, 1), (1, 1), (-1, -1)][variant % 4]
    n = max(1, int(round(dur * fps)))
    tmp = out + ".tmp.mp4"
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
         "-r", str(fps), "-i", "-", "-c:v", "libx264", "-preset", "fast", "-crf", "12",
         "-pix_fmt", "yuv420p", tmp], stdin=subprocess.PIPE)
    try:
        for k in range(n):
            e = _ease(k / max(1, n - 1))
            z = 1 + (zoom - 1) * (e if zin else 1 - e)
            vw, vh = bw / z, bh / z
            # drift within the slack the zoom leaves, so the view never leaves the image
            s = (e - 0.5) * 2
            cx = bw / 2 + dx * s * 0.6 * (bw - vw) / 2
            cy = bh / 2 + dy * s * 0.6 * (bh - vh) / 2
            x0 = min(max(cx - vw / 2, 0), bw - vw)
            y0 = min(max(cy - vh / 2, 0), bh - vh)
            fr = base.transform((w, h), Image.Transform.EXTENT, (x0, y0, x0 + vw, y0 + vh),
                                Image.Resampling.BICUBIC)
            proc.stdin.write(fr.tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("ffmpeg failed encoding Ken Burns clip")
    except BaseException:
        proc.kill()
        raise
    os.replace(tmp, out)
    return out


# ---------------------------------------------------------------- video clips
def probe_video(src, base_dir, cache_dir):
    """-> dict(path, w, h, dur, poster) for a clip; poster = a PNG frame for previews."""
    path = locate(src, base_dir, cache_dir, "vid")
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height:stream_side_data=rotation:format=duration", "-of", "json", path],
                       capture_output=True, text=True)
    try:
        j = json.loads(p.stdout)
        st = j["streams"][0]
        w, h = int(st["width"]), int(st["height"])
        dur = float(j["format"]["duration"])
    except Exception:
        raise RuntimeError(f"not a readable video: {src}")
    rot = 0
    for sd in st.get("side_data_list", []) or []:
        rot = int(sd.get("rotation", 0) or 0)
    if abs(rot) % 180 == 90:  # ffmpeg autorotates phone footage
        w, h = h, w
    s = os.stat(path)
    poster = os.path.join(cache_dir, "vid", "poster-" + _h(path, s.st_size, s.st_mtime) + ".png")
    if not os.path.exists(poster):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{min(1.0, dur / 2):.2f}", "-i", path,
                        "-frames:v", "1", poster + ".tmp.png"], check=True)
        os.replace(poster + ".tmp.png", poster)
    return {"path": path, "w": w, "h": h, "dur": dur, "poster": poster}


def prepare_clip(path, w, h, dur, fps, loop, cache_dir, bg="0x0c0b0a"):
    """Normalise a clip to exactly w×h @ fps, `dur` seconds, no audio: letterboxed
    (never cropped) on the theme background; looped or frozen on its last frame
    when the scene outlasts it. Cached."""
    s = os.stat(path)
    key = _h(path, s.st_size, s.st_mtime, w, h, round(dur, 2), fps, loop, bg)
    out = os.path.join(cache_dir, "vid", "clip-" + key + ".mp4")
    if os.path.exists(out):
        return out
    vf = (f"fps={fps},scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
          f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={bg},setsar=1,format=yuv420p")
    if not loop:
        vf += f",tpad=stop_mode=clone:stop_duration={dur:.3f}"
    args = ["ffmpeg", "-v", "error", "-y"] + (["-stream_loop", "-1"] if loop else []) + \
        ["-i", path, "-an", "-sn", "-vf", vf, "-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "fast",
         "-crf", "14", "-pix_fmt", "yuv420p", out + ".tmp.mp4"]
    subprocess.run(args, check=True)
    os.replace(out + ".tmp.mp4", out)
    return out
