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
    import zipfile
    import xml.etree.ElementTree as ET

    if not path.lower().endswith(".xlsx"):
        msg = f"Arquivo ASANA inválido (esperado XLSX): {os.path.basename(path)}"
        sh(f"clawdbot message send --channel whatsapp --target {WHATSAPP_TO} --message \"{msg}\"")
        return

    ns = {"ns": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    def parse_xlsx(p):
        with zipfile.ZipFile(p) as z:
            # shared strings
            shared = []
            if "xl/sharedStrings.xml" in z.namelist():
                ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
                for si in ss.findall("ns:si", ns):
                    texts = [t.text or "" for t in si.findall(".//ns:t", ns)]
                    shared.append("".join(texts))

            sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
            cells = {}
            formulas = {}
            for row in sheet.findall(".//ns:sheetData/ns:row", ns):
                for c in row.findall("ns:c", ns):
                    r = c.attrib.get("r")
                    if not r:
                        continue
                    # inline string
                    is_ = c.find("ns:is", ns)
                    if is_ is not None:
                        texts = [t.text or "" for t in is_.findall(".//ns:t", ns)]
                        cells[r] = "".join(texts)
                    else:
                        v = c.find("ns:v", ns)
                        if v is not None:
                            val = v.text
                            if c.attrib.get("t") == "s":
                                try:
                                    val = shared[int(val)]
                                except Exception:
                                    pass
                            cells[r] = val
                    f = c.find("ns:f", ns)
                    if f is not None and (f.text or ""):
                        formulas[r] = f.text
            return cells, formulas

    cells, formulas = parse_xlsx(path)

    def col_to_num(col):
        n = 0
        for ch in col:
            n = n * 26 + (ord(ch) - 64)
        return n

    def num_to_col(n):
        s = ""
        while n > 0:
            n, r = divmod(n - 1, 26)
            s = chr(65 + r) + s
        return s

    def parse_cell_ref(ref):
        m = re.match(r"([A-Z]+)(\d+)", ref)
        if not m:
            return None, None
        return m.group(1), int(m.group(2))

    def to_float(v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).strip()
        if not s:
            return None
        s = s.replace('.', '').replace(',', '.')
        try:
            return float(s)
        except Exception:
            return None

    def get_value(cell, seen=None):
        if seen is None:
            seen = set()
        if cell in seen:
            return None
        seen.add(cell)

        if cell in cells:
            v = cells[cell]
            f = to_float(v)
            if f is not None:
                return f

        if cell in formulas:
            formula = formulas[cell]
            m = re.match(r"SUM\((.+)\)", formula.replace(" ", ""), re.I)
            if m:
                total = 0.0
                parts = m.group(1).split(',')
                for part in parts:
                    if ':' in part:
                        start, end = part.split(':')
                        sc, sr = parse_cell_ref(start)
                        ec, er = parse_cell_ref(end)
                        if not sc or not ec:
                            continue
                        for row in range(sr, er + 1):
                            for col in range(col_to_num(sc), col_to_num(ec) + 1):
                                ref = f"{num_to_col(col)}{row}"
                                val = get_value(ref, seen)
                                if val is not None:
                                    total += val
                    else:
                        val = get_value(part, seen)
                        if val is not None:
                            total += val
                return total
        return None

    def fmt(val):
        if val is None:
            val = 0.0
        try:
            return f"{float(val):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        except Exception:
            return str(val)

    def day_summary(day):
        if day == 1:
            date_cell = "B7"
            entradas = get_value("B20")
            pagamentos = get_value("B23")
            salao = get_value("B28")
            delivery = get_value("C40")
            vouchers = get_value("B60")
        else:
            date_cell = "B63"
            entradas = get_value("B76")
            pagamentos = get_value("B79")
            salao = get_value("B84")
            delivery = get_value("C96")
            vouchers = get_value("B116")

        date_val = cells.get(date_cell)
        # include day if any total > 0 or a date is provided
        if not date_val and all((v is None or v == 0) for v in [entradas, pagamentos, salao, delivery, vouchers]):
            return None

        title = f"Dia {day}" + (f" - {date_val}" if date_val else "")
        lines = [
            f"{title}",
            f"Total vendido por delivery: R$ {fmt(delivery)}",
            f"Total vendido no salão: R$ {fmt(salao)}",
            f"Total de pagamentos no dia: R$ {fmt(pagamentos)}",
            f"Total de entradas na conta: R$ {fmt(entradas)}",
            f"Total de saldo nos vouchers: R$ {fmt(vouchers)}",
        ]
        return lines

    lines = ["RESUMO ASANA"]
    d1 = day_summary(1)
    d2 = day_summary(2)
    if d1:
        lines.append(f"*{d1[0]}*")
        for item in d1[1:]:
            lines.append(f"• {item.replace(':', ':', 1)}")
    if d2:
        lines.append("")
        lines.append(f"*{d2[0]}*")
        for item in d2[1:]:
            lines.append(f"• {item.replace(':', ':', 1)}")

    msg = "\n".join(lines)
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
