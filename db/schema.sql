CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'THB',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id),
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id ON webhook_events(order_id);

INSERT INTO orders (id, status, amount_cents, currency)
VALUES ('11111111-1111-1111-1111-111111111111', 'pending', 250000, 'THB')
ON CONFLICT (id) DO NOTHING;
