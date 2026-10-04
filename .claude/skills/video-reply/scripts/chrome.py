"""Minimal headless-Chrome driver over the DevTools protocol (no puppeteer/playwright).

One Chrome process renders every slide: navigate to a scene's HTML once, then for
each beat call a JS hook and grab a PNG. ~100 ms/frame vs ~1 s per cold
`chrome --screenshot` launch. Only dependency: `websockets` (already pulled in by
google-genai).
"""
import base64
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request

from websockets.sync.client import connect

CHROME_CANDIDATES = [
    os.environ.get("CHROME_PATH", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
]


def find_chrome():
    for c in CHROME_CANDIDATES:
        if c and os.path.exists(c):
            return c
    raise RuntimeError("Google Chrome not found (set CHROME_PATH)")


class Chrome:
    def __init__(self, width=1920, height=1080):
        self.width, self.height = width, height
        self.tmp = tempfile.mkdtemp(prefix="video-reply-chrome-")
        self.proc = subprocess.Popen(
            [find_chrome(), "--headless=new", "--remote-debugging-port=0",
             f"--user-data-dir={self.tmp}", "--no-first-run", "--no-default-browser-check",
             "--hide-scrollbars", "--mute-audio", "--force-color-profile=srgb",
             "--allow-file-access-from-files", "--disable-extensions",
             "--disable-background-networking", f"--window-size={width},{height}",
             "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        port_file = os.path.join(self.tmp, "DevToolsActivePort")
        deadline = time.time() + 20
        while not (os.path.exists(port_file) and open(port_file).read().strip()):
            if time.time() > deadline or self.proc.poll() is not None:
                self.close()
                raise RuntimeError("Chrome did not start (no DevToolsActivePort)")
            time.sleep(0.05)
        port = open(port_file).read().split("\n")[0].strip()
        targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
        page = next(t for t in targets if t["type"] == "page")
        self.ws = connect(page["webSocketDebuggerUrl"], max_size=None, open_timeout=20)
        self._id = 0
        self.send("Page.enable")
        self.send("Emulation.setDeviceMetricsOverride", width=width, height=height,
                  deviceScaleFactor=1, mobile=False)

    def send(self, method, timeout=60, **params):
        self._id += 1
        mid = self._id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        deadline = time.time() + timeout
        while True:
            msg = json.loads(self.ws.recv(timeout=max(0.1, deadline - time.time())))
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"CDP {method}: {msg['error']}")
                return msg.get("result", {})
            if msg.get("method") == "Page.loadEventFired":
                self._loaded = True

    def goto(self, url, timeout=30):
        self._loaded = False
        self.send("Page.navigate", url=url)
        deadline = time.time() + timeout
        while not self._loaded:
            if time.time() > deadline:
                raise RuntimeError(f"timeout loading {url}")
            msg = json.loads(self.ws.recv(timeout=max(0.1, deadline - time.time())))
            if msg.get("method") == "Page.loadEventFired":
                self._loaded = True

    def eval(self, expr, timeout=60):
        r = self.send("Runtime.evaluate", timeout=timeout, expression=expr,
                      awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise RuntimeError(f"JS error: {d.get('exception', {}).get('description') or d.get('text')}")
        return r.get("result", {}).get("value")

    def screenshot(self, path):
        r = self.send("Page.captureScreenshot", format="png", fromSurface=True,
                      captureBeyondViewport=False)
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))

    def screenshot_over(self, path):
        """Transparent PNG of only the `.over` elements (drawn on top of a clip)."""
        self.send("Emulation.setDefaultBackgroundColorOverride", color={"r": 0, "g": 0, "b": 0, "a": 0})
        self.eval("document.body.classList.add('pass-over'); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
        self.screenshot(path)
        self.eval("document.body.classList.remove('pass-over')")
        self.send("Emulation.setDefaultBackgroundColorOverride")

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()
