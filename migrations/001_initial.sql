CREATE TABLE brokerage_accounts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 broker TEXT NOT NULL DEFAULT 'webull',
 external_account_id TEXT NOT NULL,
 account_type TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (broker, external_account_id)
);
CREATE TABLE brokerage_orders (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 brokerage_account_id BIGINT NOT NULL REFERENCES brokerage_accounts(id),
 broker_order_id TEXT NOT NULL,
 client_order_id TEXT,
 symbol TEXT,
 instrument_type TEXT NOT NULL DEFAULT 'EQUITY',
 side TEXT,
 status TEXT,
 ordered_at TIMESTAMPTZ,
 last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE (brokerage_account_id,broker_order_id)
);
CREATE INDEX brokerage_orders_by_time ON brokerage_orders (brokerage_account_id,ordered_at DESC);
CREATE INDEX brokerage_orders_by_symbol ON brokerage_orders (symbol,ordered_at DESC);
CREATE TABLE executions (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 brokerage_account_id BIGINT NOT NULL REFERENCES brokerage_accounts(id),
 brokerage_order_id BIGINT REFERENCES brokerage_orders(id),
 source TEXT NOT NULL DEFAULT 'webull',
 broker_execution_id TEXT,
 symbol TEXT NOT NULL,
 instrument_type TEXT NOT NULL DEFAULT 'EQUITY',
 side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
 quantity NUMERIC(22,8) NOT NULL CHECK (quantity>0),
 price NUMERIC(22,8) NOT NULL CHECK (price>=0),
 executed_at TIMESTAMPTZ NOT NULL,
 raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (brokerage_account_id,broker_execution_id)
);
CREATE INDEX executions_by_symbol_time ON executions (brokerage_account_id,symbol,executed_at,id);
CREATE INDEX executions_by_time ON executions (executed_at DESC,id DESC);
CREATE TABLE execution_fees (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 execution_id BIGINT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
 fee_type TEXT NOT NULL,
 amount NUMERIC(20,8) NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'USD',
 UNIQUE(execution_id,fee_type)
);
CREATE TABLE tax_lots (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 brokerage_account_id BIGINT NOT NULL REFERENCES brokerage_accounts(id),
 opening_execution_id BIGINT REFERENCES executions(id),
 symbol TEXT NOT NULL,
 acquired_at TIMESTAMPTZ NOT NULL,
 original_quantity NUMERIC(22,8) NOT NULL CHECK (original_quantity>0),
 remaining_quantity NUMERIC(22,8) NOT NULL CHECK (remaining_quantity>=0),
 original_basis NUMERIC(22,8) NOT NULL,
 adjusted_basis NUMERIC(22,8) NOT NULL
);
CREATE INDEX tax_lots_open_by_symbol ON tax_lots (brokerage_account_id,symbol,acquired_at) WHERE remaining_quantity>0;
CREATE TABLE wash_sale_adjustments (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 loss_execution_id BIGINT NOT NULL REFERENCES executions(id),
 replacement_tax_lot_id BIGINT NOT NULL REFERENCES tax_lots(id),
 matched_quantity NUMERIC(22,8) NOT NULL CHECK(matched_quantity>0),
 disallowed_loss NUMERIC(22,8) NOT NULL CHECK(disallowed_loss>=0),
 status TEXT NOT NULL CHECK(status IN ('potential','confirmed','review')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(loss_execution_id,replacement_tax_lot_id)
);
CREATE INDEX wash_sales_by_loss ON wash_sale_adjustments(loss_execution_id);
