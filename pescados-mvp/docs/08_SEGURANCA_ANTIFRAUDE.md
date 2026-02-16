# Segurança e antifraude (recomendado)

Este MVP já usa RLS e tokens do Supabase, mas para reduzir risco de chargeback/golpe:

## Regras recomendadas

1) Exigir **verificação de e-mail** no Supabase Auth (configuração do projeto)
2) Para B2B (CNPJ):
   - exigir preenchimento de CNPJ + razão social
   - validar formato
   - opcional: validação em API externa (Receita / Serpro / etc.)
3) Limites
   - limite de valor por pedido no início
   - bloquear se muitas tentativas de pagamento falhadas
4) Device/IP logging (futuro)
5) Fluxo de “conta suspeita”
   - bloquear compra e solicitar documentação
6) Reserva de risco
   - aplicar reserva para novos compradores/fornecedores
   - ajustar % conforme histórico

## Observação legal

- Inclua nos Termos que o usuário declara ser titular dos dados fornecidos (CPF/CNPJ).
- Tenha canal de suporte para contestação.
