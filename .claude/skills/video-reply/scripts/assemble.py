"""Timeline, narration track, subtitles and the final ffmpeg pass.

Timeline model: beat i owns [S_i, S_i + D_i). Its frame crossfades in starting at
S_i (X_BEAT inside a scene, X_SCENE across scenes); its voice starts at
S_i + lead. D_i = lead + speech + pad (+ pauses / scene tail / end tail).
The narration WAV is assembled sample-exact in Python, so A/V can't drift.
"""
import json
import os
import re
import subprocess
import wave

from tts import RATE, read_pcm, seconds, trim

FPS = 30
X_BEAT, X_SCENE = 0.32, 0.6
LEAD_FIRST, LEAD_SCENE, LEAD_BEAT = 0.5, 0.55, 0.1
SCENE_TAIL, END_TAIL = 0.35, 1.1
FADE_IN, FADE_OUT = 0.35, 0.6


def build_timeline(spec, beat_wavs):
    """beat_wavs: list (per scene) of lists of wav paths. -> list of beat dicts."""
    beats, t = [], 0.0
    ns = len(spec["scenes"])
    for si, sc in enumerate(spec["scenes"]):
        nb = len(sc["beats"])
        for bi, b in enumerate(sc["beats"]):
            pcm = trim(read_pcm(beat_wavs[si][bi]))
            speech = seconds(pcm)
            first_scene_beat = bi == 0
            lead = LEAD_FIRST if (si == 0 and bi == 0) else (LEAD_SCENE if first_scene_beat else LEAD_BEAT)
            xin = 0 if (si == 0 and bi == 0) else (X_SCENE if first_scene_beat else X_BEAT)
            d = lead + speech + spec["pad"] + b["pause"]
            if bi == nb - 1:
                d += SCENE_TAIL + float(sc.get("pause", 0) or 0)
                if si == ns - 1:
                    d += END_TAIL
            beats.append({"scene": si, "beat": bi, "start": round(t, 4), "dur": round(d, 4),
                          "voice_at": round(t + lead, 4), "speech": round(speech, 4), "xin": xin,
                          "text": b["text"], "pcm": pcm})
            t += d
    return beats, t


def write_narration(beats, total, path):
    buf = bytearray(int(round(total * RATE)) * 2)
    for b in beats:
        off = int(round(b["voice_at"] * RATE)) * 2
        pcm = b["pcm"][: max(0, len(buf) - off)]
        buf[off:off + len(pcm)] = pcm
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(buf))


def loudnorm(src, dst, target=-16.0):
    """Two-pass EBU R128 normalisation (linear gain, no pumping) -> 48 kHz."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-af",
                        f"loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S)
    af = f"loudnorm=I={target}:TP=-1.5:LRA=11"
    if m:
        j = json.loads(m.group(0))
        af += (f":measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
               f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    # (TTS WAVs carry no channel layout; pin mono or the filter graph can't negotiate one)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af",
                    af + ",aresample=48000,aformat=channel_layouts=mono", "-ar", "48000", "-ac", "1", dst],
                   check=True)


# ---------------------------------------------------------------- subtitles
def _chunks(text, limit=84):
    """Split narration into caption-sized chunks on sentence/clause boundaries."""
    sents = re.split(r"(?<=[.!?…])\s+|(?<=[;:—])\s+", text.strip())
    out = []
    for s in sents:
        words, cur = s.split(), ""
        for w in words:
            if cur and len(cur) + 1 + len(w) > limit:
                out.append(cur)
                cur = w
            else:
                cur = f"{cur} {w}".strip()
        if cur:
            if out and len(out[-1]) + len(cur) + 1 <= limit * 0.6 and not re.search(r"[.!?]$", out[-1]):
                out[-1] += " " + cur
            else:
                out.append(cur)
    return out


def _two_lines(s, width=42):
    if len(s) <= width:
        return s
    mid = len(s) // 2
    cands = [m.start() for m in re.finditer(" ", s)]
    if not cands:
        return s
    k = min(cands, key=lambda i: abs(i - mid))
    return s[:k] + "\n" + s[k + 1:]


def caption_cues(beats):
    cues = []
    for b in beats:
        chunks = _chunks(b["text"])
        total_chars = sum(len(c) for c in chunks) or 1
        t0, span = b["voice_at"], b["speech"]
        for c in chunks:
            d = span * len(c) / total_chars
            cues.append((t0, t0 + d, c))
            t0 += d
    # bridge tiny gaps between consecutive cues so captions don't flicker
    out = []
    for i, (a, z, c) in enumerate(cues):
        if i + 1 < len(cues) and cues[i + 1][0] - z < 0.6:
            z = cues[i + 1][0] - 0.02
        out.append((a, z, c))
    return out


def _ts(t, sep=","):
    h, r = divmod(max(0, t), 3600)
    m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d}{sep}{int(round((s % 1) * 1000)) % 1000:03d}"


def write_srt(cues, path):
    with open(path, "w") as f:
        for i, (a, z, c) in enumerate(cues, 1):
            f.write(f"{i}\n{_ts(a)} --> {_ts(z)}\n{_two_lines(c)}\n\n")


def write_ass(cues, path):
    def ts(t):
        h, r = divmod(max(0, t), 3600)
        m, s = divmod(r, 60)
        return f"{int(h)}:{int(m):02d}:{s:05.2f}"
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Avenir Next Demi Bold,52,&H00F0F5FA,&H00F0F5FA,&H00000000,&H50000000,0,0,0,0,100,100,0,0,3,18,0,2,260,260,56,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(path, "w") as f:
        f.write(head)
        for a, z, c in cues:
            line = _two_lines(c).replace("\n", r"\N")
            f.write(f"Dialogue: 0,{ts(a)},{ts(z)},Cap,,0,0,0,,{line}\n")


# ---------------------------------------------------------------- video
def segments_for(beats, frame_paths, videos):
    """Group beats into xfade segments. A still beat is one segment; a video scene
    (videos[scene] = {base, over, clip, x, y}) is ONE segment spanning all its beats so
    the clip plays continuously instead of restarting per beat."""
    segs, k, n = [], 0, len(beats)
    while k < n:
        b = beats[k]
        j = k
        if b["scene"] in videos:
            while j + 1 < n and beats[j + 1]["scene"] == b["scene"]:
                j += 1
        end = beats[j]["start"] + beats[j]["dur"]
        nxt_x = beats[j + 1]["xin"] if j + 1 < n else 0
        seg = {"start": b["start"], "xin": b["xin"], "length": end - b["start"] + nxt_x + 0.05}
        if b["scene"] in videos:
            seg.update(videos[b["scene"]], kind="video")
        else:
            seg.update(kind="still", png=frame_paths[k])
        segs.append(seg)
        k = j + 1
    return segs


def encode(beats, total, segments, overlays, narration, subs, out, title, burn_ass=None, log=print):
    """segments: from segments_for(); overlays: Ken Burns [{path, x, y, t0, t1, xin, xout}]."""
    args = ["ffmpeg", "-hide_banner", "-v", "error", "-y"]
    f = []
    idx = 0

    def add_input(*a):
        nonlocal idx
        args.extend(a)
        idx += 1
        return idx - 1

    for k, sg in enumerate(segments):
        L = sg["length"]
        if sg["kind"] == "still":
            i = add_input("-framerate", str(FPS), "-i", sg["png"])
            f.append(f"[{i}:v]format=yuv420p,setsar=1,tpad=stop_mode=clone:stop_duration={L:.3f},"
                     f"trim=duration={L:.3f},setpts=PTS-STARTPTS,settb=1/{FPS}[b{k}]")
        else:  # slide base -> normalised clip at its rect -> transparent chrome on top
            ib = add_input("-framerate", str(FPS), "-i", sg["base"])
            ic = add_input("-i", sg["clip"])
            f.append(f"[{ib}:v]format=yuv420p,setsar=1,tpad=stop_mode=clone:stop_duration={L:.3f},"
                     f"trim=duration={L:.3f},setpts=PTS-STARTPTS[vb{k}]")
            f.append(f"[{ic}:v]setpts=PTS-STARTPTS,format=yuv420p,setsar=1[vc{k}]")
            chain = f"[vb{k}][vc{k}]overlay=x={sg['x']}:y={sg['y']}:eof_action=repeat"
            if sg.get("over"):
                io = add_input("-framerate", str(FPS), "-i", sg["over"])
                f.append(chain + f"[vm{k}]")
                f.append(f"[{io}:v]format=rgba[vo{k}]")
                chain = f"[vm{k}][vo{k}]overlay=0:0:eof_action=repeat:format=auto"
            f.append(chain + f",trim=duration={L:.3f},setpts=PTS-STARTPTS,format=yuv420p,settb=1/{FPS}[b{k}]")
    last = "b0"
    for k in range(1, len(segments)):
        f.append(f"[{last}][b{k}]xfade=transition=fade:duration={segments[k]['xin']:.3f}:"
                 f"offset={segments[k]['start']:.3f}[x{k}]")
        last = f"x{k}"
    ov_base = idx
    for o in overlays:
        add_input("-i", o["path"])
    a_idx = add_input("-i", narration)
    s_idx = add_input("-i", subs) if (subs and not burn_ass) else None
    for m, o in enumerate(overlays):
        life = o["t1"] - o["t0"]
        chain = f"[{ov_base + m}:v]format=yuva420p,fade=t=in:st=0:d={o['xin']:.3f}:alpha=1"
        if o.get("xout"):
            chain += f",fade=t=out:st={life - o['xout']:.3f}:d={o['xout']:.3f}:alpha=1"
        chain += f",setpts=PTS-STARTPTS+{o['t0']:.3f}/TB[k{m}]"
        f.append(chain)
        f.append(f"[{last}][k{m}]overlay=x={o['x']}:y={o['y']}:eof_action=pass:"
                 f"enable='between(t,{o['t0']:.3f},{o['t1']:.3f})'[o{m}]")
        last = f"o{m}"
    tail = f"fade=t=in:st=0:d={FADE_IN},fade=t=out:st={total - FADE_OUT:.3f}:d={FADE_OUT}"
    if burn_ass:
        tail += f",ass='{burn_ass}'"
    f.append(f"[{last}]{tail},format=yuv420p[vout]")
    script = os.path.join(os.path.dirname(narration), "filter.txt")
    with open(script, "w") as fh:
        fh.write(";\n".join(f))
    # `-/opt <file>` reads the option's value from a file (FFmpeg 7+; 9 dropped -filter_complex_script).
    args += ["-/filter_complex", script, "-map", "[vout]", "-map", f"{a_idx}:a"]
    if s_idx is not None:
        args += ["-map", f"{s_idx}:s", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng"]
    args += ["-c:v", "libx264", "-preset", "slow", "-crf", "30", "-tune", "stillimage", "-pix_fmt", "yuv420p",
             "-profile:v", "high", "-level:v", "4.2", "-r", str(FPS), "-g", str(FPS * 2),
             "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "2",
             "-t", f"{total:.3f}", "-movflags", "+faststart", "-metadata", f"title={title}", out]
    tmp_out = out + ".part.mp4"
    args[-1] = tmp_out
    p = subprocess.run(args, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError("ffmpeg failed:\n" + p.stderr[-3000:])
    os.replace(tmp_out, out)
