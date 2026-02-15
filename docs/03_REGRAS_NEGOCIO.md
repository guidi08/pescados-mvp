# Regras de negócio (MVP)

## Canais

- **B2B**: comprador tem CNPJ (campo `profiles.cnpj` preenchido)
- **B2C**: comprador sem CNPJ (CPF / pessoa física)

### Regra: B2C por fornecedor

- Se comprador for B2C, o fornecedor precisa ter `sellers.b2c_enabled = true`.
- Se comprador for B2B, pode comprar mesmo se B2C desabilitado.

## Cut-off e entrega

- `sellers.cutoff_time` define o horário limite (ex.: 18:00).
- Pedido feito **até** o cut-off → entrega **D+1**
- Pedido feito **após** o cut-off → entrega **D+2**

## Frete

MVP:
- `sellers.shipping_fee_cents` é **fixo** (ou 0).
- Aplica para B2B e B2C.

## Pedido mínimo

- `sellers.min_order_cents`
- Valida em cima do **subtotal** (sem frete)

## Frescos x Congelados

- `products.fresh = true` indica item fresco
- `products.min_expiry_date`/`variants.min_expiry_date` guarda validade mínima (lote)

## Cancelamento

- Se pedido contém **qualquer** item fresco → **não permite cancelamento**.
- Se pedido é 100% congelado:
  - pode cancelar até **6 horas antes do cut-off** da véspera da entrega.

## Peso variável por caixa (salmão)

Use `pricing_mode = per_kg_box` quando:

- o comprador compra por **caixa**
- o preço é por **kg**
- o peso real da caixa pode variar (ex.: ±10%)

No pedido:
- Calcula-se o valor por **peso estimado**
- Depois do pedido, o fornecedor informa o peso real
- Sistema lança crédito/débito na carteira do comprador (apenas B2B no MVP)

## Taxas

- Comissão: **5%** do subtotal
- Taxa de processamento: **3,99%** do total (subtotal + frete)
- Reserva de risco: % configurável do subtotal, por 60 dias
