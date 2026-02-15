# Pagamentos (Stripe + Connect)

## Modelo escolhido (clean)

- O comprador paga no app (cartão/wallet ou Pix).
- O fornecedor recebe automaticamente via **Stripe Connect**.
- A plataforma recebe apenas:
  - **5% comissão**
  - **3,99% taxa de processamento** (para cobrir adquirência)
- A plataforma **não repassa taxa fixa por transação** no MVP.

Na prática, a cobrança é feita como **Destination Charge** com:
- `application_fee_amount` = (5% + 3,99%)
- `transfer_data.destination` = conta do fornecedor
- `transfer_data.amount` = GMV – taxas – reserva (se houver)

## Por que isso é bom

- Não exige controle manual de repasses.
- Não precisa “operar o caixa do fornecedor” no dia a dia.
- Diminui risco operacional e contábil.
- Facilita M&A (o produto fica mais “limpo” para due diligence).

## Reserva de risco (60 dias)

- Configurável por fornecedor (ex.: 10% do subtotal)
- Retida no momento do pagamento (fica no saldo da plataforma)
- É liberada por job depois do prazo

## Endpoints no MVP

- `POST /payments/stripe/payment-sheet` → cria PaymentIntent (card + wallets)
- `POST /payments/stripe/pix` → cria PaymentIntent Pix + retorna QR
- `POST /webhooks/stripe` → confirma pagamento e marca pedido como pago

## Observações importantes

1) Pix pode depender de habilitação na conta do Stripe (e/ou disponibilidade regional).  
2) Prazos de recebimento dependem do meio de pagamento (ex.: crédito costuma ser D+30 no Brasil).  
3) Cancelamentos/refunds: para marketplace, o refund precisa reverter transfer e application fee.

No MVP, congelados podem cancelar dentro da janela, e o backend chama refund com:
- `reverse_transfer: true`
- `refund_application_fee: true`
