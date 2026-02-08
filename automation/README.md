# Automação Gmail → PDF → Planilha

## O que faz
- Lê e-mails com PDFs no Gmail `pedidosbrgourmet@gmail.com`
- Extrai dados do pedido do PDF
- Escreve na planilha: https://docs.google.com/spreadsheets/d/1tIEWGWLQl1Gy7XVtUPf-7YQ8Sg2tf3kQJJZ4g67PK-A

## Requisitos
- Python 3
- `pip install gspread google-auth pypdf pytesseract pdf2image`
- `brew install tesseract poppler tesseract-lang`
- Chave service account: `/Users/guilhermesbot/clawd/keys/gsheets.json`
- Gmail autenticado via `gog`

## Como rodar manualmente
```
python3 /Users/guilhermesbot/clawd/automation/run_pipeline.py
```

## Como rodar automaticamente (LaunchAgent)
```
launchctl load ~/Library/LaunchAgents/com.clawd.gmail-pdf.plist
launchctl start com.clawd.gmail-pdf
```

## Logs
- `~/Library/Logs/clawd-gmail-pdf.log`

## Notificação WhatsApp
Ao incluir pedidos, envia automaticamente:
"Foram incluídos X no google sheets"
para +5511999713995 e +5511971514265.

## Migração para Mac Mini
Copie a pasta `/Users/guilhermesbot/clawd/automation` e as chaves:
- `/Users/guilhermesbot/clawd/keys/gsheets.json`
- `~/.config/gog/` (ou o diretório onde o `gog` salva as credenciais)

Depois instale dependências e ative o LaunchAgent.
