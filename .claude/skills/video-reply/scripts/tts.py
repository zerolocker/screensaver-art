"""Gemini TTS per beat, cached on disk by hash(text, voice, model, style).

- Response audio differs by model: 3.x-flash returns either raw little-endian
  L16 PCM ("audio/L16;codec=pcm;rate=24000") or a full WAV ("audio/wav"). Both are
  normalised to 24 kHz mono s16 here.
- Retries 429/5xx/empty responses with exponential backoff; after that, falls back
  to `fallback_model` (same prebuilt voice names) with a warning.
- Guards against the two TTS failure modes seen in testing — reading the style
  direction aloud, and silently dropping a sentence — with a duration sanity check
  and (default on) a quick transcription check of each *new* clip.
"""
import difflib
import hashlib
import io
import json
import os
import random
import re
import subprocess
import threading
import time
import wave
from array import array

RATE = 24000
VERIFY_MODEL = os.environ.get("EXPLAINER_VERIFY_MODEL", "gemini-flash-latest")
RETRY_CODES = {429, 500, 502, 503, 504}


class NoAudio(Exception):
    pass


def cache_key(text, voice, model, style):
    blob = json.dumps({"t": text, "v": voice, "m": model, "s": style}, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:24]


def to_pcm(mime, data):
    """Return 24 kHz mono s16le PCM bytes from whatever the model sent."""
    mime = (mime or "").lower()
    if "wav" in mime or data[:4] == b"RIFF":
        with wave.open(io.BytesIO(data)) as w:
            rate, ch, sw, pcm = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.readframes(w.getnframes())
        fmt = {1: "u8", 2: "s16le", 4: "s32le"}[sw]
    else:
        m = re.search(r"rate=(\d+)", mime)
        rate = int(m.group(1)) if m else RATE
        m = re.search(r"channels=(\d+)", mime)
        ch = int(m.group(1)) if m else 1
        pcm, fmt = data, "s16le"
    if rate == RATE and ch == 1 and fmt == "s16le":
        return pcm
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", fmt, "-ar", str(rate), "-ac", str(ch), "-i", "-",
                        "-f", "s16le", "-ar", str(RATE), "-ac", "1", "-"], input=pcm, capture_output=True, check=True)
    return p.stdout


def write_wav(path, pcm):
    tmp = path + ".tmp"
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)
    os.replace(tmp, path)


def read_pcm(path):
    with wave.open(path) as w:
        return w.readframes(w.getnframes())


def trim(pcm, thresh=420, head_keep=0.03, tail_keep=0.14):
    """Strip leading/trailing silence so beat timing is driven by actual speech."""
    a = array("h")
    a.frombytes(pcm)
    n = len(a)
    i = 0
    while i < n and abs(a[i]) < thresh:
        i += 1
    j = n - 1
    while j > i and abs(a[j]) < thresh:
        j -= 1
    if i >= j:
        return pcm
    i = max(0, i - int(head_keep * RATE))
    j = min(n, j + int(tail_keep * RATE))
    return a[i:j].tobytes()


def seconds(pcm):
    return len(pcm) / 2 / RATE


# Numbers are written/heard inconsistently ("487" vs "four hundred and eighty-seven",
# "$0.99" vs "ninety-nine cents"), so the transcript check ignores them entirely.
_NUMWORDS = set("""zero oh one two three four five six seven eight nine ten eleven twelve thirteen
fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty
ninety hundred thousand million billion point and dollar dollars cent cents percent""".split())


def _norm(s):
    toks = re.findall(r"[a-z]+|\d+", s.lower().replace("'", ""))
    return "".join(t for t in toks if not t.isdigit() and t not in _NUMWORDS)


class TTS:
    def __init__(self, cache_dir, model, fallback_model, voice, style, verify=True, refresh=False, log=print):
        from google import genai
        self.client = genai.Client()
        self.dir = os.path.join(cache_dir, "tts")
        os.makedirs(self.dir, exist_ok=True)
        self.model, self.fallback, self.voice, self.style = model, fallback_model, voice, style
        self.verify, self.refresh, self.log = verify, refresh, log
        self.warnings = []
        self.lock = threading.Lock()
        self.stats = {"cached": 0, "synth": 0}

    def _warn(self, msg):
        with self.lock:
            self.warnings.append(msg)

    def _retry(self, fn, what, attempts=5):
        from google.genai import errors
        for k in range(attempts):
            try:
                return fn()
            except Exception as e:  # APIError, NoAudio, transient network errors
                code = getattr(e, "code", None)
                transient = (isinstance(e, NoAudio) or code in RETRY_CODES
                             or not isinstance(e, errors.APIError))
                if not transient or k == attempts - 1:
                    raise
                wait = min(40, 3 * 2 ** k) + random.uniform(0, 1.5)
                self.log(f"  … {what}: {code or type(e).__name__}, retry in {wait:.0f}s")
                time.sleep(wait)

    def _call(self, model, text):
        from google.genai import types
        prompt = f"{self.style}\n\n{text}" if self.style else text
        cfg = types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.voice))))

        def once():
            r = self.client.models.generate_content(model=model, contents=prompt, config=cfg)
            cand = (r.candidates or [None])[0]
            parts = (cand.content.parts if cand and cand.content else None) or []
            part = next((p for p in parts if p.inline_data and p.inline_data.data), None)
            if not part:
                raise NoAudio(f"no audio (finish_reason={getattr(cand, 'finish_reason', None)})")
            return to_pcm(part.inline_data.mime_type, part.inline_data.data)
        return self._retry(once, f"tts[{model}]")

    def _check(self, text, pcm):
        """Return (ok, reason). Cheap duration check, then optional transcription."""
        words = len(text.split())
        dur = seconds(trim(pcm))
        expected = words / 2.75
        if words >= 5 and (dur > expected * 1.6 + 1.5 or dur < expected * 0.45):
            return False, f"duration {dur:.1f}s vs ~{expected:.1f}s expected"
        if not self.verify:
            return True, ""
        try:
            from google.genai import types
            buf = io.BytesIO()
            with wave.open(buf, "wb") as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm)
            r = self._retry(lambda: self.client.models.generate_content(
                model=VERIFY_MODEL,
                contents=[types.Part.from_bytes(data=buf.getvalue(), mime_type="audio/wav"),
                          "Transcribe this speech verbatim. Output only the transcript."]), "verify", attempts=3)
            heard = r.text or ""
        except Exception as e:
            self._warn(f"could not verify audio ({type(e).__name__}); kept unverified: \"{text[:50]}…\"")
            return True, ""
        a, b = _norm(text), _norm(heard)
        m = sum(bl.size for bl in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks())
        extra, missing = len(b) - m, len(a) - m
        if extra > 0.25 * len(a) + 15:
            return False, f"extra speech: heard \"{heard[:90]}\""
        if missing > 0.2 * len(a) + 10:
            return False, f"missing speech: heard \"{heard[:90]}\""
        return True, ""

    def get(self, text):
        """Path to a cached WAV for this beat (synthesising if needed)."""
        keys = [(self.model, cache_key(text, self.voice, self.model, self.style))]
        if self.fallback and self.fallback != self.model:
            keys.append((self.fallback, cache_key(text, self.voice, self.fallback, self.style)))
        if not self.refresh:
            for _, k in keys:
                p = os.path.join(self.dir, k + ".wav")
                if os.path.exists(p):
                    with self.lock:
                        self.stats["cached"] += 1
                    return p
        for mi, (model, k) in enumerate(keys):
            try:
                best = None
                for attempt in range(2):
                    pcm = self._call(model, text)
                    ok, why = self._check(text, pcm)
                    if ok:
                        best = pcm
                        break
                    self.log(f"  … re-synthesising ({why}): \"{text[:50]}…\"")
                    best = best or pcm
                else:
                    self._warn(f"audio check still failing after retry — listen to: \"{text[:60]}…\"")
                if mi:
                    self._warn(f"used fallback TTS model {model} for: \"{text[:50]}…\"")
                p = os.path.join(self.dir, k + ".wav")
                write_wav(p, best)
                with open(os.path.join(self.dir, k + ".json"), "w") as f:
                    json.dump({"text": text, "voice": self.voice, "model": model, "style": self.style}, f, indent=1)
                with self.lock:
                    self.stats["synth"] += 1
                return p
            except Exception as e:
                if mi == len(keys) - 1:
                    raise RuntimeError(f"TTS failed for \"{text[:60]}…\": {e}") from e
                self.log(f"  … {model} failed ({e}); trying fallback {keys[mi + 1][0]}")


def tempo(path, speed):
    """Speed up a cached beat WAV (pitch-preserving atempo); cached next to the source."""
    if abs(speed - 1.0) < 1e-3:
        return path
    out = f"{path[:-4]}.x{speed:.3f}.wav"
    if not os.path.exists(out):
        import subprocess
        tmp = out + ".tmp.wav"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-filter:a", f"atempo={speed:.3f}", tmp], check=True)
        os.replace(tmp, out)
    return out
