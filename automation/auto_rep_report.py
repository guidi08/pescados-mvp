#!/usr/bin/env python3
import json
import os
import re
import subprocess
from datetime import datetime, timedelta

SHEET_ID = "1ylE9rUBdETe0jWiV_8S2oRJXtDsNiulrqwZhAGclpxs"
ACCOUNT = "pedidosbrgourmet@gmail.com"
WHATSAPP_TO = "+5511999713995"
STATE_PATH = "/Users/guilhermesbot/clawd/automation/auto_rep_report_state.json"


def sh(cmd):
    env = os.environ.copy()
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    return subprocess.check_output(cmd, shell=True, text=True, env=env)


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    return {"last_sent": None}


def save_state(state):
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def parse_currency(val):
    if val is None:
        return None
    s = str(val)
    m = re.search(r"[0-9][0-9\.]*,[0-9]{2}", s)
    if not m:
        return None
    s = m.group(0).replace(".", "").replace(",", ".")
    return float(s)


def fmt_money(v):
    if v is None:
        return "—"
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def get_sheet_titles():
    meta = json.loads(sh(f"gog sheets metadata {SHEET_ID} --json --account {ACCOUNT}"))
    return [s["properties"]["title"] for s in meta.get("sheets", [])]


def find_sheet_for(date_obj, titles):
    target = date_obj.strftime("%d/%m")
    for t in titles:
        if t.lower().startswith("pedidos para") and target in t:
            return t
    return None


def read_cell(sheet, cell):
    res = json.loads(sh(f"gog sheets get {SHEET_ID} '{sheet}!{cell}' --json --account {ACCOUNT}"))
    vals = res.get("values", [])
    if not vals or not vals[0]:
        return None
    return vals[0][0]


def build_msg(date_obj, sheet):
    g2 = read_cell(sheet, "G2")
    m2 = read_cell(sheet, "M2")
    g2v = parse_currency(g2)
    m2v = parse_currency(m2)
    date_str = date_obj.strftime("%d/%m/%Y")
    lines = [
        f"Pedidos para {date_str}",
        f"• Vendas (G2): {fmt_money(g2v)}",
        f"• Comissão (M2): {fmt_money(m2v)}",
    ]
    return "\n".join(lines)


def main():
    state = load_state()

    # avoid duplicate sends in the same minute
    now = datetime.now()
    now_key = now.strftime("%Y-%m-%d %H:%M")
    if state.get("last_sent") == now_key:
        return

    # only send between 06:30 and 14:30 (Miami)
    if now.hour == 6 and now.minute < 30:
        return

    titles = get_sheet_titles()

    today = datetime.now().date()
    d1 = today + timedelta(days=1)

    sheets_to_send = []

    # always send D+1
    sh1 = find_sheet_for(d1, titles)
    if sh1:
        sheets_to_send.append((d1, sh1))

    # if Friday, also send D+3
    if datetime.now().weekday() == 4:  # Friday
        d3 = today + timedelta(days=3)
        sh3 = find_sheet_for(d3, titles)
        if sh3:
            sheets_to_send.append((d3, sh3))

    if not sheets_to_send:
        return

    msgs = [build_msg(d, sh) for d, sh in sheets_to_send]
    msg = "\n\n".join(msgs)

    sh(f"clawdbot message send --channel whatsapp --target {WHATSAPP_TO} --message \"{msg}\"")

    state["last_sent"] = now_key
    save_state(state)


if __name__ == "__main__":
    main()
