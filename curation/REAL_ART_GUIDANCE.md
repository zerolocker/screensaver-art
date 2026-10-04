# Animating real paintings

Rules for the video prompt and the review in [`REAL_PAINTINGS_CURATION.md`](REAL_PAINTINGS_CURATION.md). They add to the motion rules in [`PROMPT_GUIDANCE.md`](PROMPT_GUIDANCE.md) (primary mover, preference order, no morph verbs). Where the two disagree, this file wins.

The key difference: in AI mode we invent the picture, so motion can go anywhere. Here the composition is a real painter's, so **the motion has to happen inside it**. Early tests showed both failure modes. When figures walked freely, the painting was gone by second 8. When everything was pinned in place, the clip was too quiet. The target is real, visible action that happens in place.

## Motion that keeps the painting

1. **Prefer actions that complete in place:** a gesture, a dancer's sway, a rower's stroke, a worker's tool swing, an animal grazing or tossing its head, sails filling, boats rocking, waves breaking, trees and cloth in wind, rain, smoke, birds crossing the sky.
2. **Large foreground figures keep their painted positions.** They are the composition. They may gesture, turn, shift their weight or sway, but never walk toward or away from the viewer or across the picture.
3. **Only small or distant figures may travel**, mostly sideways. A far-off crowd can mill about; a distant boat can sail across.
4. **Nothing new enters.** Animate only what the painter put there. Name the specific things you want to move.
5. **The camera is locked.** No push-in, pan or zoom. This overrides the AI guidance that allows a slow push.
6. **The dark wall stays empty.** Nothing may appear in the black margins.
7. **The paint stays paint.** Brushwork, palette and texture stay as painted. Motion must not smooth the canvas into a photo or make the brushstrokes swim.
8. **Only name movers that are clearly visible at screen size.** Naming a tiny detail (Seurat's leashed monkey) made the model invent a big new one.
9. **Leave small background figures alone.** Asking small boat crews to act got them redrawn in a different style.
10. **When the sky or weather is the subject, pin both ends** and ask for slow drift that keeps the clouds' painted shapes and colours. Unpinned "churning clouds" repainted El Greco's sky and hills. (Untested fix.)
11. **Loop or not.** Pinning both ends keeps the painting intact at the seam but damps motion. Use it where the motion is naturally cyclical (sea, wind, rain, sails, a dance that returns). For a real action, go non-looping and rely on rules 1–4.

When a night or a founder review shows a new pattern, add a rule here.

## Video prompt template (Omni)

> This image is a photograph of a real &lt;medium&gt;, *&lt;title&gt;* (&lt;year&gt;) by &lt;artist&gt;, hanging on a dark wall. The video begins exactly on this image. It is one continuous, locked-off shot: the camera never moves, and the painting's composition, colours, brushwork and the empty black wall around it stay exactly as they are. **&lt;Primary mover: a concrete actor doing a visible action, in place&gt;.** &lt;One or two secondary motions&gt;. &lt;The large figures keep their painted positions while they …&gt;. No new people, animals or objects appear, and nothing is redrawn. No scene cuts, no music, no dialogue. 8 seconds long.

For a loop, pass the still twice and open with: "The video begins exactly on the first image and ends exactly on the second, identical image, so it loops seamlessly."

Omni has no negative prompt, so the "don'ts" go in the last two sentences.

**Open question:** the founder is comparing this template with a one-line prompt ("Animate this; keep the camera still.") on ten more paintings. Update this section with the winner.

## Fidelity checklist

Pull the first, middle and last frames, e.g. `ffmpeg -ss <t> -i clip.mp4 -frames:v 1 f<t>.png`.
- [ ] **Landmarks line up** across the frames (a lamppost, a building edge, the signature, the painting's border). If they don't, the camera moved: reroll.
- [ ] **The last frame is still the painting.** Main figures are near their painted positions; nothing is repainted.
- [ ] **No new people or objects**, and the dark wall is clean.
- [ ] **Faces and hands are intact**, with no melting or extra limbs.
- [ ] **The brushwork doesn't crawl**, and the paint hasn't turned photographic.
- [ ] **There is a real primary mover**, not just shimmer.

## Where this mode differs from `PROMPT_GUIDANCE.md`

| `PROMPT_GUIDANCE.md` | Real-paintings mode |
|---|---|
| Skip famous icons | **Famous first.** Each work is used once; skip only what `gallery.json` already has. |
| Art fills the image edge to edge | The painting hangs whole on a **dark wall**, never cropped or extended. |
| A slow camera push or pan is fine | **Locked camera.** |
| Image-prompt rules (freshness, light, framing) | Don't apply: there's no image prompt. |
