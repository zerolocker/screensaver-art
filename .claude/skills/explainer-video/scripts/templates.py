"""Scene templates -> one self-contained HTML page per scene.

Every revealable element carries data-u="<unit index>"; slide.js toggles
visibility per beat. Text that could overflow carries data-fit so slide.js
shrinks it (within a floor) and reports anything it had to clip.
"""
import html as _html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CSS = open(os.path.join(HERE, "assets", "theme.css")).read()
JS = open(os.path.join(HERE, "assets", "slide.js")).read()

ARROW = ('<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M8 24h30M28 13l11 11-11 11"/></svg>')
CHECK = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>')


def md(s):
    """Escape, then allow **accent** and `code` and line breaks."""
    s = _html.escape(str(s if s is not None else ""))
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"`(.+?)`", r"<code>\1</code>", s)
    return s.replace("\n", "<br>")


def fit(mode, mx, mn, lines=None, group=None):
    a = f' data-fit="{mode}" data-max="{mx}" data-min="{mn}"'
    if lines:
        a += f' data-lines="{lines}"'
    if group:
        a += f' data-group="{group}"'
    return a


def item_parts(it, primary="text", secondary="note"):
    if isinstance(it, dict):
        return str(it.get(primary, "")), str(it.get(secondary, "") or "")
    return str(it), ""


def header(sc, heading_key="heading", mx=88, mn=58, lines=2):
    k = f'<div class="kicker">{md(sc["kicker"])}</div>' if sc.get("kicker") else ""
    h = (f'<h2 class="heading"{fit("lines", mx, mn, lines)}>{md(sc[heading_key])}</h2>'
         if sc.get(heading_key) else "")
    return f"<header>{k}{h}</header>" if (k or h) else ""


# ---------------------------------------------------------------- templates
def t_title(sc):
    sub = (f'<p class="subtitle" data-u="0"{fit("lines", 50, 36, 2)}>{md(sc["subtitle"])}</p>'
           if sc.get("subtitle") else "")
    k = f'<div class="kicker">{md(sc["kicker"])}</div>' if sc.get("kicker") else ""
    return (f'<div class="wrap">{k}<h1 class="title"{fit("lines", 138, 80, 3)}>{md(sc["title"])}</h1>'
            f'<div class="rule"></div>{sub}</div>')


def t_bullets(sc, numbered=None):
    numbered = sc.get("numbered", False) if numbered is None else numbered
    lis = []
    for i, it in enumerate(sc["items"]):
        t, n = item_parts(it)
        mk = f"{i + 1}" if numbered else ""
        note = f'<div class="n">{md(n)}</div>' if n else ""
        lis.append(f'<li data-u="{i}"><span class="mk">{mk}</span><div><div class="t">{md(t)}</div>{note}</div></li>')
    cls = "list num" if numbered else "list"
    return f'{header(sc)}<div class="body"><ol class="{cls}"{fit("box", 66, 42)}>{"".join(lis)}</ol></div>'


def t_steps(sc):
    return t_bullets(sc, numbered=True)


def t_stats(sc):
    items = sc["items"]
    n = len(items)
    big = n == 1
    tiles = []
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            it = {"value": str(it)}
        note = (f'<div class="note"{fit("lines", 38 if big else 32, 26, 2, "note")}>{md(it["note"])}</div>'
                if it.get("note") else "")
        lab = (f'<div class="lab"{fit("lines", 56 if big else 46, 32, 2, "lab")}>{md(it["label"])}</div>'
               if it.get("label") else "")
        tiles.append(f'<div class="tile" data-u="{i}"><div class="val"{fit("lines", 260 if big else (176 if n <= 3 else 140), 70, 1, "val")}>'
                     f'{md(it.get("value", ""))}</div>{lab}{note}</div>')
    return (f'{header(sc)}<div class="body"><div class="tiles n{n}" '
            f'style="grid-template-columns:repeat({n},1fr)">{"".join(tiles)}</div></div>')


def t_pipeline(sc):
    steps = sc["steps"]
    n = len(steps)
    col = str(sc.get("direction", "row")).lower() in ("column", "col", "vertical", "down")
    cells = []
    for i, st in enumerate(steps):
        lab, note = item_parts(st, "text", "note")
        if isinstance(st, dict) and not lab:
            lab = str(st.get("label", ""))
        if i:
            cells.append(f'<div class="arr" data-u="{i}">{ARROW}</div>')
        nt = f'<div class="nt"{fit("lines", 36 if n <= 4 else 30, 24, 3, "nt")}>{md(note)}</div>' if note else ""
        lbl_max, lbl_min = (54 if n <= 4 else 44, 30) if not col else (52, 36)
        cells.append(f'<div class="box" data-u="{i}"><div class="idx">Step {i + 1}</div><div class="tx">'
                     f'<div class="lbl"{fit("lines", lbl_max, lbl_min, 3 if not col else 2, "lbl")}>{md(lab)}</div>{nt}</div></div>')
    if col:
        tracks = " ".join(["auto"] + ["44px auto"] * (n - 1))
        style = f"grid-template-rows:{tracks};grid-template-columns:1fr"
    else:
        arrow_w = 76 if n <= 4 else 44
        tracks = " ".join(["minmax(0,1fr)"] + [f"{arrow_w}px minmax(0,1fr)"] * (n - 1))
        style = f"grid-template-columns:{tracks}"
    return (f'{header(sc)}<div class="body"><div class="flow {"col" if col else "row"} n{n}" '
            f'style="{style}">{"".join(cells)}</div></div>')


def t_compare(sc):
    win = str(sc.get("winner", "") or "").lower()
    cols = []
    for i, side in enumerate(("left", "right")):
        c = sc[side]
        tag = f'<div class="tag">{md(c["tag"])}</div>' if c.get("tag") else ""
        title = f'<h3 class="ct"{fit("lines", 64, 44, 2, "ct")}>{md(c["title"])}</h3>' if c.get("title") else ""
        lis = "".join(f"<li><span>{md(item_parts(x)[0])}</span></li>" for x in c["items"])
        cls = "col win" if win == side else "col"
        cols.append(f'<section class="{cls}" data-u="{i}" data-eq="cmp">{tag}{title}<ul class="cl"{fit("box", 48, 34, None, "cl")}>{lis}</ul></section>')
    return f'{header(sc)}<div class="body"><div class="cmp">{cols[0]}<div class="vs">vs</div>{cols[1]}</div></div>'


def t_images(sc, resolved):
    figs = []
    n = len(sc["images"])
    for i, img in enumerate(sc["images"]):
        path, w, h = resolved[i]
        ar = w / h
        cap = (f'<figcaption{fit("lines", 38, 28, 2, "cap")}>{md(img["caption"])}</figcaption>'
               if img.get("caption") else "")
        figs.append(f'<figure data-u="{i}" data-ar="{ar:.4f}"><div class="frame" data-kb="{i}">'
                    f'<img src="file://{_html.escape(path)}"></div>{cap}</figure>')
    return f'{header(sc, mx=70, mn=48, lines=1)}<div class="body"><div class="gal n{n}">{"".join(figs)}</div></div>'


def t_decision(sc):
    opts = sc["options"]
    n = len(opts)
    rec_idx = next((i for i, o in enumerate(opts) if isinstance(o, dict) and o.get("recommended")), None)
    cards = []
    for i, o in enumerate(opts):
        t, d = item_parts(o, "text", "note")
        if isinstance(o, dict) and not t:
            t = str(o.get("label", ""))
        badge = ""
        if i == rec_idx:
            label = o.get("badge", "Recommended") if isinstance(o, dict) else "Recommended"
            badge = f'<div class="badge" data-u="{n}">{md(label)}</div>'
        od = f'<div class="od"{fit("lines", 38, 28, 4 if n < 4 else 2, "od")}>{md(d)}</div>' if d else ""
        inner = (f'<div class="ot"{fit("lines", 56 if n < 4 else 46, 34, 2, "ot")}>{md(t)}</div>{od}')
        if n == 4:
            inner = f'<div class="otx">{inner}</div>'
        cards.append(f'<div class="opt{" rec" if i == rec_idx else ""}" data-u="{i}">{badge}'
                     f'<div class="letter">{chr(65 + i)}</div>{inner}</div>')
    head = header(sc, heading_key="question", mx=80, mn=52, lines=3)
    return f'{head}<div class="body"><div class="opts n{n}">{"".join(cards)}</div></div>'


def t_checklist(sc):
    lis = []
    for i, it in enumerate(sc["items"]):
        t, n = item_parts(it)
        status = (it.get("status", "done") if isinstance(it, dict) else "done").lower()
        status = {"x": "done", "true": "done", "yes": "done", "wip": "doing", "in progress": "doing",
                  "false": "todo", "no": "todo", "open": "todo"}.get(status, status)
        if status not in ("done", "doing", "todo"):
            status = "done"
        icon = CHECK if status == "done" else ""
        note = f'<div class="n">{md(n)}</div>' if n else ""
        lis.append(f'<li class="{status}" data-u="{i}"><span class="bx">{icon}</span><div><div class="t">{md(t)}</div>{note}</div></li>')
    return f'{header(sc)}<div class="body"><ul class="checks"{fit("box", 62, 40)}>{"".join(lis)}</ul></div>'


def t_timeline(sc):
    items = sc["items"]
    n = len(items)
    evs = []
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            it = {"text": str(it)}
        nt = f'<div class="nt"{fit("lines", 32, 24, 2, "tlnt")}>{md(it["note"])}</div>' if it.get("note") else ""
        evs.append(f'<div class="ev" data-u="{i}"><div class="when"><span{fit("lines", 38, 26, 1, "when")}>{md(it.get("when", ""))}</span></div>'
                   f'<div class="dot"></div><div class="tx"{fit("lines", 46 if n <= 4 else 38, 28, 3, "tltx")}>{md(it.get("text", ""))}</div>{nt}</div>')
    return (f'{header(sc)}<div class="body"><div class="tl n{n}" style="grid-template-columns:repeat({n},minmax(0,1fr))">'
            f'<div class="track"><div class="pr"></div></div>{"".join(evs)}</div></div>')


def t_html(sc):
    css = f"<style>{sc.get('css', '')}</style>"
    return f'{header(sc)}<div class="body custom">{sc["html"]}</div>{css}'


def t_video(sc, clip):
    """Full-frame (default) or framed clip. The clip itself is composited by ffmpeg
    into the .vframe rect; the poster <img> only shows in --preview. In full layout the
    caption bar + footer are `.over` so they are re-drawn on top of the moving clip."""
    cap_txt = sc.get("caption")
    if str(sc.get("layout", "full")).lower() == "framed":
        cap = f'<figcaption{fit("lines", 38, 28, 2, "cap")}>{md(cap_txt)}</figcaption>' if cap_txt else ""
        ar = clip["w"] / clip["h"]
        return (f'{header(sc, mx=70, mn=48, lines=1)}<div class="body"><div class="gal n1">'
                f'<figure data-ar="{ar:.4f}"><div class="frame" data-vid="0">'
                f'<img src="file://{_html.escape(clip["poster"])}"></div>{cap}</figure></div></div>')
    cap = (f'<div class="vcap over"><div class="vcap-t"{fit("lines", 36, 26, 2)}>{md(cap_txt)}</div></div>'
           if cap_txt else '<div class="vcap over bare"></div>')
    return (f'<div class="vframe" data-vid="0"><img src="file://{_html.escape(clip["poster"])}"></div>{cap}')


RENDER = {"title": t_title, "bullets": t_bullets, "steps": t_steps, "stats": t_stats,
          "pipeline": t_pipeline, "compare": t_compare, "decision": t_decision,
          "checklist": t_checklist, "timeline": t_timeline, "html": t_html}


def scene_html(spec, idx, video_mode, burn_captions, resolved_images=None, clip=None):
    sc = spec["scenes"][idx]
    t = sc["template"]
    if t == "images":
        body = t_images(sc, resolved_images)
    elif t == "video":
        body = t_video(sc, clip)
    else:
        body = RENDER[t](sc)
    full_video = t == "video" and str(sc.get("layout", "full")).lower() != "framed"
    n = len(spec["scenes"])
    segs = "".join(f'<i class="{"done" if k < idx else ("now" if k == idx else "")}"></i>' for k in range(n))
    if n > 14:  # many scenes: skip the bar, keep the counter
        segs = ""
    foot = (f'<footer class="foot{" over" if full_video else ""}"><span>{md(spec["footer"])}</span>'
            f'<span class="prog"><span class="segs">{segs}</span><span class="num">{idx + 1} / {n}</span></span></footer>')
    classes = ([f"t-{t}"] + (["video"] if video_mode else []) + (["cap"] if burn_captions else [])
               + (["vfull"] if full_video else []))
    accent = _html.escape(spec["accent"])
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>{CSS}</style><style>:root{{--accent:{accent}}}</style></head>
<body class="{' '.join(classes)}"><main class="slide t-{t}">{body}</main>{foot}
<script>{JS}</script></body></html>"""
