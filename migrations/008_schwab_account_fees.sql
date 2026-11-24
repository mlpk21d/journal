-- Schwab CSV imports are account-scoped and deduplicated by broker order ID.
-- Account-level fees are separate from execution/order commissions.
CREATE TABLE account_fees (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 brokerage_account_id BIGINT NOT NULL REFERENCES brokerage_accounts(id),
 fee_date DATE NOT NULL,
 fee_type TEXT NOT NULL CHECK(length(fee_type) BETWEEN 1 AND 100),
 description TEXT NOT NULL DEFAULT '',
 amount NUMERIC(20,8) NOT NULL CHECK(amount>0),
 source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','schwab_csv')),
 source_key TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (brokerage_account_id,source,source_key)
);
CREATE INDEX account_fees_by_account_date ON account_fees (brokerage_account_id,fee_date DESC,id DESC);
CREATE INDEX executions_schwab_account_time ON executions (brokerage_account_id,executed_at)
 WHERE source='schwab_csv';
