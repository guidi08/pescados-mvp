#!/usr/bin/env python3
import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path

import pandas as pd

ACCOUNT = "asanamomo1@gmail.com"
OUT_DIR = "/Users/guilhermesbot/clawd/anexos/momo_reports"
STATE_PATH = "/Users/guilhermesbot/clawd/automation/auto_momo_report_state.json"
WHATSAPP_TO = "+5511999713995"

Path(OUT_DIR).mkdir(parents=True, exist_ok=True)


def sh(cmd):
    env = os.environ.copy()
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    return subprocess.check_output(cmd, shell=True, text=True, env=env)


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    return {"processed_message_ids": [], "last_vouchers_total": 37463.92}


def save_state(state):
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def safe_name(name: str) -> str:
    name = name.strip() or "arquivo"
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name[:180]


def fmt_money(v):
    if v is None or pd.isna(v):
        return "—"
    return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_int(v):
    if v is None or pd.isna(v):
        return "—"
    return str(int(v))


def parse_export(path):
    df = pd.read_excel(path, sheet_name="Export_CSV", header=1)
    df = df.dropna(how="all")
    if df.empty:
        return None
    row = df.iloc[0]
    date = row.get("data_movimento")
    if pd.notna(date):
        try:
            date = pd.to_datetime(date, unit="D", origin="1899-12-30").date()
        except Exception:
            pass
    return {
        "date": date,
        "total_entradas": row.get("total_entradas"),
        "salao_total": row.get("salao_total"),
        "delivery_leop_total_valor": row.get("delivery_leop_total_valor"),
        "delivery_leop_total_qtd": row.get("delivery_leop_total_qtd"),
        "delivery_pin_total_valor": row.get("delivery_pin_total_valor"),
        "delivery_pin_total_qtd": row.get("delivery_pin_total_qtd"),
        "rod_total_dia": row.get("rod_total_dia"),
        "vouchers_total": row.get("vouchers_total"),
    }


def summarize(data, last_vouchers_total):
    date = data.get("date")
    if isinstance(date, datetime):
        date = date.date()
    date_str = date.strftime("%d/%m/%Y") if hasattr(date, "strftime") else str(date)

    vouchers_total = data.get("vouchers_total")
    if vouchers_total is not None and last_vouchers_total is not None:
        voucher_delta = float(vouchers_total) - float(last_vouchers_total)
    else:
        voucher_delta = None

    total_entradas = data.get("total_entradas")
    if voucher_delta is not None and total_entradas is not None:
        soma_voucher_entradas = float(voucher_delta) + float(total_entradas)
    else:
        soma_voucher_entradas = None

    total_pedidos = (data.get("delivery_leop_total_qtd") or 0) + (data.get("delivery_pin_total_qtd") or 0)

    lines = [
        f"Relatório {date_str}",
        f"• Vendas salão (dia anterior): {fmt_money(data.get('salao_total'))}",
        f"• Delivery Leopoldina: {fmt_money(data.get('delivery_leop_total_valor'))}",
        f"• Delivery Pinheiros: {fmt_money(data.get('delivery_pin_total_valor'))}",
        f"• Rodízios vendidos: {fmt_int(data.get('rod_total_dia'))}",
        f"• Pedidos total: {fmt_int(total_pedidos)} (Leo: {fmt_int(data.get('delivery_leop_total_qtd'))} | Pin: {fmt_int(data.get('delivery_pin_total_qtd'))})",
        f"• Entrada financeira no dia: {fmt_money(total_entradas)}",
        f"• Voucher total: {fmt_money(vouchers_total)}",
        f"• Entrada no voucher (Δ): {fmt_money(voucher_delta)}",
        f"• Δ voucher + entrada: {fmt_money(soma_voucher_entradas)}",
    ]
    return "\n".join(lines)


def main():
    state = load_state()
    processed = set(state.get("processed_message_ids", []))
    last_vouchers_total = state.get("last_vouchers_total", 37463.92)

    msg_json = sh(f"gog gmail messages search \"in:inbox newer_than:7d has:attachment\" --account {ACCOUNT} --max 25 --json")
    msg = json.loads(msg_json)
    messages = msg.get("messages", [])

    for m in messages:
        mid = m.get("id")
        if not mid or mid in processed:
            continue

        full = json.loads(sh(f"gog gmail get {mid} --account {ACCOUNT} --json"))
        attachments = full.get("attachments", [])
        if not attachments:
            processed.add(mid)
            continue

        headers = full.get("headers", {})
        subject = headers.get("subject", "")

        for att in attachments:
            filename = att.get("filename") or "arquivo"
            if not filename.lower().endswith(".xlsx"):
                continue
            att_id = att.get("attachmentId")
            if not att_id:
                continue

            base = safe_name(filename)
            ts = datetime.now().strftime("%Y%m%d-%H%M%S")
            out_name = f"{ts}_{mid}_{base}"
            out_path = os.path.join(OUT_DIR, out_name)

            sh(f"gog gmail attachment {mid} {att_id} --account {ACCOUNT} --out \"{out_path}\"")

            data = parse_export(out_path)
            if data:
                msg_text = summarize(data, last_vouchers_total)
                sh(f"clawdbot message send --channel whatsapp --target {WHATSAPP_TO} --message \"{msg_text}\"")
                # update last vouchers total for next report
                if data.get("vouchers_total") is not None:
                    last_vouchers_total = float(data.get("vouchers_total"))
            else:
                msg_text = f"Relatório recebido, mas não consegui ler o Export_CSV: {base}\nAssunto: {subject}"
                sh(f"clawdbot message send --channel whatsapp --target {WHATSAPP_TO} --message \"{msg_text}\"")

        processed.add(mid)

    state["processed_message_ids"] = sorted(list(processed))
    state["last_vouchers_total"] = last_vouchers_total
    save_state(state)


if __name__ == "__main__":
    main()
