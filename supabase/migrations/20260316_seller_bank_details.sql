-- Add bank details columns to sellers for manual payout
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_agency text;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_account_type text DEFAULT 'corrente'; -- corrente ou poupanca
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_pix_key text;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_holder_name text;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_holder_cnpj text;
