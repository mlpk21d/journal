-- Manual opening stock lots supplement missing historical brokerage data.
-- Never masquerade as broker orders/executions; preserved across broker reimports.
CREATE TABLE IF NOT EXISTS manual_opening_lots (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 brokerage_account_id BIGINT NOT NULL REFERENCES brokerage_accounts(id),
 symbol TEXT NOT NULL CHECK (symbol ~ '^[A-Z0-9.^_-]{1,30}$'),
 acquired_at TIMESTAMPTZ NOT NULL,
 quantity NUMERIC(22,8) NOT NULL CHECK (quantity>0),
 unit_basis NUMERIC(22,8) NOT NULL CHECK (unit_basis>=0),
 basis_status TEXT NOT NULL DEFAULT 'user_supplied_unverified'
  CHECK (basis_status IN ('user_supplied_unverified')),
 notes TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manual_opening_lots_account_symbol_date
 ON manual_opening_lots (brokerage_account_id,symbol,acquired_at,id);
