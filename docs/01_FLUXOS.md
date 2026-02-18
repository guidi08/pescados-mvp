# Fluxos (MVP)

## 1) Fluxo do comprador (B2C / CPF)

1. Login por e-mail/senha (Supabase Auth)
2. Home: lista fornecedores ativos
3. Escolhe fornecedor → lista produtos em tempo real
4. Produto → seleciona variante (calibre) → adiciona ao carrinho
5. Carrinho (1 fornecedor por vez)
6. Checkout → cria pedido → escolhe:
   - Cartão / Apple Pay / Google Pay (PaymentSheet)
   - Pix (QR)
7. Pagamento aprovado → pedido muda para **paid** → fornecedor recebe e-mail

**Regras específicas**
- Só compra em fornecedores com `sellers.b2c_enabled = true`
- Cancelamento: somente congelados e dentro da janela

---

## 2) Fluxo do comprador (B2B / CNPJ)

Igual ao B2C, com diferenças:

- B2C não precisa estar habilitado (B2B é sempre permitido)
- Produtos por caixa/peso variável podem gerar **ajuste em carteira** após peso real/NF

### Ajuste por peso real (salmão por caixa)

- No pedido, o app calcula total **estimado**:
  - preço por kg × peso estimado por caixa × quantidade de caixas
- Depois da separação/expedição, o fornecedor informa o peso real
- O sistema calcula diferença (real – estimado) e lança:
  - **débito** no saldo do comprador (se real > estimado)
  - **crédito** no saldo do comprador (se real < estimado)

Para MVP:
- A carteira é um **ledger** (saldo) para ser liquidado operacionalmente.
- Regra recomendada: bloquear novos pedidos quando saldo < 0.

---

## 3) Fluxo do fornecedor

1. Login no portal (Supabase Auth)
2. Configurações:
   - e-mail de pedidos
   - cut-off
   - frete fixo
   - pedido mínimo
   - habilitar B2C (se tiver logística)
   - (opcional) reserva de risco (%) [retida pela plataforma]
   - dias de entrega (seg…dom)
3. Conecta recebimentos no Stripe (Connect Express)
4. Cadastra produtos e variantes:
   - fresco/congelado, validade mínima
   - modo de precificação (unidade ou kg por caixa)
5. Recebe pedido:
   - e-mail com itens + endereço + observações
6. (Se houver peso variável) lança peso real no portal

---

## 4) Reserva de risco (60 dias)

Quando configurada (`sellers.risk_reserve_bps > 0`):

- No pagamento, parte do valor fica **retida pela plataforma**
- A reserva não é repassada automaticamente ao fornecedor (é da plataforma)
