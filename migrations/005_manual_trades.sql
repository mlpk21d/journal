-- Preserve existing manual opening lots while broadening them into editable
-- manual BUY/SELL executions. No broker imports or real executions are changed.
ALTER TABLE manual_opening_lots RENAME TO manual_trades;
ALTER TABLE manual_trades RENAME COLUMN acquired_at TO executed_at;
ALTER TABLE manual_trades RENAME COLUMN unit_basis TO price;
ALTER TABLE manual_trades RENAME COLUMN basis_status TO verification_status;
ALTER TABLE manual_trades ADD COLUMN side TEXT NOT NULL DEFAULT 'BUY'
  CHECK (side IN ('BUY','SELL'));
ALTER TABLE manual_trades ADD COLUMN fees NUMERIC(20,8) NOT NULL DEFAULT 0
  CHECK (fees >= 0);
ALTER TABLE manual_trades ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'OPENING'
  CHECK (entry_type IN ('OPENING','TRADE'));
ALTER TABLE manual_trades ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER INDEX manual_opening_lots_account_symbol_date
  RENAME TO manual_trades_account_symbol_date;
CREATE INDEX manual_trades_recent ON manual_trades (executed_at DESC,id DESC);
