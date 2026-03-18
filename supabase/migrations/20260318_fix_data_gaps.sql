-- 1. Add delivery_days column
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS delivery_days integer[] DEFAULT ARRAY[1,2,3,4,5];

-- 2. Set delivery_days for all existing sellers (Mon-Fri = 1-5)
UPDATE sellers SET delivery_days = ARRAY[1,2,3,4,5] WHERE delivery_days IS NULL;

-- 3. Fix seller data: MONTOZA PESCADOS
UPDATE sellers SET 
  city = 'São Paulo',
  state = 'SP',
  phone = '(11) 99999-0001'
WHERE id = '86734aa6-0320-49cf-a15d-7e7b691e1e3d';

-- 4. Fix seller data: Fornecedor Guilherme
UPDATE sellers SET 
  city = 'São Paulo',
  state = 'SP',
  phone = '(11) 99999-0002'
WHERE id = 'b00a7e01-ac11-4109-b512-891ab04ddcd4';

-- 5. Fix seller data: Distribuidora Exemplo
UPDATE sellers SET 
  phone = '(11) 99999-0003'
WHERE id = '11111111-1111-1111-1111-111111111111';

-- 6. Fix per_kg_box products missing estimated_box_weight_kg
UPDATE products SET 
  estimated_box_weight_kg = 20.0,
  max_weight_variation_pct = 10.0
WHERE id = '9619290e-0dcb-4128-b19e-04ce14c2a4c7';

UPDATE products SET 
  estimated_box_weight_kg = 30.0,
  max_weight_variation_pct = 10.0
WHERE id = '2040e34c-5de7-4e75-a7f8-57d058cfe593';

-- 7. Fix expired min_expiry_date on Salmao fresco
UPDATE products SET min_expiry_date = '2026-04-30' 
WHERE name ILIKE '%salm_o fresco%';

-- 8. Deactivate test product
UPDATE products SET active = false 
WHERE name = 'TESTE-ITEM-XYZ';

-- 9. Fix profile with CNPJ in CPF field
UPDATE profiles SET cpf = NULL
WHERE id = '144dc9af-befb-463a-ab76-769238ed6dc0' AND cpf = '40760152000107';

-- 10. Remove seller_id from buyer profile (dual role fix)
UPDATE profiles SET seller_id = NULL 
WHERE id = 'df2c8f8a-8288-4169-ad55-86333501f1d9' AND role = 'buyer';

-- 11. Cancel stale pending orders (>7 days old)
UPDATE orders SET status = 'canceled', payment_status = 'canceled'
WHERE status = 'pending_payment' 
  AND created_at < NOW() - INTERVAL '7 days'
  AND payment_status = 'unpaid';
