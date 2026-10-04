"""Load + validate an video-reply spec (YAML or JSON) into a normalized dict.

Validation happens before any API call, so a typo costs nothing. Hard errors
raise SpecError; soft problems (too many items, unknown keys) become warnings.
"""
import json
import os

import yaml

DEFAULT_MODEL = "gemini-3.1-flash-tts-preview"
FALLBACK_MODEL = "gemini-2.5-pro-preview-tts"
DEFAULT_VOICE = "Vindemiatrix"
DEFAULT_STYLE = ("Read this as a calm, friendly narrator explaining something to a "
                 "colleague: warm, clear and brisk, conversational, never salesy.")
DEFAULT_ACCENT = "#e4a853"

# template -> (required fields, optional fields, list field to count, soft max items)
TEMPLATES = {
    "title":     ({"title"}, {"kicker", "subtitle"}, None, None),
    "bullets":   ({"items"}, {"kicker", "heading", "numbered", "reveal"}, "items", 5),
    "steps":     ({"items"}, {"kicker", "heading", "reveal"}, "items", 5),
    "stats":     ({"items"}, {"kicker", "heading"}, "items", 4),
    "pipeline":  ({"steps"}, {"kicker", "heading", "direction", "reveal"}, "steps", 6),
    "compare":   ({"left", "right"}, {"kicker", "heading", "winner"}, None, None),
    "images":    ({"images"}, {"kicker", "heading", "motion"}, "images", 3),
    "decision":  ({"question", "options"}, {"kicker"}, "options", 4),
    "checklist": ({"items"}, {"kicker", "heading", "reveal"}, "items", 6),
    "timeline":  ({"items"}, {"kicker", "heading", "reveal"}, "items", 6),
    "html":      ({"html"}, {"kicker", "heading", "css"}, None, None),
    "video":     ({"src"}, {"caption", "layout", "loop", "kicker", "heading"}, None, None),
}
ALIASES = {"image": "images", "bullet": "bullets", "numbered": "steps", "flow": "pipeline",
           "comparison": "compare", "question": "decision", "custom": "html", "stat": "stats",
           "clip": "video"}
TOP_KEYS = {"title", "footer", "voice", "model", "fallback_model", "style", "accent", "scenes", "pad", "speed"}
SCENE_COMMON = {"template", "say", "beats", "pause"}


class SpecError(Exception):
    pass


def _beats(raw, where):
    if raw is None:
        raise SpecError(f"{where}: needs `say:` (a list of narration beats)")
    if isinstance(raw, str):
        raw = [raw]
    out = []
    for j, b in enumerate(raw):
        if isinstance(b, str):
            b = {"text": b}
        if not isinstance(b, dict) or not str(b.get("text", "")).strip():
            raise SpecError(f"{where}, beat {j + 1}: each beat is a string or {{text: ..., hold: true}}")
        show = b.get("show")
        if show is not None and show != "all" and not (isinstance(show, int) and show >= 0):
            raise SpecError(f"{where}, beat {j + 1}: `show` is a count of items (or `all`)")
        out.append({"text": " ".join(str(b["text"]).split()),
                    "hold": bool(b.get("hold", False)),
                    "show": show,
                    "pause": float(b.get("pause", 0) or 0)})
    if not out:
        raise SpecError(f"{where}: `say:` is empty")
    return out


def load(path):
    with open(path) as f:
        text = f.read()
    try:
        data = json.loads(text) if path.endswith(".json") else yaml.safe_load(text)
    except Exception as e:
        raise SpecError(f"could not parse {path}: {e}")
    if not isinstance(data, dict) or not isinstance(data.get("scenes"), list) or not data["scenes"]:
        raise SpecError("spec must be a mapping with a non-empty `scenes:` list")

    warnings = []
    for k in data:
        if k not in TOP_KEYS:
            warnings.append(f"unknown top-level key `{k}` (ignored)")
    spec = {
        "title": str(data.get("title", "") or ""),
        "footer": data.get("footer"),
        "voice": data.get("voice") or DEFAULT_VOICE,
        "model": data.get("model") or DEFAULT_MODEL,
        "fallback_model": data.get("fallback_model", FALLBACK_MODEL),
        "style": DEFAULT_STYLE if data.get("style") is None else str(data["style"]).strip(),
        "accent": data.get("accent") or DEFAULT_ACCENT,
        "pad": float(data.get("pad", 0.25)),
        "speed": float(data.get("speed", 1.12)),
        "base_dir": os.path.dirname(os.path.abspath(path)),
        "scenes": [],
    }
    if spec["footer"] is None:
        spec["footer"] = spec["title"]

    for i, sc in enumerate(data["scenes"]):
        where = f"scene {i + 1}"
        if not isinstance(sc, dict):
            raise SpecError(f"{where}: must be a mapping")
        t = str(sc.get("template", "")).strip().lower()
        t = ALIASES.get(t, t)
        if t not in TEMPLATES:
            raise SpecError(f"{where}: unknown template `{sc.get('template')}` — use one of {', '.join(TEMPLATES)}")
        req, opt, list_field, soft_max = TEMPLATES[t]
        # single-image shorthand: {template: image, src:, caption:}
        if t == "images" and "images" not in sc and "src" in sc:
            sc = dict(sc, images=[{"src": sc.pop("src"), "caption": sc.pop("caption", "")}])
        missing = [r for r in req if sc.get(r) in (None, "", [])]
        if missing:
            raise SpecError(f"{where} ({t}): missing {', '.join(missing)}")
        for k in sc:
            if k not in req | opt | SCENE_COMMON | {"src", "caption"}:
                warnings.append(f"{where} ({t}): unknown key `{k}` (ignored)")
        if list_field:
            items = sc[list_field]
            if not isinstance(items, list):
                raise SpecError(f"{where} ({t}): `{list_field}` must be a list")
            if soft_max and len(items) > soft_max:
                warnings.append(f"{where} ({t}): {len(items)} {list_field} — more than {soft_max} gets cramped on a phone; split the scene")
        if t == "compare":
            for side in ("left", "right"):
                col = sc[side]
                if not isinstance(col, dict) or "items" not in col:
                    raise SpecError(f"{where} (compare): `{side}` needs {{title, items}}")
                if len(col["items"]) > 4:
                    warnings.append(f"{where} (compare): {side} has {len(col['items'])} items — keep ≤ 4")
        if t == "images":
            for img in sc["images"]:
                if not isinstance(img, dict) or not img.get("src"):
                    raise SpecError(f"{where} (images): every image needs `src`")
        if t == "video" and str(sc.get("layout", "full")).lower() not in ("full", "framed"):
            raise SpecError(f"{where} (video): layout must be `full` or `framed`")
        if t == "decision":
            recs = [o for o in sc["options"] if isinstance(o, dict) and o.get("recommended")]
            if len(recs) > 1:
                raise SpecError(f"{where} (decision): at most one option can be `recommended`")
        scene = dict(sc, template=t)
        scene["beats"] = _beats(sc.get("say", sc.get("beats")), where)
        scene.pop("say", None)
        spec["scenes"].append(scene)

    words = sum(len(b["text"].split()) for s in spec["scenes"] for b in s["beats"])
    spec["words"] = words
    est = words / 2.7  # ~160 wpm incl. pauses
    if est > 240:
        warnings.append(f"narration is ~{words} words (~{est / 60:.1f} min) — aim for 1.5–3 min")
    return spec, warnings


def beat_states(n_units, beats, reveal="staged"):
    """Per beat: (visible_count, current_index). Default rule: every beat reveals the
    next unit (heading/kicker are always visible); `hold: true` beats reveal nothing;
    leftovers appear on the last beat. With reveal=all everything is visible and beats
    walk the highlight instead."""
    states, visible, cur = [], (n_units if reveal == "all" else 0), -1
    for j, b in enumerate(beats):
        if b.get("show") is not None:  # explicit: show the first N units
            visible = n_units if b["show"] == "all" else min(n_units, b["show"])
            cur = visible - 1
        elif not b["hold"]:
            if reveal == "all":
                cur = min(n_units - 1, cur + 1)
            else:
                visible = min(n_units, visible + 1)
                cur = visible - 1
        if j == len(beats) - 1 and visible < n_units:
            visible, cur = n_units, n_units - 1
        states.append((visible, cur))
    return states
