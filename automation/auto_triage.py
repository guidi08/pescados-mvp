#!/usr/bin/env python3
import json
import os
import re
import subprocess
from datetime import datetime

IN_DIR = "/Users/guilhermesbot/clawd/anexos"
ARCHIVE_DIR = "/Users/guilhermesbot/clawd/anexos/pedidos_arquivados"
STATE_PATH = "/Users/guilhermesbot/clawd/automation/auto_triage_state.json"
WHATSAPP_TO = "+5511999713995"

os.makedirs(IN_DIR, exist_ok=True)
os.makedirs(ARCHIVE_DIR, exist_ok=True)


def sh(cmd):
    env = os.environ.copy()
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    return subprocess.check_output(cmd, shell=True, text=True, env=env)


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    return {"processed": [], "pending": None}


def save_state(state):
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def month_folder(dt: datetime) -> str:
    # Asana_FEVEREIRO-2026
    months = [
        "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO",
        "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
    ]
    return f"Asana_{months[dt.month-1]}-{dt.year}"


def find_next_file(processed_set):
    files = []
    for name in os.listdir(IN_DIR):
        if name.endswith(".meta.json"):
            continue
        path = os.path.join(IN_DIR, name)
        if not os.path.isfile(path):
            continue
        if name in processed_set:
            continue
        files.append(path)
    files.sort(key=lambda p: os.path.getmtime(p))
    return files[0] if files else None


def read_meta(path):
    meta_path = path + ".meta.json"
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            return json.load(f)
    return {}


def ask_whatsapp(subject):
    subj = subject.strip() or "(sem assunto)"
    msg = f"Assunto: {subj}\n\nTratar como pedido ou asana?"
    sh(f"clawdbot message send --channel whatsapp --target {WHATSAPP_TO} --message \"{msg}\"")


def move_file(src, dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    base = os.path.basename(src)
    dest = os.path.join(dest_dir, base)
    os.rename(src, dest)
    # move meta if exists
    meta = src + ".meta.json"
    if os.path.exists(meta):
        os.rename(meta, dest + ".meta.json")


def process_pedido(path):
    # Reuse existing pipeline logic by calling it with ATTACH_PATH
    # It will generate XLSX and WhatsApp totals when possible.
    sh(f"ATTACH_PATH=\"{path}\" python3 /Users/guilhermesbot/clawd/automation/run_pipeline.py")


def process_asana(path):
    # Placeholder: will be replaced after mapping rules are defined
    msg = (
        "Resumo ASANA ainda não configurado. Preciso do mapeamento dos campos "
        "(delivery/salao/pagamentos/entradas/vouchers) para esse tipo de arquivo."
    )
    sh(f"clawdbot message send --channel whatsapp --target {WHATSAPP_TO} --message \"{msg}\"")


def main():
    state = load_state()
    processed = set(state.get("processed", []))
    pending = state.get("pending")

    # If pending decision exists, act
    if pending and pending.get("decision") in ("pedido", "asana"):
        path = pending.get("path")
        decision = pending.get("decision")
        if path and os.path.exists(path):
            if decision == "pedido":
                process_pedido(path)
                move_file(path, ARCHIVE_DIR)
            else:
                process_asana(path)
                move_file(path, os.path.join(IN_DIR, month_folder(datetime.now())))
        processed.add(os.path.basename(path))
        state["pending"] = None
        state["processed"] = sorted(list(processed))
        save_state(state)
        return

    # If no pending, ask about next file
    if not pending:
        next_path = find_next_file(processed)
        if not next_path:
            return
        meta = read_meta(next_path)
        subject = meta.get("subject", "")
        ask_whatsapp(subject)
        state["pending"] = {
            "path": next_path,
            "created_at": datetime.now().isoformat(),
            "decision": None,
        }
        save_state(state)


if __name__ == "__main__":
    main()
