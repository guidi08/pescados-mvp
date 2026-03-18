-- Atomic wallet balance increment to prevent race conditions
CREATE OR REPLACE FUNCTION increment_wallet_balance(p_buyer_id uuid, p_delta integer)
RETURNS TABLE(id uuid, buyer_id uuid, balance_cents integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE wallets
  SET balance_cents = wallets.balance_cents + p_delta,
      updated_at = now()
  WHERE wallets.buyer_id = p_buyer_id
  RETURNING wallets.id, wallets.buyer_id, wallets.balance_cents;

  -- If no row was updated, the wallet doesn't exist yet — create it
  IF NOT FOUND THEN
    RETURN QUERY
    INSERT INTO wallets (buyer_id, balance_cents)
    VALUES (p_buyer_id, GREATEST(p_delta, 0))
    RETURNING wallets.id, wallets.buyer_id, wallets.balance_cents;
  END IF;
END;
$$;
