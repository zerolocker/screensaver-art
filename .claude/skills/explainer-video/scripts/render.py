#!/usr/bin/env python3
"""explainer-video — render a YAML/JSON video brief into a narrated slideshow MP4.

  bash curation/with-secrets.sh GEMINI_API_KEY -- \
    python3 .claude/skills/explainer-video/scripts/render.py SPEC.yaml \
      --out .claude/video-replies/NAME.mp4

  # layout-only check (no API key, no audio, ~5 s): slide PNGs + contact sheet
  python3 .claude/skills/explainer-video/scripts/render.py SPEC.yaml --preview

Pipeline: validate spec -> TTS per beat (parallel, cached) while headless Chrome
renders one PNG per beat -> sample-exact narration track -> ffmpeg (crossfades,
Ken Burns overlays, soft subtitles) -> contact sheet from the finished MP4.
"""
import argparse
import json
import math
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import assemble  # noqa: E402
import qa  # noqa: E402
from chrome import Chrome  # noqa: E402
from media import kenburns, prepare_clip, probe_video, resolve  # noqa: E402
from spec import SpecError, beat_states, load  # noqa: E402
from templates import scene_html  # noqa: E402

DOT_CLAUDE = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
REPLIES = os.path.join(DOT_CLAUDE, "video-replies")
CACHE = os.environ.get("EXPLAINER_CACHE") or os.path.join(REPLIES, ".cache")


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def fmt_t(t):
    return f"{int(t // 60)}:{t % 60:04.1f}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec")
    ap.add_argument("--out", help="output .mp4 (default .claude/video-replies/<spec name>.mp4)")
    ap.add_argument("--preview", action="store_true", help="slides + contact sheet only (no TTS/video)")
    ap.add_argument("--burn-captions", action=argparse.BooleanOptionalAction, default=True,
                    help="burn captions into the picture (default; --no-burn-captions for a soft track only)")
    ap.add_argument("--no-subs", action="store_true", help="omit the soft subtitle track")
    ap.add_argument("--no-verify", action="store_true", help="skip transcription check of new TTS clips")
    ap.add_argument("--refresh-audio", action="store_true", help="ignore the TTS cache")
    ap.add_argument("--jobs", type=int, default=6, help="parallel TTS requests (default 6)")
    args = ap.parse_args()
    t_start = time.time()

    try:
        spec, warnings = load(args.spec)
    except SpecError as e:
        log(f"spec error: {e}")
        sys.exit(2)

    stem = os.path.splitext(os.path.basename(args.out or args.spec))[0]
    out = os.path.abspath(args.out or os.path.join(REPLIES, stem + ".mp4"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    build = os.path.join(CACHE, "build", stem)
    shutil.rmtree(os.path.join(build, "frames"), ignore_errors=True)
    os.makedirs(os.path.join(build, "frames"), exist_ok=True)
    scenes = spec["scenes"]

    # images first (downloads are cached), so a bad path fails before any API spend
    resolved, clips = {}, {}
    for si, sc in enumerate(scenes):
        if sc["template"] == "images":
            resolved[si] = [resolve(im["src"], spec["base_dir"], CACHE) for im in sc["images"]]
        if sc["template"] == "video":
            clips[si] = probe_video(sc["src"], spec["base_dir"], CACHE)

    tts = futs = ex = None
    if not args.preview:
        if not os.environ.get("GEMINI_API_KEY"):
            log("GEMINI_API_KEY not set — run via: bash curation/with-secrets.sh GEMINI_API_KEY -- python3 …")
            sys.exit(2)
        from tts import TTS, tempo
        tts = TTS(CACHE, spec["model"], spec["fallback_model"], spec["voice"], spec["style"],
                  verify=not args.no_verify, refresh=args.refresh_audio, log=log)
        ex = ThreadPoolExecutor(max(1, args.jobs))
        futs = [[ex.submit(lambda t: tempo(tts.get(t), spec["speed"]), b["text"]) for b in sc["beats"]] for sc in scenes]

    # slides: one Chrome, one page per scene, one screenshot per beat
    frames, states, rects, vrects, overs = [], {}, {}, {}, {}
    t_slides = time.time()
    with Chrome() as ch:
        for si, sc in enumerate(scenes):
            html = scene_html(spec, si, video_mode=not args.preview, burn_captions=args.burn_captions,
                              resolved_images=resolved.get(si), clip=clips.get(si))
            hp = os.path.join(build, f"scene{si + 1:02d}.html")
            with open(hp, "w") as f:
                f.write(html)
            ch.goto("file://" + hp)
            info = ch.eval("window.evInit()")
            for w in info["warnings"]:
                warnings.append(f"scene {si + 1} ({sc['template']}): {w}")
            st = beat_states(info["units"], sc["beats"], str(sc.get("reveal", "staged")).lower())
            states[si] = st
            rects[si] = info["frames"]
            for bi, (vis, cur) in enumerate(st):
                ch.eval(f"window.evShow({vis},{cur})")
                p = os.path.join(build, "frames", f"s{si + 1:02d}b{bi + 1:02d}.png")
                ch.screenshot(p)
                frames.append(p)
            if sc["template"] == "video":
                vrects[si] = info["vframes"][0]
                if info["over"] and not args.preview:
                    overs[si] = os.path.join(build, "frames", f"s{si + 1:02d}_over.png")
                    ch.screenshot_over(overs[si])
    log(f"slides: {len(frames)} frames in {time.time() - t_slides:.1f}s")

    labels = []
    for si, sc in enumerate(scenes):
        for bi, b in enumerate(sc["beats"]):
            labels.append([f"{si + 1}.{bi + 1}", b["text"]])

    if args.preview:
        sheet = os.path.splitext(out)[0] + ".preview.png"
        qa.sheet(frames, labels, sheet, title=f"{spec['title']} — preview ({len(frames)} beats)")
        report(warnings)
        print(f"preview contact sheet: {sheet}")
        print(f"slide PNGs: {os.path.join(build, 'frames')}")
        return

    # narration
    try:
        wavs = [[f.result() for f in row] for row in futs]
    finally:
        ex.shutdown(wait=False, cancel_futures=True)
    warnings += tts.warnings
    beats, total = assemble.build_timeline(spec, wavs)
    raw = os.path.join(build, "narration_raw.wav")
    narration = os.path.join(build, "narration.wav")
    assemble.write_narration(beats, total, raw)
    assemble.loudnorm(raw, narration)

    cues = assemble.caption_cues(beats)
    srt = os.path.join(build, "captions.srt")
    assemble.write_srt(cues, srt)
    ass = None
    if args.burn_captions:
        ass = os.path.join(build, "captions.ass")
        assemble.write_ass(cues, ass)

    # Ken Burns overlays for image scenes
    overlays = []
    scene_first = {}
    for k, b in enumerate(beats):
        scene_first.setdefault(b["scene"], k)
    for si, rs in rects.items():
        if not rs:
            continue
        k0 = scene_first[si]
        nxt = scene_first.get(si + 1)
        is_last = nxt is None
        t1 = total if is_last else beats[nxt]["start"] + assemble.X_SCENE
        for r in rs:
            j = r["i"]
            reveal_beat = next(bi for bi, (vis, _) in enumerate(states[si]) if vis > j)
            b = beats[k0 + reveal_beat]
            x0, y0 = int(math.floor(r["x"] / 2) * 2), int(math.floor(r["y"] / 2) * 2)
            x1, y1 = int(math.ceil((r["x"] + r["w"]) / 2) * 2), int(math.ceil((r["y"] + r["h"]) / 2) * 2)
            path, _, _ = resolved[si][j]
            t0 = b["start"]
            clip = kenburns(path, x1 - x0, y1 - y0, t1 - t0 + 0.1, assemble.FPS, variant=si + j, cache_dir=CACHE)
            overlays.append({"path": clip, "x": x0, "y": y0, "t0": t0, "t1": t1,
                             "xin": max(b["xin"], 0.3), "xout": 0 if is_last else assemble.X_SCENE})

    # video scenes: clip normalised to its rect, long enough for the whole scene
    videos = {}
    for si, r in vrects.items():
        k0 = scene_first[si]
        kz = max(k for k, b in enumerate(beats) if b["scene"] == si)
        nxt_x = beats[kz + 1]["xin"] if kz + 1 < len(beats) else 0
        span = beats[kz]["start"] + beats[kz]["dur"] - beats[k0]["start"] + nxt_x + 0.2
        x0, y0 = int(math.floor(r["x"] / 2) * 2), int(math.floor(r["y"] / 2) * 2)
        x1, y1 = int(math.ceil((r["x"] + r["w"]) / 2) * 2), int(math.ceil((r["y"] + r["h"]) / 2) * 2)
        x1, y1 = min(x1, 1920), min(y1, 1080)
        loop = scenes[si].get("loop", True) not in (False, "false", "no", "freeze")
        clip = prepare_clip(clips[si]["path"], x1 - x0, y1 - y0, span, assemble.FPS, loop, CACHE)
        if not loop and clips[si]["dur"] < span:
            log(f"scene {si + 1} (video): clip is {clips[si]['dur']:.1f}s, scene {span:.1f}s — freezing on last frame")
        videos[si] = {"base": frames[k0], "over": overs.get(si), "clip": clip, "x": x0, "y": y0}
    segments = assemble.segments_for(beats, frames, videos)

    t_enc = time.time()
    assemble.encode(beats, total, segments, overlays, narration, None if args.no_subs else srt, out,
                    spec["title"] or stem, burn_ass=ass, log=log)
    log(f"encode: {time.time() - t_enc:.1f}s")

    with open(os.path.join(build, "timeline.json"), "w") as f:
        json.dump([{k: v for k, v in b.items() if k != "pcm"} for b in beats], f, indent=1)

    # QA contact sheet from the finished video: each beat just before it hands off
    times = []
    for k, b in enumerate(beats):
        t = b["start"] + b["dur"] - 0.12
        if k == len(beats) - 1:
            t = total - assemble.FADE_OUT - 0.25
        times.append(t)
        labels[k][0] = f"{labels[k][0]}  {fmt_t(b['start'])}"
    grabs = qa.frames_from_video(out, times, os.path.join(build, "qa"))
    sheet = os.path.splitext(out)[0] + ".contact.png"
    qa.sheet(grabs, labels, sheet, title=f"{spec['title']} — {fmt_t(total)}, {len(beats)} beats, {len(scenes)} scenes")

    report(warnings)
    log(f"tts: {tts.stats['synth']} new, {tts.stats['cached']} cached · {spec['model']} / {spec['voice']}")
    log(f"total time: {time.time() - t_start:.1f}s")
    print(f"video: {out}")
    print(f"duration: {fmt_t(total)} ({total:.1f}s)")
    print(f"contact sheet: {sheet}")


def report(warnings):
    hard = [w for w in warnings if "note: shrunk" not in w]
    soft = [w for w in warnings if "note: shrunk" in w]
    for w in hard:
        log(f"WARNING {w}")
    for w in soft:
        log(f"  {w}")


if __name__ == "__main__":
    main()
