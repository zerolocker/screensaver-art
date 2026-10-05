#!/usr/bin/env python3
"""Omni Lab: one artwork of one run. Spawned detached by server.mjs, so it keeps
going (and finishes writing its files) even if the server is restarted.

  python3 omni-lab/job.py <run-dir> <art-key>
  python3 omni-lab/job.py <run-dir> <art-key> --prep-only   # just write input.jpg, print its info (no Omni call)

Reads   <run-dir>/<art-key>/item.json   (everything resolved by the server)
Writes  <run-dir>/<art-key>/input.jpg   the exact image sent to Omni
        <run-dir>/<art-key>/video.mp4 (+ .json sidecar), edit.mp4 (+ .json) if an edit prompt is set
        <run-dir>/<art-key>/log.txt     commands + full CLI output
        <run-dir>/<art-key>/status.json progress, owned by this process while it runs

Omni is called only through the repo's CLI, via curation/with-secrets.sh, so the
API key never reaches the server or the browser.
"""
import json
import os
import re
import subprocess
import sys
import time

from PIL import Image

Image.MAX_IMAGE_PIXELS = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GEN = os.path.join(ROOT, ".claude/skills/omni-video-gen/scripts/generate.py")
SECRETS = os.path.join(ROOT, "curation/with-secrets.sh")
SAFETY = re.compile(r"safety|blocked|prohibited|usage polic|content polic|responsible ai|\bRAI\b", re.I)

run_dir, key = sys.argv[1], sys.argv[2]
d = os.path.join(run_dir, key)
item = json.load(open(os.path.join(d, "item.json")))
status_path = os.path.join(d, "status.json")
log_path = os.path.join(d, "log.txt")
try:  # keep the server's bookkeeping (queuedAt, attempt); drop the rest
    _prev = json.load(open(status_path))
except Exception:  # noqa: BLE001
    _prev = {}
status = {k: _prev[k] for k in ("queuedAt", "attempt") if k in _prev}
status.update(status="preparing", pid=os.getpid(), startedAt=time.time())


def save():
    tmp = status_path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(status, f, indent=1)
    os.replace(tmp, status_path)


def log(msg):
    with open(log_path, "a") as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")


WALL = (0x0B, 0x0B, 0x0D)  # the production wall colour (frame-painting.mjs)


def prep():
    """Our own pre-processing: raw / centre crop / dark wall, at the configured long edge."""
    im = Image.open(item["paintingPath"]).convert("RGB")
    pw, ph = im.size
    edge = int(item["longEdge"])
    aw, ah = (16, 9) if item["aspect"] == "16:9" else (9, 16)
    # Output canvas at the output aspect, long edge = edge (even dimensions).
    cw, ch = (edge, round(edge * ah / aw / 2) * 2) if aw > ah else (round(edge * aw / ah / 2) * 2, edge)
    mode = item["framing"]
    info = {"framing": mode, "painting": [pw, ph]}
    if mode == "raw":
        s = min(1.0, edge / max(pw, ph))  # never upscale the whole painting
        out = im.resize((round(pw * s), round(ph * s)), Image.LANCZOS) if s < 1 else im
        info.update(scale=round(s, 4))
    elif mode == "crop":
        target = aw / ah
        if pw / ph > target:  # too wide: crop the sides
            w, h = round(ph * target), ph
        else:  # too tall: crop top/bottom
            w, h = pw, round(pw / target)
        x, y = (pw - w) // 2, (ph - h) // 2
        out = im.crop((x, y, x + w, y + h)).resize((cw, ch), Image.LANCZOS)
        info.update(crop=[x, y, w, h], kept=round(w * h / (pw * ph), 3), scale=round(cw / w, 4))
    elif mode == "wall":
        s = min(cw / pw, ch / ph)
        sw, sh = max(2, round(pw * s)), max(2, round(ph * s))
        out = Image.new("RGB", (cw, ch), WALL)
        out.paste(im.resize((sw, sh), Image.LANCZOS), ((cw - sw) // 2, (ch - sh) // 2))
        info.update(placed=[(cw - sw) // 2, (ch - sh) // 2, sw, sh], scale=round(s, 4))
    else:
        raise SystemExit(f"unknown framing {mode!r}")
    path = os.path.join(d, "input.jpg")
    out.save(path, "JPEG", quality=95, subsampling=0)
    info.update(size=list(out.size), bytes=os.path.getsize(path))
    return path, info


def run_cli(args, label):
    """Run the Omni CLI; returns (ok, last_line, full_output)."""
    cmd = ["bash", SECRETS, "GEMINI_API_KEY", "--", sys.executable, GEN] + args
    shown = " ".join(json.dumps(a) if (" " in a or not a) else a for a in cmd)
    log(f"{label}: {shown}")
    t0 = time.time()
    p = subprocess.run(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    out = p.stdout or ""
    with open(log_path, "a") as f:
        f.write(out if out.endswith("\n") or not out else out + "\n")
    log(f"{label}: exit {p.returncode} after {time.time() - t0:.0f}s")
    lines = [l.strip() for l in out.splitlines() if l.strip()]
    return p.returncode == 0, (lines[-1] if lines else f"exit code {p.returncode}"), out


def classify(last, out):
    if SAFETY.search(out):
        return "safety", "blocked by safety filter"
    return "error", last


def probe(path):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "stream=width,height:format=duration", "-of", "json", path],
                           capture_output=True, text=True, timeout=30)
        j = json.loads(r.stdout or "{}")
        s = (j.get("streams") or [{}])[0]
        return {"width": s.get("width"), "height": s.get("height"),
                "duration": round(float(j.get("format", {}).get("duration") or 0), 2)}
    except Exception:  # noqa: BLE001
        return {}


def main():
    save()
    log(f"job {key} pid {os.getpid()} · {item['title']} · {item['framing']} {item['aspect']} {item['resolution']}")
    try:
        img, info = prep()
    except Exception as e:  # noqa: BLE001
        status.update(status="failed", errorKind="error", error=f"pre-processing failed: {e}", finishedAt=time.time())
        log(status["error"])
        return save()
    status.update(prep=info, input="input.jpg", status="generating", genStartedAt=time.time())
    save()

    args = ["--prompt", item["prompt"], "--image", img, "--image-as-is", "--aspect", item["aspect"], "--resolution", item["resolution"],
        "--model", item["model"], "--out", os.path.join(d, "video.mp4")]
    if item.get("task"):
        args += ["--task", item["task"]]
    if item.get("seed") not in (None, ""):
        args += ["--seed", str(item["seed"])]
    if item.get("duration"):
        args += ["--duration", str(item["duration"])]
    ok, last, out = run_cli(args, "generate")
    status["genFinishedAt"] = time.time()
    if not ok or not os.path.exists(os.path.join(d, "video.mp4")):
        kind, msg = classify(last, out)
        status.update(status="failed", errorKind=kind, error=msg, finishedAt=time.time())
        return save()
    side = json.load(open(os.path.join(d, "video.mp4.json")))
    status.update(video="video.mp4", interactionId=side.get("interaction_id"), videoInfo=probe(os.path.join(d, "video.mp4")))

    if item.get("editPrompt"):
        status.update(status="editing", editStartedAt=time.time())
        save()
        ok, last, out = run_cli(["--edit", os.path.join(d, "video.mp4.json"), "--prompt", item["editPrompt"],
                                 "--aspect", item["aspect"], "--resolution", item["resolution"],
                                 "--model", item["model"], "--out", os.path.join(d, "edit.mp4")], "edit")
        status["editFinishedAt"] = time.time()
        if ok and os.path.exists(os.path.join(d, "edit.mp4")):
            eside = json.load(open(os.path.join(d, "edit.mp4.json")))
            status.update(editVideo="edit.mp4", editInteractionId=eside.get("interaction_id"),
                          editInfo=probe(os.path.join(d, "edit.mp4")))
        else:
            kind, msg = classify(last, out)
            status.update(editErrorKind=kind, editError=msg)
    status.update(status="done", finishedAt=time.time())
    save()


if __name__ == "__main__":
    if "--prep-only" in sys.argv:
        print(json.dumps(prep()[1]))
        sys.exit(0)
    try:
        main()
    except Exception as e:  # noqa: BLE001: never leave a job stuck "running"
        status.update(status="failed", errorKind="error", error=f"job crashed: {type(e).__name__}: {e}", finishedAt=time.time())
        log(status["error"])
        save()
