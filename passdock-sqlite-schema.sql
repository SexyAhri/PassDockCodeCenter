PRAGMA foreign_keys = ON;

-- PassDock SQLite schema draft
-- Goal: generic digital fulfillment platform for MVP / single-node deployment
-- Notes:
-- 0. This file is the recommended MVP schema variant.
-- 1. JSON-like fields are stored as TEXT and should contain serialized JSON.
-- 2. `updated_at` should be maintained by application code.
-- 3. Recommended runtime setting: WAL mode for better concurrent read behavior.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT DEFAULT NULL,
  password_hash TEXT DEFAULT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  telegram_user_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  last_login_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_telegram_user_id ON users(telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

CREATE TABLE IF NOT EXISTS telegram_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  bot_key TEXT NOT NULL DEFAULT 'default',
  telegram_user_id TEXT NOT NULL,
  telegram_username TEXT DEFAULT NULL,
  chat_id TEXT NOT NULL,
  bound_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_telegram_bindings_bot_user ON telegram_bindings(bot_key, telegram_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_telegram_bindings_bot_chat ON telegram_bindings(bot_key, chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_bindings_user_id ON telegram_bindings(user_id);

CREATE TABLE IF NOT EXISTS payment_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_key TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  provider_name TEXT NOT NULL DEFAULT '',
  config_encrypted TEXT DEFAULT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_payment_channels_channel_key ON payment_channels(channel_key);
CREATE INDEX IF NOT EXISTS idx_payment_channels_enabled_sort ON payment_channels(enabled, sort_order);

CREATE TABLE IF NOT EXISTS integration_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_key TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'none',
  auth_config_encrypted TEXT DEFAULT NULL,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  retry_times INTEGER NOT NULL DEFAULT 2,
  health_status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TEXT DEFAULT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_integration_providers_provider_key ON integration_providers(provider_key);
CREATE INDEX IF NOT EXISTS idx_integration_providers_enabled ON integration_providers(enabled);

CREATE TABLE IF NOT EXISTS integration_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  action_key TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'POST',
  path_template TEXT NOT NULL,
  header_template TEXT DEFAULT NULL,
  query_template TEXT DEFAULT NULL,
  body_template TEXT DEFAULT NULL,
  success_path TEXT DEFAULT NULL,
  message_path TEXT DEFAULT NULL,
  code_list_path TEXT DEFAULT NULL,
  result_transformer TEXT DEFAULT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES integration_providers(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_integration_actions_provider_action ON integration_actions(provider_id, action_key);
CREATE INDEX IF NOT EXISTS idx_integration_actions_enabled ON integration_actions(enabled);

CREATE TABLE IF NOT EXISTS fulfillment_strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_key TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  fulfillment_type TEXT NOT NULL,
  provider_key TEXT DEFAULT NULL,
  action_key TEXT DEFAULT NULL,
  request_template TEXT DEFAULT NULL,
  result_schema TEXT DEFAULT NULL,
  delivery_template TEXT DEFAULT NULL,
  retry_policy TEXT DEFAULT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_fulfillment_strategies_strategy_key ON fulfillment_strategies(strategy_key);
CREATE INDEX IF NOT EXISTS idx_fulfillment_strategies_type_enabled ON fulfillment_strategies(fulfillment_type, enabled);

CREATE TABLE IF NOT EXISTS delivery_strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_key TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  message_template TEXT DEFAULT NULL,
  mask_policy TEXT DEFAULT NULL,
  resend_allowed INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_delivery_strategies_strategy_key ON delivery_strategies(strategy_key);
CREATE INDEX IF NOT EXISTS idx_delivery_strategies_channel_enabled ON delivery_strategies(channel_type, enabled);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_type TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  display_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  fulfillment_strategy_key TEXT NOT NULL,
  delivery_strategy_key TEXT DEFAULT NULL,
  metadata TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_type_enabled_sort ON products(product_type, enabled, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_fulfillment_strategy_key ON products(fulfillment_strategy_key);

CREATE TABLE IF NOT EXISTS product_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  amount NUMERIC NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_product_prices_product_payment_currency ON product_prices(product_id, payment_method, currency);
CREATE INDEX IF NOT EXISTS idx_product_prices_enabled ON product_prices(enabled);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL,
  user_id INTEGER DEFAULT NULL,
  product_id INTEGER DEFAULT NULL,
  product_snapshot TEXT DEFAULT NULL,
  payment_method TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_amount NUMERIC NOT NULL DEFAULT 0,
  pay_amount NUMERIC DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  source_channel TEXT NOT NULL DEFAULT 'web',
  buyer_ref TEXT DEFAULT NULL,
  external_ref TEXT DEFAULT NULL,
  metadata TEXT DEFAULT NULL,
  expire_at TEXT DEFAULT NULL,
  paid_at TEXT DEFAULT NULL,
  delivered_at TEXT DEFAULT NULL,
  cancelled_at TEXT DEFAULT NULL,
  completed_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_orders_order_no ON orders(order_no);
CREATE UNIQUE INDEX IF NOT EXISTS uk_orders_external_ref ON orders(external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_source_channel ON orders(source_channel);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER DEFAULT NULL,
  product_snapshot TEXT DEFAULT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount NUMERIC NOT NULL DEFAULT 0,
  line_amount NUMERIC NOT NULL DEFAULT 0,
  fulfillment_strategy_key TEXT DEFAULT NULL,
  delivery_strategy_key TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT DEFAULT NULL,
  to_status TEXT DEFAULT NULL,
  operator_type TEXT NOT NULL DEFAULT 'system',
  operator_id INTEGER DEFAULT NULL,
  payload TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_event_type ON order_events(event_type);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON order_events(created_at);

CREATE TABLE IF NOT EXISTS payment_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  merchant_order_no TEXT DEFAULT NULL,
  third_party_txn_no TEXT DEFAULT NULL,
  chain_tx_hash TEXT DEFAULT NULL,
  payer_account TEXT DEFAULT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  raw_payload TEXT DEFAULT NULL,
  confirmed_at TEXT DEFAULT NULL,
  failed_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_records_order_id ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_third_party_txn_no ON payment_records(third_party_txn_no);
CREATE INDEX IF NOT EXISTS idx_payment_records_chain_tx_hash ON payment_records(chain_tx_hash);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);

CREATE TABLE IF NOT EXISTS refund_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  payment_record_id INTEGER DEFAULT NULL,
  refund_no TEXT NOT NULL,
  refund_type TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  channel_key TEXT NOT NULL,
  provider_key TEXT DEFAULT NULL,
  action_key TEXT DEFAULT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  receipt_no TEXT DEFAULT NULL,
  request_payload TEXT DEFAULT NULL,
  response_payload TEXT DEFAULT NULL,
  failure_message TEXT DEFAULT NULL,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  requested_at TEXT DEFAULT NULL,
  processed_at TEXT DEFAULT NULL,
  refunded_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_record_id) REFERENCES payment_records(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_refund_records_refund_no ON refund_records(refund_no);
CREATE INDEX IF NOT EXISTS idx_refund_records_order_id ON refund_records(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_records_payment_record_id ON refund_records(payment_record_id);
CREATE INDEX IF NOT EXISTS idx_refund_records_receipt_no ON refund_records(receipt_no);
CREATE INDEX IF NOT EXISTS idx_refund_records_type_status ON refund_records(refund_type, status);
CREATE INDEX IF NOT EXISTS idx_refund_records_channel_status ON refund_records(channel_key, status);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  proof_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  object_url TEXT DEFAULT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER DEFAULT NULL,
  reviewed_at TEXT DEFAULT NULL,
  note TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_order_id ON payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_review_status ON payment_proofs(review_status);

CREATE TABLE IF NOT EXISTS fulfillment_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  strategy_key TEXT NOT NULL,
  fulfillment_type TEXT NOT NULL,
  provider_key TEXT DEFAULT NULL,
  action_key TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  request_payload TEXT DEFAULT NULL,
  response_payload TEXT DEFAULT NULL,
  result_data_encrypted TEXT DEFAULT NULL,
  result_data_masked TEXT DEFAULT NULL,
  external_ref TEXT DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  started_at TEXT DEFAULT NULL,
  finished_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_fulfillment_records_external_ref ON fulfillment_records(external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fulfillment_records_order_id ON fulfillment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_records_strategy_status ON fulfillment_records(strategy_key, status);
CREATE INDEX IF NOT EXISTS idx_fulfillment_records_provider_action ON fulfillment_records(provider_key, action_key);

CREATE TABLE IF NOT EXISTS code_issue_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  order_no TEXT NOT NULL,
  fulfillment_record_id INTEGER DEFAULT NULL,
  code_type TEXT NOT NULL,
  issue_status TEXT NOT NULL DEFAULT 'pending',
  provider_key TEXT DEFAULT NULL,
  action_key TEXT DEFAULT NULL,
  issued_code_encrypted TEXT DEFAULT NULL,
  issued_code_masked TEXT DEFAULT NULL,
  issued_count INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (fulfillment_record_id) REFERENCES fulfillment_records(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_code_issue_records_order_no ON code_issue_records(order_no);
CREATE INDEX IF NOT EXISTS idx_code_issue_records_order_id ON code_issue_records(order_id);
CREATE INDEX IF NOT EXISTS idx_code_issue_records_fulfillment_record_id ON code_issue_records(fulfillment_record_id);
CREATE INDEX IF NOT EXISTS idx_code_issue_records_code_type_status ON code_issue_records(code_type, issue_status);

CREATE TABLE IF NOT EXISTS delivery_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  fulfillment_record_id INTEGER DEFAULT NULL,
  delivery_channel TEXT NOT NULL,
  delivery_target TEXT DEFAULT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  message_id TEXT DEFAULT NULL,
  delivered_content_masked TEXT DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  delivered_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (fulfillment_record_id) REFERENCES fulfillment_records(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_records_order_id ON delivery_records(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_records_fulfillment_record_id ON delivery_records(fulfillment_record_id);
CREATE INDEX IF NOT EXISTS idx_delivery_records_channel_status ON delivery_records(delivery_channel, delivery_status);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no TEXT NOT NULL,
  user_id INTEGER DEFAULT NULL,
  order_id INTEGER DEFAULT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to INTEGER DEFAULT NULL,
  resolution_note TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_support_tickets_ticket_no ON support_tickets(ticket_no);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_order_id ON support_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority ON support_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);

CREATE TABLE IF NOT EXISTS internal_client_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_key TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  scopes TEXT DEFAULT NULL,
  allowed_ips TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_internal_client_keys_client_key ON internal_client_keys(client_key);
CREATE INDEX IF NOT EXISTS idx_internal_client_keys_status ON internal_client_keys(status);

CREATE TABLE IF NOT EXISTS admin_operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER DEFAULT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT DEFAULT NULL,
  target_type TEXT DEFAULT NULL,
  request_ip TEXT DEFAULT NULL,
  request_payload TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_admin_user_id ON admin_operation_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_module_action ON admin_operation_logs(module, action);
CREATE INDEX IF NOT EXISTS idx_admin_operation_logs_created_at ON admin_operation_logs(created_at);
