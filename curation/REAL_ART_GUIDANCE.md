# Real-Art Guidance: animating real paintings

How [`REAL_PAINTINGS_CURATION.md`](REAL_PAINTINGS_CURATION.md) animates a painting, and how to
review the result.

## The prompt

Every painting gets the same prompt, with the framed still as the only input:

> **Animate this; keep the camera still.**

That is the whole prompt: don't add motion directions, a style or a negative list. The model is
Gemini Omni (the `omni-video-gen` skill), non-looping, at 1080p.

**Why so short (2026-10-04):** the founder compared it side by side against a detailed prompt
(the painting's name, a locked camera, one named motion "in place", "nothing new appears") on 14
paintings. The one-liner gave clearly more natural motion. The detailed prompt held the
composition more tightly but moved stiffly. Before that, Omni beat Veo because it invents, morphs
and drops far fewer objects.

**Known weak spot: paintings that don't fill a 16:9 frame.** Omni only outputs 16:9 or 9:16.
With the one-liner, a painting framed on the dark wall often has the wall painted over, or is
redrawn into a full-frame scene (Seurat's *Grande Jatte*, El Greco's *View of Toledo* and Vermeer's
*Young Woman with a Water Pitcher*; Caillebotte's *Paris Street* kept its wall). Sending the raw painting doesn't help: Omni crops it to fill the frame and then redraws
it. The fidelity check below is what catches this, so drop a piece that fails.

## Fidelity checklist (step 6 of the runbook)

Pull the first, middle and last frames, e.g.
`ffmpeg -ss <t> -i clip.mp4 -frames:v 1 f<t>.png`.
- [ ] **Landmarks line up** across the frames (a lamppost, a building edge, the signature, the
      painting's border). If they don't, the camera moved.
- [ ] **It's still this painting at the end**: same composition, nothing repainted into a
      different scene.
- [ ] **The dark wall is still dark** and the painting's edges are where they were.
- [ ] **No new people or objects** have appeared, and none have vanished.
- [ ] **Faces and hands are intact**: no melting, no extra limbs.

If a check fails, reroll once with the same prompt (Omni varies from run to run). If it fails
again, drop the painting and take the next pick. When a night shows a genuinely new failure
pattern, add it to this file as a rule. Don't keep a narrative log.
