"""Gemini 3.8 TTS per beat, cached on disk by hash(text, voice, model, style).

- Requests go through the Interactions API. The text is treated strictly as a
  verbatim transcript, so the delivery direction goes in a `speech_metadata`
  annotation's `style` (a short phrase) and the voice in `speech_config`. Anything
  put in the text itself gets spoken. Requests are sent with `store=False`: nothing
  here uses server-side conversation state, and the API otherwise keeps every request.
- Responses are a WAV ("audio/wav", 24 kHz mono s16, followed by a C2PA chunk that
  the `wave` module skips), normalised to 24 kHz mono s16 here.
- Retries 429/5xx/empty responses with exponential backoff; after that, falls back
  to `FALLBACK_MODEL` (same prebuilt voice names) with a warning.
"""
import base64
import hashlib
import io
import json
import os
import random
import subprocess
import threading
import time
import wave
from array import array

RATE = 24000
MODEL = "gemini-3.8-flash-tts"
FALLBACK_MODEL = "gemini-3.8-flash-lite-tts"
RETRY_CODES = {429, 500, 502, 503, 504}

# Default delivery direction when the spec sets no `style`.
SPEECH_STYLE = "friendly, warm and engaging"  # won blind tests vs "calm…" phrasings and no style


class NoAudio(Exception):
    pass


def cache_key(text, voice, model, style):
    blob = json.dumps({"t": text, "v": voice, "m": model, "s": style}, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:24]


def to_pcm(data):
    """Return 24 kHz mono s16le PCM bytes from the WAV the model sent."""
    with wave.open(io.BytesIO(data)) as w:
        rate, ch, sw, pcm = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.readframes(w.getnframes())
    if rate == RATE and ch == 1 and sw == 2:
        return pcm
    fmt = {1: "u8", 2: "s16le", 4: "s32le"}[sw]
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


class TTS:
    def __init__(self, cache_dir, voice, style, refresh=False, log=print):
        from google import genai
        self.client = genai.Client()
        self.dir = os.path.join(cache_dir, "tts")
        os.makedirs(self.dir, exist_ok=True)
        self.model, self.voice = MODEL, voice
        self.style = SPEECH_STYLE if style is None else style
        self.refresh, self.log = refresh, log
        self.warnings = []
        self.lock = threading.Lock()
        self.stats = {"cached": 0, "synth": 0}

    def _warn(self, msg):
        with self.lock:
            self.warnings.append(msg)

    def _retry(self, fn, what, attempts=5):
        for k in range(attempts):
            try:
                return fn()
            except Exception as e:  # APIStatusError, NoAudio, transient network errors
                code = getattr(e, "status_code", None) or getattr(e, "code", None)
                transient = isinstance(e, NoAudio) or code in RETRY_CODES or code is None
                if not transient or k == attempts - 1:
                    raise
                wait = min(40, 3 * 2 ** k) + random.uniform(0, 1.5)
                self.log(f"  … {what}: {code or type(e).__name__}, retry in {wait:.0f}s")
                time.sleep(wait)

    def _call(self, model, text):
        part = {"type": "text", "text": text}
        if self.style:
            part["annotations"] = [{"type": "speech_metadata", "style": self.style}]

        def once():
            r = self.client.interactions.create(
                model=model,
                input=[{"type": "user_input", "content": [part]}],
                response_format={"type": "audio"},
                generation_config={"speech_config": [{"voice": self.voice}]},
                store=False)
            audio = getattr(r, "output_audio", None)
            if not audio or not audio.data:
                raise NoAudio(f"no audio (status={getattr(r, 'status', None)})")
            return to_pcm(audio.data if isinstance(audio.data, bytes) else base64.b64decode(audio.data))
        return self._retry(once, f"tts[{model}]")

    def get(self, text):
        """Path to a cached WAV for this beat (synthesising if needed)."""
        keys = [(m, cache_key(text, self.voice, m, self.style)) for m in (MODEL, FALLBACK_MODEL)]
        if not self.refresh:
            for _, k in keys:
                p = os.path.join(self.dir, k + ".wav")
                if os.path.exists(p):
                    with self.lock:
                        self.stats["cached"] += 1
                    return p
        for mi, (model, k) in enumerate(keys):
            try:
                pcm = self._call(model, text)
            except Exception as e:
                if mi == len(keys) - 1:
                    raise RuntimeError(f"TTS failed for \"{text[:60]}…\": {e}") from e
                self.log(f"  … {model} failed ({e}); trying fallback {keys[mi + 1][0]}")
                continue
            if mi:
                self._warn(f"used fallback TTS model {model} for: \"{text[:50]}…\"")
            p = os.path.join(self.dir, k + ".wav")
            write_wav(p, pcm)
            with open(os.path.join(self.dir, k + ".json"), "w") as f:
                json.dump({"text": text, "voice": self.voice, "model": model, "style": self.style}, f, indent=1)
            with self.lock:
                self.stats["synth"] += 1
            return p


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
