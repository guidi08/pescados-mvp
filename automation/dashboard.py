#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import time
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 3334

STATE_FILES = [
    "auto_collect_state.json",
    "auto_momo_report_state.json",
    "auto_rep_report_state.json",
    "auto_triage_state.json",
    ".telegram_bridge_state.json",
    "state.json",
]

LOG_FILES = [
    "telegram_bridge.log",
]


def file_info(path):
    try:
        st = os.stat(path)
        return {
            "exists": True,
            "mtime": st.st_mtime,
            "size": st.st_size,
        }
    except FileNotFoundError:
        return {"exists": False}


def read_json_safe(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def tail_file(path, lines=200):
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            block = 4096
            data = b""
            while size > 0 and data.count(b"\n") <= lines:
                step = min(block, size)
                size -= step
                f.seek(size)
                data = f.read(step) + data
            text = data.decode("utf-8", errors="replace")
            return "\n".join(text.splitlines()[-lines:])
    except FileNotFoundError:
        return ""


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, content, ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if isinstance(content, str):
            self.wfile.write(content.encode("utf-8"))
        else:
            self.wfile.write(content)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/status":
            statuses = []
            for name in STATE_FILES:
                path = os.path.join(ROOT, name)
                info = file_info(path)
                data = read_json_safe(path) if info.get("exists") else None
                summary = None
                if isinstance(data, dict):
                    keys = list(data.keys())
                    summary = {k: data[k] for k in keys[:8]}
                statuses.append({
                    "name": name,
                    "info": info,
                    "summary": summary,
                })

            logs = []
            for name in LOG_FILES:
                path = os.path.join(ROOT, name)
                info = file_info(path)
                logs.append({
                    "name": name,
                    "info": info,
                    "tail": tail_file(path, lines=200) if info.get("exists") else "",
                })

            payload = {
                "now": time.time(),
                "states": statuses,
                "logs": logs,
            }
            self._send(200, json.dumps(payload))
            return

        if parsed.path == "/" or parsed.path == "/index.html":
            try:
                with open(os.path.join(ROOT, "dashboard.html"), "r", encoding="utf-8") as f:
                    self._send(200, f.read(), ctype="text/html; charset=utf-8")
            except FileNotFoundError:
                self._send(404, "Not found", ctype="text/plain")
            return

        self._send(404, "Not found", ctype="text/plain")


if __name__ == "__main__":
    httpd = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Automation dashboard running on http://localhost:{PORT}")
    httpd.serve_forever()
