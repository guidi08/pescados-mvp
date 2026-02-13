#!/usr/bin/env python3
import json
import os
import re
import subprocess
from datetime import datetime

from pypdf import PdfReader
from pdf2image import convert_from_path
import pytesseract

# ensure tesseract path for OCR
pytesseract.pytesseract.tesseract_cmd = "/opt/homebrew/bin/tesseract"

ACCOUNT = "pedidosbrgourmet@gmail.com"
OAUTH_CLIENT = "pedidos"
# NOTE: Sheets write disabled per request; email-only flow.
# All incoming emails are treated as PEDIDO (auto flow).
AUTO_DECISION = "pedido"
OUT_DIR = "/Users/guilhermesbot/clawd/pedidos via e-mail"
STATE_PATH = "/Users/guilhermesbot/clawd/automation/state.json"
CONFIG_PATH = "/Users/guilhermesbot/.clawdbot/clawdbot.json"

ATTACH_PATH = os.getenv("ATTACH_PATH", "").strip()
ATTACH_SUBJECT = os.getenv("ATTACH_SUBJECT", "").strip()

WHATSAPP_PROMPT_TO = "+5511999713995"

EMAIL_RECIPIENTS = ["guilherme@brgourmet.com.br", "marcelo@brgourmet.com.br"]

PASTEL_COLORS = [
    "#F5E3E3",
    "#E3F5E5",
    "#E3ECF5",
    "#F2EBD9",
    "#EEE6F5",
]

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)


def sh(cmd):
    # ensure PATH for brew-installed binaries
    env = os.environ.copy()
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    return subprocess.check_output(cmd, shell=True, text=True, env=env)


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    return {"processed_message_ids": [], "doubt_notified": False, "pending": None}


def save_state(state):
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)


def load_whatsapp_allowlist():
    try:
        with open(CONFIG_PATH, "r") as f:
            cfg = json.load(f)
        allow = cfg.get("channels", {}).get("whatsapp", {}).get("allowFrom", [])
        return allow if isinstance(allow, list) else []
    except Exception:
        return []


def whatsapp_allowed(number: str) -> bool:
    allow = load_whatsapp_allowlist()
    if "*" in allow:
        return True
    return number in allow


def ocr_pdf(path):
    # ensure poppler is found
    images = convert_from_path(path, dpi=300, poppler_path="/opt/homebrew/bin")
    texts = []
    for img in images:
        texts.append(pytesseract.image_to_string(img, lang="por"))
    return "\n".join(texts)


def extract_body_text(msg):
    # try top-level body
    body = msg.get("body") or ""
    if body.strip():
        return body

    # try payload parts (text/plain or text/html)
    try:
        parts = msg.get("message", {}).get("payload", {}).get("parts", [])
        texts = []
        for p in parts:
            mime = p.get("mimeType", "")
            if mime in ("text/plain", "text/html"):
                data = p.get("body", {}).get("data")
                if data:
                    import base64
                    decoded = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="ignore")
                    texts.append(decoded)
            # nested parts
            for sp in p.get("parts", []) if isinstance(p.get("parts", []), list) else []:
                mime = sp.get("mimeType", "")
                if mime in ("text/plain", "text/html"):
                    data = sp.get("body", {}).get("data")
                    if data:
                        import base64
                        decoded = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="ignore")
                        texts.append(decoded)
        return "\n".join(texts)
    except Exception:
        return ""


def normalize_product(name: str) -> str:
    if not name:
        return ""
    n = name.upper()
    n = re.sub(r"^ARECEBER\s+", "", n)
    if "SALM" in n or "ALMAO" in n:
        return "SALMAO"
    if "MERL" in n:
        return "MERLUZA"
    if "TILAPIA" in n or "SAINT PETER" in n or "SAINT" in n:
        return "SAINT PETER"
    if "CACAO" in n:
        return "CACAO"
    if "POLVO" in n:
        return "POLVO"
    if "MOLUSCO" in n:
        return "MOLUSCO"
    if "KANI" in n:
        return "KANI KAMA"
    if "ATUM" in n:
        return "ATUM"
    if "PREGO" in n:
        return "PREGO"
    if "LULA" in n:
        return "LULA"
    if "CAMAR" in n:
        return "CAMARAO"
    return name.strip()


def parse_text_order(text):
    # Reuse the same parsing logic as PDF, just without file-based defaults
    # capture order number if present (SONDA)
    m_order = re.search(r"Número Pedido:\s*(\d+)", text)
    order_no_global = m_order.group(1) if m_order else ""

    # St Marche / Pedidos Bom Peixe table in email body
    upper = text.upper()
    if "PEDIDOS BOM PEIXE" in upper and "CNPJ" in upper and "LOJA" in upper:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        # find date line (dd.mm.yyyy)
        date_idx = None
        for i, l in enumerate(lines):
            if re.search(r"\b\d{2}\.\d{2}\.\d{4}\b", l):
                date_idx = i
                break
        if date_idx is not None:
            rows = []
            i = date_idx + 1
            while i + 5 < len(lines):
                # stop at signature
                if lines[i].lower().startswith("ana caroline") or lines[i].lower().startswith("opera"):
                    break
                centro = lines[i]
                loja = lines[i + 1]
                cnpj = lines[i + 2]
                pedido = lines[i + 3]
                produto = lines[i + 4]
                qty = lines[i + 5]
                # basic validation: center code like H111/S303 and CNPJ pattern
                if re.search(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}", cnpj):
                    rows.append({
                        "filial": f"{cnpj} {loja}",
                        "product": normalize_product(produto),
                        "code": centro,
                        "qty": qty,
                        "price": "",
                        "order": pedido,
                        "source": "BOM_PEIXE",
                    })
                i += 6
            if rows:
                return rows

    # MAMBO
    m_rows = []
    block_pattern = re.compile(
        r"Empresa\s+(\d+)\s+([^\n]+?)\s+Local.*?Pedido\s+(\d+).*?(?=Empresa\s+\d+|\Z)",
        re.S,
    )

    def to_float(s):
        return float(s.replace('.', '').replace(',', '.'))

    for b in block_pattern.finditer(text):
        empresa = b.group(1)
        nome = b.group(2).strip()
        pedido = b.group(3)
        block = b.group(0)

        # main salmon line (KG)
        m_main = re.search(
            r"Areceber\s+(\d+)\s*([A-Z].*?)\s+KG\s+1,000\s+([\d.,]+)\s+([\d.,]+)",
            block,
            re.S,
        )
        main_code = None
        if m_main:
            prod_desc = normalize_product(m_main.group(2).strip())
            qty = m_main.group(3)
            total = m_main.group(4)
            qty_f = to_float(qty)
            total_f = to_float(total)
            unit = total_f / qty_f if qty_f else 0
            unit_str = f"{unit:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')

            code = "4103" if ("ALMAO" in prod_desc or "SALM" in prod_desc) else m_main.group(1)
            main_code = m_main.group(1)

            m_rows.append({
                "filial": f"MAMBO Empresa {empresa} {nome}",
                "product": prod_desc or "",
                "code": code or "",
                "qty": qty or "",
                "price": unit_str or "",
                "order": pedido or "",
            })

        # additional KG items (e.g., SALMAO lines without 'Areceber')
        for m_kg in re.finditer(
            r"(\d{5,6})\s*([A-Z].*?)\s+KG\s+1,000\s+([\d.,]+)\s+([\d.,]+)",
            block,
            re.S,
        ):
            item_code = m_kg.group(1)
            if main_code and item_code == main_code:
                continue
            prod_desc = normalize_product(m_kg.group(2).strip())
            qty = m_kg.group(3)
            total = m_kg.group(4)
            qty_f = to_float(qty)
            total_f = to_float(total)
            unit = total_f / qty_f if qty_f else 0
            unit_str = f"{unit:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            code = "4103" if ("ALMAO" in prod_desc or "SALM" in prod_desc) else item_code

            m_rows.append({
                "filial": f"MAMBO Empresa {empresa} {nome}",
                "product": prod_desc or "",
                "code": code or "",
                "qty": qty or "",
                "price": unit_str or "",
                "order": pedido or "",
            })

        # additional items (CX)
        for m_item in re.finditer(
            r"(\d{5,6})\s*([A-Z].*?)\s+CX\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)",
            block,
            re.S,
        ):
            item_code = m_item.group(1)
            raw_desc = normalize_product(m_item.group(2).strip())
            # cut off any trailing boilerplate from OCR
            raw_desc = re.split(r"\b(EMISSAO|RECEBTO|TIPO|PRAZO|FRETE|PEDIDO|FORNECEDOR)\b", raw_desc)[0].strip()
            qty = m_item.group(4)
            price = m_item.group(5)

            # normalize known MAMBO items
            if "PIRARUCU" in raw_desc:
                desc = "PIRARUCU"
            elif "SALMAO" in raw_desc and "C/P" in raw_desc:
                desc = "FILE SALMAO C/P BOM PEIXE CONG 300G"
            elif item_code == "247873":
                desc = "PIRARUCU"
            elif item_code == "247924":
                desc = "FILE SALMAO C/P BOM PEIXE CONG 300G"
            else:
                desc = raw_desc

            m_rows.append({
                "filial": f"MAMBO Empresa {empresa} {nome}",
                "product": desc or "",
                "code": item_code or "",
                "qty": qty or "",
                "price": price or "",
                "order": pedido or "",
            })

    if m_rows:
        return m_rows

    # SONDA
    m = re.search(r"Número Pedido:\s*(\d+)", text)
    order_no = m.group(1) if m else ""

    m = re.search(r"F(?:ilial|ifial):\s*(\d+)\s+([^\n]+)", text)
    if m:
        name = m.group(2).strip()
        name = re.sub(r"\s*Data criação pedido:.*$", "", name).strip()
        filial = f"SONDA Filial {m.group(1)} {name}"
    else:
        filial = "SONDA"

    items = []
    for line in text.splitlines():
        m = re.search(r"^\s*(\d+)\s+\d+\s+(.*?)\s+\d{3}\.\d{2}\.\d{2}\s+KG-1\.000\s+([\d.,]+)\s+([\d.,]+)", line)
        if not m:
            continue
        item_code = m.group(1)
        desc = normalize_product(m.group(2).strip())
        qty = m.group(3)
        price = m.group(4)

        if "SALM" in desc:
            code = "4103"
        elif "TILAPIA" in desc:
            code = "1159"
        else:
            code = item_code or ""
            if not code:
                try:
                    q = f"Dúvida no pedido {order_no}: não identifiquei código para item '{desc}'. Pode confirmar?"
                    sh(f"clawdbot message send --channel whatsapp --target +5511999713995 --message \"{q}\"")
                except Exception:
                    pass

        items.append({
            "filial": filial,
            "product": desc or "",
            "code": code,
            "qty": qty or "",
            "price": price or "",
            "order": order_no,
        })

    if items:
        return items

    # Texto livre (sem PDF) -> fallback
    items = []
    text_lines = [l.strip() for l in text.splitlines() if l.strip()]
    lower = text.lower()

    # detectar filial para pedidos sem PDF
    filial = ""
    if "momo" in lower:
        filial = "MOMO"
        # tenta pegar bairro/loja (somente letras)
        m_loc = re.search(r"momo\s+([a-z\s]+)", lower)
        if m_loc:
            loc = m_loc.group(1).strip()
            if loc and not re.match(r"^\d", loc):
                filial = f"MOMO {loc}".title()

    def is_valid_line(line):
        l = line.lower().strip()
        if any(x in l for x in [
            "sent from my iphone",
            "begin forwarded message",
            "from:", "date:", "to:", "subject:",
            "mandar pedido", "pedido momo",
            "fornecedor", "vendedor", "telefone", "celular", "fax",
        ]):
            return False
        # require a clear quantity marker
        has_cx = re.search(r"\d+\s*(cx|cxs|caixa|caixas)", l)
        has_kg = re.search(r"\bkg\b", l)
        if not (has_cx or has_kg):
            return False
        # must include a fish keyword
        if any(x in l for x in ["salm", "polvo", "camar", "lula", "merluza", "peixe", "tilapia", "tilápia", "atum", "prego", "pirarucu"]):
            return True
        return False

    for line in text_lines:
        if not is_valid_line(line):
            continue

        # try to parse long Sonda item lines, e.g.
        # "6420 1000032302 TENTACULOS POLVO ... CX-12.000 2,000 331,20 331,20"
        m_long = re.search(r"^(\d{3,5})\s+\d+\s+(.+?)\s+\d{3}\.\d{2}\.\d{2}.*?\b(?:CX|KG)[-\s]?\d+[\.,]\d+\s+(\d+[\.,]\d+)\s+(\d+[\.,]\d+)", line, re.IGNORECASE)
        if not m_long:
            m_long = re.search(r"^(\d{3,5})\s+\d+\s+(.+?)\s+.*?\b(?:CX|KG)[-\s]?\d+[\.,]\d+\s+(\d+[\.,]\d+)\s+(\d+[\.,]\d+)", line, re.IGNORECASE)
        if m_long:
            code = m_long.group(1)
            desc = normalize_product(m_long.group(2).strip())
            qty = m_long.group(3)
            price = m_long.group(4)
            items.append({
                "filial": filial or "SONDA",
                "product": desc,
                "code": code,
                "qty": qty,
                "price": price,
                "order": order_no_global,
            })
            continue

        # detect quantidade (ex: 2cx / 2 caixas)
        m_qty = re.search(r"(\d+)\s*(cx|cxs|caixa|caixas)", line, re.IGNORECASE)
        qty_raw = m_qty.group(1) if m_qty else ""
        qty = ""
        if qty_raw:
            # se for salmão, converte caixa -> kg (30kg)
            if "salm" in line.lower():
                qty = str(int(qty_raw) * 30)
            else:
                qty = f"{qty_raw}cx"

        if "salm" in line.lower():
            desc = "SALMAO"
            # map size
            code = ""
            size = re.search(r"(6\s*/\s*8|8\s*/\s*10|10\s*/\s*12|12\s*/\s*14|14\s*/\s*16|16\s*/\s*18|18\s*/\s*20)", line.replace("//", "/"))
            if size:
                sz = size.group(1).replace(" ", "")
                if sz == "6/8": code = "4102"
                elif sz == "8/10": code = "4103"
                elif sz == "10/12": code = "4104"
                elif sz == "12/14": code = "4105"
                elif sz == "14/16": code = "4106"
                elif sz == "16/18": code = "4107"
                elif sz == "18/20": code = "4108"
            items.append({
                "filial": filial,
                "product": desc,
                "code": code,
                "qty": qty,
                "price": "",
                "order": "",
            })
        else:
            # item desconhecido: usar o nome do item do texto
            items.append({
                "filial": filial,
                "product": normalize_product(line.strip()),
                "code": "",
                "qty": qty,
                "price": "",
                "order": "",
            })

    return items


def parse_pdf(path):
    text = "\n".join([p.extract_text() or "" for p in PdfReader(path).pages])
    if not text.strip():
        text = ocr_pdf(path)

    return parse_text_order(text)


def main():
    # If ATTACH_PATH is provided, process a single local file as a pedido
    if ATTACH_PATH:
        try:
            parsed = []
            ext = os.path.splitext(ATTACH_PATH)[1].lower()
            if ext == ".pdf":
                parsed = parse_pdf(ATTACH_PATH)
            else:
                # unsupported for parsing
                parsed = []

            if not parsed:
                try:
                    sh(
                        f"clawdbot message send --channel whatsapp --target +5511999713995 "
                        f"--message \"Não consegui extrair itens do arquivo {os.path.basename(ATTACH_PATH)}.\""
                    )
                except Exception:
                    pass
                return

            rows_to_write = parsed

            # Build XLSX with the same data (no Sheets write)
            try:
                import xlsxwriter
            except Exception:
                raise RuntimeError("xlsxwriter not installed. Run: python3 -m pip install xlsxwriter")

            tmp_dir = "/Users/guilhermesbot/clawd/tmp"
            os.makedirs(tmp_dir, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d")

            def infer_rede(rows):
                names = set()
                for r in rows:
                    f = (r.get("filial") or "").upper()
                    if "MAMBO" in f: names.add("MAMBO")
                    if "SONDA" in f: names.add("SONDA")
                    if "MOMO" in f: names.add("MOMO")
                if len(names) == 1:
                    return list(names)[0]
                if len(names) == 0:
                    return "PEDIDOS"
                return "MISTO"

            rede = infer_rede(rows_to_write)
            xlsx_path = os.path.join(tmp_dir, f"{rede}_{ts}.xlsx")

            workbook = xlsxwriter.Workbook(xlsx_path)
            ws = workbook.add_worksheet("Pedidos")
            headers = [
                "PEDIDO",
                "CLIENTE/CNPJ",
                "PRODUTO",
                "CODIGO",
                "QUANTIDADE",
                "VALOR",
                "VR TOTAL",
                "OBSERVAÇÕES",
                "CONTATO",
            ]
            for c, h in enumerate(headers):
                ws.write(0, c, h)

            def to_float(s):
                if s is None:
                    return None
                if isinstance(s, (int, float)):
                    return float(s)
                s = str(s).strip()
                if not s:
                    return None
                s = s.replace('.', '').replace(',', '.')
                try:
                    return float(s)
                except Exception:
                    return None

            def fmt_comma(n):
                if n is None or n == "":
                    return ""
                try:
                    return f"{float(n):,.3f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                except Exception:
                    return str(n)

            formats = [workbook.add_format({"bg_color": c}) for c in PASTEL_COLORS]
            color_idx = 0
            last_filial = None

            row = 1
            for r in rows_to_write:
                qty_f = to_float(r["qty"])
                price_f = to_float(r["price"])
                total = qty_f * price_f if (qty_f is not None and price_f is not None) else None

                filial = r["filial"] or "SONDA"
                if last_filial is None or filial != last_filial:
                    color_idx = (color_idx + 1) % len(formats)
                    last_filial = filial
                fmt = formats[color_idx]

                ws.write(row, 0, "", fmt)
                ws.write(row, 1, filial, fmt)
                ws.write(row, 2, r["product"], fmt)
                ws.write(row, 3, r["code"], fmt)
                ws.write(row, 4, fmt_comma(qty_f) if qty_f is not None else r["qty"], fmt)
                ws.write(row, 5, fmt_comma(price_f) if price_f is not None else r["price"], fmt)
                ws.write(row, 6, fmt_comma(total), fmt)
                ws.write(row, 7, r["order"], fmt)
                ws.write(row, 8, "", fmt)
                row += 1
            workbook.close()

            # WhatsApp: send XLSX + totals by item
            try:
                sh(f"clawdbot message send --channel whatsapp --target +5511999713995 --media \"{xlsx_path}\" --message \"Arquivo XLSX do pedido\"")

                def qty_to_float(q):
                    if q is None:
                        return None
                    if isinstance(q, (int, float)):
                        return float(q)
                    s = str(q)
                    m = re.search(r"\d+[\.,]?\d*", s)
                    if not m:
                        return None
                    return to_float(m.group(0))

                totals = {}
                for r in rows_to_write:
                    qty = qty_to_float(r["qty"])
                    if qty is None:
                        continue
                    name = normalize_product(r["product"])
                    totals[name] = totals.get(name, 0) + qty

                if totals:
                    lines = ["Totais por item:"]
                    grand_total = 0
                    for name, total in sorted(totals.items()):
                        lines.append(f"{name} - {fmt_comma(total)}")
                        try:
                            grand_total += float(total)
                        except Exception:
                            pass
                    lines.append(f"TOTAL GERAL - {fmt_comma(grand_total)}")
                    msg = "\n".join(lines)
                    sh(f"clawdbot message send --channel whatsapp --target +5511999713995 --message \"{msg}\"")
            except Exception:
                pass

        except Exception:
            pass
        return

    state = load_state()
    processed = set(state.get("processed_message_ids", []))
    sent_doubt = False
    doubt_locked = bool(state.get("doubt_notified", False))

    # Auto-flow: clear any pending state and treat all emails as PEDIDO
    if state.get("pending"):
        state["pending"] = None
        save_state(state)

    # find recent messages with PDF attachments
    msg_json = sh(f"gog gmail messages search \"in:inbox newer_than:7d\" --account {ACCOUNT} --client {OAUTH_CLIENT} --max 10 --json")
    msg = json.loads(msg_json)
    messages = msg.get("messages", [])

    # optional: only process a specific message id (for controlled tests)
    test_id = os.getenv("GMAIL_TEST_ID", "").strip()
    if test_id:
        messages = [{"id": test_id}]
        processed = set()

    # optional: only process the most recent email (for controlled tests)
    if os.getenv("GMAIL_TEST_LAST", "").lower() in ("1", "true", "yes") and not test_id:
        messages = messages[:1]
        # allow processing even if previously marked
        processed = set()

    rows_to_write = []
    for m in messages:
        mid = m.get("id")
        if not mid or mid in processed:
            continue
        # get message and download all PDF attachments
        full = json.loads(sh(f"gog gmail get {mid} --account {ACCOUNT} --client {OAUTH_CLIENT} --format full --json"))

        attachments = [a for a in full.get("attachments", []) if a.get("mimeType") == "application/pdf"]

        if attachments:
            for att in attachments:
                filename = att.get("filename")
                att_id = att.get("attachmentId")
                out_path = os.path.join(OUT_DIR, filename)
                sh(f"gog gmail attachment {mid} {att_id} --account {ACCOUNT} --client {OAUTH_CLIENT} --out \"{out_path}\"")
                parsed = parse_pdf(out_path)
                if not parsed:
                    try:
                        q = f"Dúvida no pedido (email {mid}): não consegui identificar itens para preencher. Pode orientar?"
                        if not doubt_locked and not sent_doubt:
                            sh(f"clawdbot message send --channel whatsapp --target +5511999713995 --message \"{q}\"")
                            sent_doubt = True
                            state["doubt_notified"] = True
                    except Exception:
                        pass
                rows_to_write.extend(parsed)
        else:
            # no PDF: try body text
            body = extract_body_text(full)
            if body.strip():
                parsed = parse_text_order(body)
                if not parsed:
                    try:
                        q = f"Dúvida no pedido (email {mid}): sem PDF. Corpo não bate com padrão. Pode orientar?"
                        if not doubt_locked and not sent_doubt:
                            sh(f"clawdbot message send --channel whatsapp --target +5511999713995 --message \"{q}\"")
                            sent_doubt = True
                            state["doubt_notified"] = True
                    except Exception:
                        pass
                rows_to_write.extend(parsed)
            else:
                try:
                    q = f"Dúvida no pedido (email {mid}): sem PDF e sem corpo útil. Pode orientar?"
                    if not doubt_locked and not sent_doubt:
                        sh(f"clawdbot message send --channel whatsapp --target +5511999713995 --message \"{q}\"")
                        sent_doubt = True
                        state["doubt_notified"] = True
                except Exception:
                    pass

        processed.add(mid)
        if sent_doubt:
            break

    if not rows_to_write:
        return

    def to_number(val):
        if isinstance(val, str):
            v = val.strip()
            # numeric with comma or dot
            if re.fullmatch(r"\d+[\.,]?\d*", v):
                v = v.replace('.', '').replace(',', '.')
                try:
                    return float(v)
                except Exception:
                    return val
        return val

    # Build XLSX with the same data (no Sheets write)
    try:
        import xlsxwriter
    except Exception:
        raise RuntimeError("xlsxwriter not installed. Run: python3 -m pip install xlsxwriter")

    tmp_dir = "/Users/guilhermesbot/clawd/tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d")
    # infer network name from rows
    def infer_rede(rows):
        names = set()
        for r in rows:
            f = (r.get("filial") or "").upper()
            if "MAMBO" in f: names.add("MAMBO")
            if "SONDA" in f: names.add("SONDA")
            if "MOMO" in f: names.add("MOMO")
        if len(names) == 1:
            return list(names)[0]
        if len(names) == 0:
            return "PEDIDOS"
        return "MISTO"

    rede = infer_rede(rows_to_write)
    xlsx_path = os.path.join(tmp_dir, f"{rede}_{ts}.xlsx")

    workbook = xlsxwriter.Workbook(xlsx_path)
    ws = workbook.add_worksheet("Pedidos")
    is_bom_peixe = any(r.get("source") == "BOM_PEIXE" for r in rows_to_write)
    headers = [
        "PEDIDO",
        "CNPJ + LOJA" if is_bom_peixe else "CLIENTE/CNPJ",
        "PRODUTO",
        "CODIGO",
        "QUANTIDADE",
        "VALOR",
        "VR TOTAL",
        "PEDIDOS BOM PEIXE" if is_bom_peixe else "OBSERVAÇÕES",
        "CONTATO",
    ]
    for c, h in enumerate(headers):
        ws.write(0, c, h)

    def to_float(s):
        if s is None:
            return None
        if isinstance(s, (int, float)):
            return float(s)
        s = str(s).strip()
        if not s:
            return None
        s = s.replace('.', '').replace(',', '.')
        try:
            return float(s)
        except Exception:
            return None

    def fmt_comma(n):
        if n is None or n == "":
            return ""
        try:
            return f"{float(n):,.3f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        except Exception:
            return str(n)

    # prepare pastel formats
    formats = [workbook.add_format({"bg_color": c}) for c in PASTEL_COLORS]
    color_idx = 0
    last_filial = None

    row = 1
    for r in rows_to_write:
        qty_f = to_float(r["qty"])
        price_f = to_float(r["price"])
        total = qty_f * price_f if (qty_f is not None and price_f is not None) else None

        filial = r["filial"] or "SONDA"
        if last_filial is None or filial != last_filial:
            color_idx = (color_idx + 1) % len(formats)
            last_filial = filial
        fmt = formats[color_idx]

        ws.write(row, 0, "", fmt)  # PEDIDO (sempre vazio)
        ws.write(row, 1, filial, fmt)  # CLIENTE/CNPJ
        ws.write(row, 2, r["product"], fmt)  # PRODUTO
        ws.write(row, 3, r["code"], fmt)  # CODIGO
        ws.write(row, 4, fmt_comma(qty_f) if qty_f is not None else r["qty"], fmt)  # QUANTIDADE
        ws.write(row, 5, fmt_comma(price_f) if price_f is not None else r["price"], fmt)  # VALOR
        ws.write(row, 6, fmt_comma(total), fmt)  # VR TOTAL
        ws.write(row, 7, r["order"], fmt)  # OBSERVAÇÕES
        ws.write(row, 8, "", fmt)  # CONTATO (sempre vazio)
        row += 1
    workbook.close()

    # email summary with XLSX attachment
    try:
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        subject = f"Pedido recebido - {now}"
        body = "Segue o XLSX em anexo."
        for rcpt in EMAIL_RECIPIENTS:
            sh(f"gog gmail send --to {rcpt} --subject \"{subject}\" --body \"{body}\" --attach \"{xlsx_path}\" --account {ACCOUNT} --client {OAUTH_CLIENT}")
    except Exception:
        pass

    # WhatsApp: send XLSX + totals by item
    try:
        # send file
        sh(f"clawdbot message send --channel whatsapp --target +5511999713995 --media \"{xlsx_path}\" --message \"Arquivo XLSX do pedido\"")

        # totals by item
        def qty_to_float(q):
            if q is None:
                return None
            if isinstance(q, (int, float)):
                return float(q)
            s = str(q)
            m = re.search(r"\d+[\.,]?\d*", s)
            if not m:
                return None
            return to_float(m.group(0))

        totals = {}
        for r in rows_to_write:
            qty = qty_to_float(r["qty"])
            if qty is None:
                continue
            name = normalize_product(r["product"])
            totals[name] = totals.get(name, 0) + qty

        if totals:
            lines = ["Totais por item:"]
            grand_total = 0
            for name, total in sorted(totals.items()):
                lines.append(f"{name} - {fmt_comma(total)}")
                try:
                    grand_total += float(total)
                except Exception:
                    pass
            lines.append(f"TOTAL GERAL - {fmt_comma(grand_total)}")
            msg = "\n".join(lines)
            sh(f"clawdbot message send --channel whatsapp --target +5511999713995 --message \"{msg}\"")
    except Exception:
        pass

    state["processed_message_ids"] = sorted(list(processed))
    save_state(state)


if __name__ == "__main__":
    main()
