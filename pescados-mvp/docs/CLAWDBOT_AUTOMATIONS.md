# Tarefas que o Clawdbot pode automatizar

Abaixo, ideias de automação (scripts/CLI) que podem ser executadas com um robô/agent:

## Setup do repositório

- [ ] Criar `.env` a partir de `.env.example` e validar campos obrigatórios
- [ ] Rodar linter/format (se configurado)
- [ ] Subir API em ambiente de staging (Render/Fly) via CLI
- [ ] Subir portal no Vercel via CLI
- [ ] Gerar builds EAS (Android/iOS) e anexar artifacts

## Banco (Supabase)

- [ ] Aplicar SQL via CLI (se você usar `supabase` CLI localmente)
- [ ] Criar buckets e policies de Storage via scripts

## Stripe

- [ ] Criar webhook via Stripe CLI (staging)
- [ ] Validar variáveis de ambiente e conectividade do webhook

## Rotinas

- [ ] Configurar cron/job (reserve release) em provedor que suporte API calls
- [ ] Rodar smoke tests end-to-end (pedido + pagamento sandbox)

> Limitação: automação não consegue concluir KYC/Apple Developer/Google Play por você.
