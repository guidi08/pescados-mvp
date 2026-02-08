#!/usr/bin/env python3
import os
import time
import json
import re
import subprocess
import sys
import urllib.request

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "8584232612")
STATE_PATH = os.environ.get("TELEGRAM_BRIDGE_STATE", "/Users/guilhermesbot/clawd/automation/.telegram_bridge_state.json")
POLL_TIMEOUT = int(os.environ.get("TELEGRAM_POLL_TIMEOUT", "25"))
SLEEP_SEC = float(os.environ.get("TELEGRAM_POLL_SLEEP", "0.5"))

if not BOT_TOKEN:
    print("TELEGRAM_BOT_TOKEN not set", file=sys.stderr)
    sys.exit(1)

CMD_RE = re.compile(r"manda\s+\"(?P<msg>.+?)\"\s+para\s+(?P<num>\+?\d+)", re.IGNORECASE)
CMD2_RE = re.compile(r"whatsapp:\s*(?P<num>\+?\d+)", re.IGNORECASE)


def load_state():
    try:
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {"last_update_id": 0}


def save_state(state):
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE_PATH)


def telegram_get_updates(offset):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates?timeout={POLL_TIMEOUT}&offset={offset}"
    with urllib.request.urlopen(url, timeout=POLL_TIMEOUT + 5) as resp:
        return json.loads(resp.read().decode("utf-8"))


def telegram_send_message(text):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = json.dumps({"chat_id": CHAT_ID, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read()


def send_whatsapp(number, message):
    cmd = ["clawdbot", "message", "send", "--channel", "whatsapp", "--target", number, "--message", message]
    return subprocess.run(cmd, capture_output=True, text=True)


def handle_text(text):
    m = CMD_RE.search(text)
    if m:
        msg = m.group("msg")
        num = m.group("num")
        return (num, msg)
    m2 = CMD2_RE.search(text)
    if m2:
        num = m2.group("num")
        return (num, "oi")
    return None


def main():
    state = load_state()
    offset = int(state.get("last_update_id", 0)) + 1 if state.get("last_update_id", 0) else None

    while True:
        try:
            res = telegram_get_updates(offset or 0)
            if not res.get("ok"):
                time.sleep(2)
                continue
            for upd in res.get("result", []):
                update_id = upd.get("update_id")
                if update_id is None:
                    continue
                state["last_update_id"] = update_id
                save_state(state)
                offset = update_id + 1

                msg = upd.get("message") or {}
                chat = msg.get("chat") or {}
                if str(chat.get("id")) != str(CHAT_ID):
                    continue
                text = msg.get("text") or ""
                action = handle_text(text)
                if not action:
                    continue
                number, body = action
                r = send_whatsapp(number, body)
                if r.returncode == 0:
                    telegram_send_message(f"Enviado no WhatsApp para {number}.")
                else:
                    telegram_send_message(f"Falha ao enviar para {number}. {r.stderr.strip()}")
        except Exception:
            time.sleep(2)
        time.sleep(SLEEP_SEC)


if __name__ == "__main__":
    main()
