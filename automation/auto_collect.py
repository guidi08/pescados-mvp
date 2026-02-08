#!/usr/bin/env python3
import json
import os
import re
import subprocess
from datetime import datetime

ACCOUNT = "pedidosbrgourmet@gmail.com"
OUT_DIR = "/Users/guilhermesbot/clawd/anexos"
STATE_PATH = "/Users/guilhermesbot/clawd/automation/auto_collect_state.json"

os.makedirs(OUT_DIR, exist_ok=True)


def sh(cmd):
    env = os.environ.copy()
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    return subprocess.check_output(cmd, shell=True, text=True, env=env)


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    return {"processed_message_ids": []}


def save_state(state):
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def safe_name(name: str) -> str:
    name = name.strip() or "arquivo"
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name[:180]


def main():
    state = load_state()
    processed = set(state.get("processed_message_ids", []))

    msg_json = sh(f"gog gmail messages search \"in:inbox newer_than:7d has:attachment\" --account {ACCOUNT} --max 25 --json")
    msg = json.loads(msg_json)
    messages = msg.get("messages", [])

    for m in messages:
        mid = m.get("id")
        if not mid or mid in processed:
            continue

        full = json.loads(sh(f"gog gmail get {mid} --account {ACCOUNT} --format full --json"))
        attachments = full.get("attachments", [])
        if not attachments:
            processed.add(mid)
            continue

        headers = full.get("headers", {})
        subject = headers.get("subject", "")
        sender = headers.get("from", "")
        date = headers.get("date", "")

        for att in attachments:
            filename = att.get("filename") or "arquivo"
            att_id = att.get("attachmentId")
            if not att_id:
                continue

            base = safe_name(filename)
            ts = datetime.now().strftime("%Y%m%d-%H%M%S")
            out_name = f"{ts}_{mid}_{base}"
            out_path = os.path.join(OUT_DIR, out_name)

            sh(f"gog gmail attachment {mid} {att_id} --account {ACCOUNT} --out \"{out_path}\"")

            meta = {
                "message_id": mid,
                "subject": subject,
                "from": sender,
                "date": date,
                "original_filename": filename,
                "saved_as": out_name,
            }
            with open(out_path + ".meta.json", "w") as f:
                json.dump(meta, f, indent=2)

        processed.add(mid)

    state["processed_message_ids"] = sorted(list(processed))
    save_state(state)


if __name__ == "__main__":
    main()
