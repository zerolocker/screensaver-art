// video-reply slide runtime: auto-fit text, lay out galleries, audit overflow,
// and switch reveal state per beat. Driven over CDP by render.py:
//   await window.evInit()        -> {units, warnings, frames}
//   await window.evShow(v, cur)  -> sets which units are visible / current
(function () {
  const warnings = [];
  const snippet = (el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);

  function lineHeight(el) {
    const cs = getComputedStyle(el);
    const v = parseFloat(cs.lineHeight);
    return isNaN(v) ? parseFloat(cs.fontSize) * 1.2 : v;
  }
  function overLines(el, n) {
    return el.getBoundingClientRect().height > lineHeight(el) * n + 2 || el.scrollWidth > el.clientWidth + 1;
  }
  // tolerance: Chrome counts glyph ascent/descent beyond line-height as overflow
  function overBox(el) {
    const tol = Math.max(2, parseFloat(getComputedStyle(el).fontSize) * 0.06);
    return el.scrollHeight > el.clientHeight + tol || el.scrollWidth > el.clientWidth + 1;
  }

  // Largest integer font-size in [min, max] that fits; returns -1 if even min overflows.
  function fitOne(el) {
    const max = +el.dataset.max, min = +el.dataset.min, n = +(el.dataset.lines || 1);
    const over = el.dataset.fit === "lines" ? () => overLines(el, n) : () => overBox(el);
    const set = (s) => (el.style.fontSize = s + "px");
    set(max);
    if (!over()) return max;
    set(min);
    if (over()) return -1;
    let lo = min, hi = max;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      set(mid);
      if (over()) hi = mid; else lo = mid;
    }
    set(lo);
    return lo;
  }

  function fitAll() {
    const els = [...document.querySelectorAll("[data-fit]")];
    // lines-fit first (headings shape the space left for box-fit regions)
    const order = [...els.filter((e) => e.dataset.fit === "lines"), ...els.filter((e) => e.dataset.fit === "box")];
    const groups = {};
    for (const el of order) {
      const s = fitOne(el);
      if (s < 0) {
        if (el.dataset.fit === "lines") {
          el.classList.add("clamp");
          el.style.webkitLineClamp = el.dataset.lines || 1;
        } else el.classList.add("squeeze");
        warnings.push(`text too long even at ${el.dataset.min}px (clipped): "${snippet(el)}…"`);
      } else if (s < +el.dataset.max * 0.8) {
        warnings.push(`note: shrunk to ${s}px (from ${el.dataset.max}px): "${snippet(el)}…"`);
      }
      if (el.dataset.group) (groups[el.dataset.group] = groups[el.dataset.group] || []).push(el);
    }
    // siblings in a group share the smallest size, so tiles/cards look consistent
    for (const g of Object.values(groups)) {
      const m = Math.min(...g.map((e) => parseFloat(e.style.fontSize)));
      g.forEach((e) => (e.style.fontSize = m + "px"));
    }
  }

  // Images: a justified row — equal heights, widths follow each image's aspect.
  function layoutGallery() {
    const gal = document.querySelector(".gal");
    if (!gal) return;
    const figs = [...gal.querySelectorAll("figure")];
    const gap = parseFloat(getComputedStyle(gal).columnGap) || 72;
    const W = gal.clientWidth - gap * (figs.length - 1);
    const anyCap = figs.some((f) => f.querySelector("figcaption"));
    const capReserve = anyCap ? 38 + 38 * 1.3 * 2 + 6 : 0;
    const H = gal.clientHeight - capReserve - 16;
    const ars = figs.map((f) => +f.dataset.ar || 16 / 9);
    const sum = ars.reduce((a, b) => a + b, 0);
    let h = Math.min(H, W / sum, 760);
    figs.forEach((f, i) => {
      let w = Math.floor((h * ars[i]) / 2) * 2;
      const fh = Math.floor(h / 2) * 2;
      const fr = f.querySelector(".frame");
      fr.style.width = w + "px";
      fr.style.height = fh + "px";
      f.style.width = w + "px";
    });
    // vertically centre the row (frames + captions) in the body
    const total = h + capReserve;
    gal.style.paddingTop = Math.max(0, Math.floor((gal.clientHeight - total) / 2)) + "px";
  }

  function audit() {
    const W = innerWidth, H = innerHeight;
    const footTop = (document.querySelector(".foot") || { getBoundingClientRect: () => ({ top: H }) }).getBoundingClientRect().top;
    const capMode = document.body.classList.contains("cap");
    const limitBottom = capMode ? H - 200 : footTop - 8;
    const leaves = [...document.querySelectorAll(".slide *")].filter(
      (e) => e.children.length === 0 && (e.textContent || "").trim() && getComputedStyle(e).visibility !== "hidden");
    for (const e of leaves) {
      const r = e.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > W - 60 || r.left < 60 || r.top < 40 || r.bottom > limitBottom)
        warnings.push(`element outside safe area (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)}): "${snippet(e)}"`);
    }
    document.querySelectorAll(".body").forEach((b) => {
      if (b.scrollHeight > b.clientHeight + 2) warnings.push(`content taller than the slide by ${b.scrollHeight - b.clientHeight}px — cut items or words`);
    });
  }

  window.evInit = async function () {
    // custom HTML: .reveal elements become units in document order
    document.querySelectorAll(".custom .reveal").forEach((e, i) => (e.dataset.u = i));
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : 0)));
    layoutGallery();
    fitAll();
    // equal-height siblings (compare columns) once their text is final
    const eq = {};
    document.querySelectorAll("[data-eq]").forEach((e) => (eq[e.dataset.eq] = eq[e.dataset.eq] || []).push(e));
    for (const g of Object.values(eq)) {
      const h = Math.max(...g.map((e) => e.getBoundingClientRect().height));
      g.forEach((e) => (e.style.height = h + "px"));
    }
    // timeline track ends at the last event's dot instead of running off the edge
    const tl = document.querySelector(".tl");
    if (tl) {
      const dots = tl.querySelectorAll(".dot");
      const last = dots[dots.length - 1].getBoundingClientRect();
      tl.querySelector(".track").style.right = tl.getBoundingClientRect().right - (last.left + last.width / 2) + "px";
    }
    audit();
    let units = 0;
    document.querySelectorAll("[data-u]").forEach((e) => (units = Math.max(units, +e.dataset.u + 1)));
    const frames = [...document.querySelectorAll(".frame[data-kb]")].map((f) => {
      const r = f.getBoundingClientRect();
      return { i: +f.dataset.kb, x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const vframes = [...document.querySelectorAll("[data-vid]")].map((f) => {
      const r = f.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    return { units, warnings, frames, vframes, over: !!document.querySelector(".over") };
  };

  window.evShow = function (visible, cur) {
    document.querySelectorAll("[data-u]").forEach((el) => {
      const k = +el.dataset.u;
      const on = k < visible;
      el.classList.toggle("u-hide", !on);
      el.classList.toggle("u-on", on);
      el.classList.toggle("u-cur", on && k === cur);
      el.classList.toggle("u-past", on && k < cur);
      el.classList.toggle("u-fut", on && cur >= 0 && k > cur);
    });
    // timeline progress bar runs to the current (or last visible) event's dot
    const tl = document.querySelector(".tl");
    if (tl) {
      const evs = [...tl.querySelectorAll(".ev")];
      const idx = cur >= 0 ? cur : visible - 1;
      const bar = tl.querySelector(".track .pr");
      const track = tl.querySelector(".track");
      if (idx >= 0 && evs[idx]) {
        const d = evs[idx].querySelector(".dot").getBoundingClientRect();
        bar.style.width = d.left + d.width / 2 - track.getBoundingClientRect().left + "px";
      } else bar.style.width = "0px";
    }
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
  };
})();
