# Automação 1+2 (Anexos + Triagem)

## Automação 1 — Coletar anexos do Gmail
- **Objetivo:** salvar todos os anexos recebidos em `/Users/guilhermesbot/clawd/anexos`
- **Fonte:** Gmail `pedidosbrgourmet@gmail.com`
- **Script:** `auto_collect.py`

**Rodar manualmente:**
```
python3 /Users/guilhermesbot/clawd/automation/auto_collect.py
```

## Automação 2 — Triagem da pasta /anexos
- **Quando:** toda vez que entrar um arquivo em `/Users/guilhermesbot/clawd/anexos`
- **Ação:** enviar no WhatsApp **apenas o assunto do e‑mail** + pergunta “pedido ou asana?”
- **Script:** `auto_triage.py`

**Rodar manualmente:**
```
python3 /Users/guilhermesbot/clawd/automation/auto_triage.py
```

## Definir decisão (pedido/asana)
Quando você responder no WhatsApp, o agente define a decisão e roda o triage novamente:
```
python3 /Users/guilhermesbot/clawd/automation/set_triage_decision.py pedido
python3 /Users/guilhermesbot/clawd/automation/auto_triage.py
```

## Arquivamento
- **Pedido:** move para `/Users/guilhermesbot/clawd/anexos/pedidos_arquivados`
- **Asana:** move para `/Users/guilhermesbot/clawd/anexos/Asana_(MÊS-ANO)`

## Pipeline de pedido (PDF)
O processamento de **pedido** usa o `run_pipeline.py` e gera:
- XLSX
- Totais por item via WhatsApp

**Atual:** todo e‑mail recebido em `pedidosbrgourmet@gmail.com` é tratado automaticamente como **PEDIDO** (sem pergunta de triagem).

## Observação importante (Asana)
O resumo “asana” precisa do mapeamento dos campos (delivery/salão/pagamentos/entradas/vouchers).
Assim que você confirmar o layout do arquivo, eu implemento o resumo.
