# Real-Art Guidance: animating real paintings

Rules for the video prompt and the review in
[`REAL_PAINTINGS_CURATION.md`](REAL_PAINTINGS_CURATION.md). They sit **on top of** the motion
rules in [`PROMPT_GUIDANCE.md`](PROMPT_GUIDANCE.md) (primary mover, preference order, no
morph/melt verbs). Where the two disagree, **this file wins**.

The difference in one line: in AI mode we invent the picture, so motion can go anywhere. Here
the picture is a real painter's composition, and **the motion has to happen inside it**.

## What the pilots showed (2026-10-03, Caillebotte, *Paris Street; Rainy Day*)

- **Pilot 1** was non-looping. The prompt asked the foreground couple and the man on the right
  to walk forward, plus rain, distant walkers and a carriage. **The camera stayed locked**, but
  the *figures* rewrote the picture: the couple strolled toward the viewer and took over the
  left half, the man on the right walked off into the street, and a carriage drove into the
  gap. Each motion was plausible; by second 8 it was no longer Caillebotte's composition.
- **Pilot 2** pinned the first and last frame to the painting and told the foreground figures to
  stay put. The composition held and it looped seamlessly, but **the motion was too quiet**:
  rain, a carriage wheel, distant walkers.
- **The target sits between them**: real, legible action that happens *in place*.

## What the first dry run showed (2026-10-03, four famous works)

- **Bruegel, *The Harvesters*: passed.** Mid-size figures each did an action that repeats on the
  spot: the reapers swung their scythes and the group under the tree ate. The prompt said "every
  figure stays in its painted place". The composition held for all 8 s.
- **Hokusai, *The Great Wave*: partial.** Pinned loop. The wave curled and churned well and the
  clip returned to the print, but mid-clip one boat vanished and another came back larger, with a
  crew drawn in a different, modern style. Asking small crews to *act* invites Veo to redraw them.
- **Seurat, *Grande Jatte*: failed.** Naming the tiny leashed monkey made Veo invent a new,
  prominent monkey mid-lawn. The foreground dog walked across the grass, and a shawl flared out.
- **El Greco, *View of Toledo*: failed.** Non-looping. When the sky *is* the subject, "storm
  clouds churn" repainted the sky bright and redrew the hills into a new valley.

## Motion that keeps the painting

1. **Prefer actions that complete in place**: a gesture, a dancer's sway, a rower's stroke, a
   worker's tool cycle, an animal grazing or tossing its head, sails filling, boats rocking,
   waves breaking, trees and cloth in wind, rain, smoke, birds crossing the sky.
2. **Large foreground figures keep their painted positions.** They *are* the composition. They
   may gesture, turn, shift their weight or sway, but they never walk toward or away from the
   viewer or across the picture.
3. **Locomotion is for small or mid-distance figures only**, and mostly sideways. A distant
   crowd can mill about and a far-off boat can sail across.
4. **Nothing new enters.** Animate only what the painter put there: no new people, animals,
   vehicles or objects. Name the specific things you want to move.
5. **The camera is locked.** No push-in, pan or zoom: the painting is the frame. This overrides
   the AI guidance that allows a slow push.
6. **The dark wall stays empty.** Nothing may appear in the black margins around the painting.
7. **The paint stays paint.** Brushwork, palette and texture stay as painted. Motion must not
   smooth the canvas into a photo or make the brushstrokes swim.
8. **Only name movers that are clearly visible at screen size.** Naming a tiny detail (Seurat's
   monkey) makes Veo invent a big new one.
9. **Let small background crews and figures ride along as painted.** Don't give them actions; they
   get redrawn in another style (Hokusai's boats).
10. **When the sky or weather is the subject, pin both ends** and ask for slow drift that keeps the
    clouds' painted shapes and palette. Non-looping "churning" repainted El Greco's sky and hills.
    *(This fix is untested: its reroll hit the Veo quota.)*
11. **Loop or not:** pinning both ends (`--last-frame` = the still) guarantees the painting is
   intact at the seam, but it damps motion. Use it where the motion is naturally cyclical (sea,
   wind, rain, sails, a dance that returns). For a scene with a real action, go non-looping and
   rely on rules 1–4.

*These rules come from two pilots and one four-painting dry run. When a night or a founder review shows a
genuinely new pattern, fold it into this list as a rule. Don't keep a narrative log.*

## Video prompt template

> A locked-off, perfectly still shot of *&lt;title&gt;* (&lt;year&gt;) by &lt;artist&gt;, a real
> &lt;medium&gt; hanging on a dark wall. The painting's composition, brushwork and colours stay
> exactly as painted, and the frame never moves. **&lt;Primary mover: a concrete actor doing a
> legible action, in place&gt;.** &lt;One or two secondary motions&gt;. &lt;The large figures keep
> their painted positions while they …&gt;. The dark wall around the painting stays empty and
> black.

Negative prompt (start from this and add scene-specific risks):
`camera movement, zoom, pan, dolly, push-in, figures walking toward the camera, new people, new
animals, new objects, morphing, melting faces, distorted hands, extra limbs, smooth photographic
look, text, anything appearing on the dark wall`

## Fidelity checklist (step 6 of the runbook)

Pull the first, middle and last frames, e.g.
`ffmpeg -ss <t> -i clip.mp4 -frames:v 1 f<t>.png`.
- [ ] **Landmarks line up** across the frames (a lamppost, a building edge, the signature, the
      painting's border). If they don't, the camera moved: reroll.
- [ ] **The last frame is still the painting.** The main figures are near their painted
      positions, and nothing has been repainted.
- [ ] **No new people or objects**, and the dark wall is clean.
- [ ] **Faces and hands intact**, with no melting or extra limbs.
- [ ] **The brushwork doesn't crawl**, and the paint hasn't turned photographic.
- [ ] **There is a real primary mover**, not only shimmer (the `PROMPT_GUIDANCE.md` rule).

## Overrides of `PROMPT_GUIDANCE.md`

| `PROMPT_GUIDANCE.md` says | In real-paintings mode |
|---|---|
| Don't regenerate famous icons; skip the greatest hits | **Famous first.** Each work is used once. Skip only what `gallery.json` already has. |
| Render in-situ, edge to edge; never as a museum object or "in a frame" | The painting hangs on a **dark wall**: whole, never cropped, never extended. |
| A slow camera push or pan is fine | **Locked camera.** |
| Image-prompt rules (patina, aging, era anchoring…) | Not applicable: there is no image prompt. |
