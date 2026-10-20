/**
 * Migration 0001: the full v1 schema for a workspace database (SQLite inside WorkspaceDO).
 *
 * Conventions
 * - ids are TEXT (prefixed random ids from src/worker/lib/ids.ts), except audit_log (INTEGER autoincrement).
 * - timestamps are INTEGER milliseconds since epoch (UTC). Dates without time are TEXT 'YYYY-MM-DD'.
 * - decimal numbers (money, rates, quantities) are TEXT decimal strings, never REAL. Currency codes are TEXT ISO 4217.
 * - JSON columns are TEXT holding JSON.
 * - Every foreign key and every list filter has an index. Each index adds a billed row write, so keep them purposeful.
 */
export const m0001 = {
  version: 1,
  name: 'init',
  sql: /* sql */ `
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','pricing_editor','approver','sales','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  grants TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_sign_in_at INTEGER
);

CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  device_label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX idx_passkeys_member ON passkeys(member_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  revoked_at INTEGER
);
CREATE INDEX idx_sessions_member ON sessions(member_id);

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  member_id TEXT,
  challenge TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  expires_at INTEGER NOT NULL
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  revoked_at INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE email_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('signin','reclaim','accept_verify')),
  email TEXT NOT NULL COLLATE NOCASE,
  member_id TEXT,
  ref TEXT,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE recovery_codes (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  code_hash TEXT NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_recovery_member ON recovery_codes(member_id);

CREATE TABLE oidc_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  invite_id TEXT,
  expires_at INTEGER NOT NULL
);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '{}',
  tax_id TEXT NOT NULL DEFAULT '',
  bank TEXT NOT NULL DEFAULT '{}',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  attributes TEXT NOT NULL DEFAULT '{}',
  is_default INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_norm TEXT NOT NULL,
  email_domain TEXT NOT NULL DEFAULT '',
  billing_address TEXT NOT NULL DEFAULT '{}',
  tax_id TEXT NOT NULL DEFAULT '',
  tax_exempt INTEGER NOT NULL DEFAULT 0,
  currency TEXT,
  language TEXT,
  payment_terms TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  fields TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  search TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_customers_name ON customers(name_norm);
CREATE INDEX idx_customers_domain ON customers(email_domain);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  phone TEXT NOT NULL DEFAULT '',
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_contacts_customer ON contacts(customer_id);
CREATE INDEX idx_contacts_email ON contacts(email);

CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  distance_unit TEXT NOT NULL CHECK (distance_unit IN ('km','mi')),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE country_regions (
  country TEXT PRIMARY KEY,
  region_id TEXT REFERENCES regions(id)
);
CREATE INDEX idx_country_regions_region ON country_regions(region_id);

CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '{}',
  country TEXT NOT NULL,
  fields TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_sites_customer ON sites(customer_id);

CREATE TABLE catalog_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('item','labor_role','asset_type','bundle')),
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'each',
  frequency TEXT NOT NULL DEFAULT 'one_time' CHECK (frequency IN ('one_time','monthly','quarterly','yearly')),
  taxable INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'shown' CHECK (visibility IN ('shown','rolled','internal')),
  parent_id TEXT,
  attributes TEXT NOT NULL DEFAULT '{}',
  search TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_catalog_kind_cat ON catalog_items(kind, category);
CREATE INDEX idx_catalog_sku ON catalog_items(sku);

CREATE TABLE item_prices (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES catalog_items(id),
  currency TEXT NOT NULL,
  amount TEXT NOT NULL,
  cost TEXT,
  effective_from INTEGER NOT NULL,
  effective_to INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_item_prices_item ON item_prices(item_id, currency, effective_from);

CREATE TABLE labor_rates (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES catalog_items(id),
  region_id TEXT NOT NULL REFERENCES regions(id),
  hourly TEXT NOT NULL,
  daily TEXT NOT NULL,
  currency TEXT NOT NULL,
  effective_from INTEGER NOT NULL,
  effective_to INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_labor_rates_item ON labor_rates(item_id, region_id, effective_from);

CREATE TABLE bundle_items (
  bundle_id TEXT NOT NULL REFERENCES catalog_items(id),
  item_id TEXT NOT NULL REFERENCES catalog_items(id),
  qty TEXT NOT NULL,
  PRIMARY KEY (bundle_id, item_id)
);

CREATE TABLE asset_parts (
  asset_type_id TEXT NOT NULL REFERENCES catalog_items(id),
  item_id TEXT NOT NULL REFERENCES catalog_items(id),
  PRIMARY KEY (asset_type_id, item_id)
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  site_id TEXT REFERENCES sites(id),
  asset_type_id TEXT REFERENCES catalog_items(id),
  model TEXT NOT NULL DEFAULT '',
  serial TEXT NOT NULL DEFAULT '',
  install_date TEXT,
  attributes TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_assets_site ON assets(site_id);
CREATE INDEX idx_assets_customer ON assets(customer_id);

CREATE TABLE price_agreements (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  kind TEXT NOT NULL CHECK (kind IN ('category_percent','item_price')),
  target TEXT NOT NULL,
  value TEXT NOT NULL,
  currency TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_agreements_customer ON price_agreements(customer_id);

CREATE TABLE rates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  unit TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE rate_values (
  id TEXT PRIMARY KEY,
  rate_id TEXT NOT NULL REFERENCES rates(id),
  region_id TEXT NOT NULL REFERENCES regions(id),
  value TEXT NOT NULL,
  currency TEXT NOT NULL,
  effective_from INTEGER NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_rate_values_lookup ON rate_values(rate_id, region_id, effective_from);

CREATE TABLE fx_rates (
  id TEXT PRIMARY KEY,
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate TEXT NOT NULL,
  as_of TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_fx_pair ON fx_rates(base, quote, as_of);

CREATE TABLE tax_rules (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES regions(id),
  rate TEXT NOT NULL,
  label TEXT NOT NULL,
  taxable_categories TEXT NOT NULL DEFAULT '"all"',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_tax_region ON tax_rules(region_id);

CREATE TABLE terms_blocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  draft_doc TEXT NOT NULL,
  published_version_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id),
  version INTEGER NOT NULL,
  doc TEXT NOT NULL,
  compiled TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  change_note TEXT NOT NULL DEFAULT '',
  published_by TEXT,
  published_at INTEGER NOT NULL,
  UNIQUE (template_id, version)
);

CREATE TABLE pricing_examples (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id),
  name TEXT NOT NULL,
  inputs TEXT NOT NULL,
  context TEXT NOT NULL,
  expected TEXT NOT NULL,
  source_quote_id TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_examples_template ON pricing_examples(template_id);

CREATE TABLE example_acceptances (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version_id TEXT,
  example_id TEXT NOT NULL,
  target TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  accepted_by TEXT NOT NULL,
  accepted_at INTEGER NOT NULL
);
CREATE INDEX idx_example_acc_template ON example_acceptances(template_id);

CREATE TABLE approval_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('discount_over','margin_under','total_over','any_override','item_present')),
  threshold TEXT,
  item_id TEXT,
  approver_role TEXT,
  approver_member_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  customer_id TEXT REFERENCES customers(id),
  contact_id TEXT REFERENCES contacts(id),
  site_id TEXT REFERENCES sites(id),
  entity_id TEXT REFERENCES entities(id),
  owner_id TEXT NOT NULL REFERENCES members(id),
  template_id TEXT NOT NULL REFERENCES templates(id),
  status TEXT NOT NULL CHECK (status IN ('draft','pending_approval','approved','rejected','sent','viewed','accepted','declined','expired','withdrawn')),
  current_revision_id TEXT,
  sent_revision_id TEXT,
  token TEXT UNIQUE,
  access_code_hash TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  currency TEXT NOT NULL,
  valid_from TEXT,
  valid_until TEXT,
  total TEXT NOT NULL DEFAULT '0',
  is_test INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sent_at INTEGER,
  first_viewed_at INTEGER,
  last_viewed_at INTEGER,
  accepted_at INTEGER,
  declined_at INTEGER,
  expired_at INTEGER,
  withdrawn_at INTEGER,
  acknowledged_at INTEGER
);
CREATE INDEX idx_quotes_status ON quotes(status, updated_at);
CREATE INDEX idx_quotes_owner ON quotes(owner_id, updated_at);
CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_template ON quotes(template_id);
CREATE INDEX idx_quotes_valid_until ON quotes(valid_until);

CREATE TABLE quote_revisions (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  number INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'normal' CHECK (kind IN ('normal','change_order')),
  status TEXT NOT NULL CHECK (status IN ('draft','sent','superseded')),
  template_version_id TEXT NOT NULL REFERENCES template_versions(id),
  engine_version TEXT NOT NULL,
  inputs TEXT NOT NULL,
  result TEXT,
  letter TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '',
  terms TEXT NOT NULL DEFAULT '',
  frozen TEXT,
  hash TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sent_at INTEGER,
  sent_by TEXT,
  UNIQUE (quote_id, number)
);

CREATE TABLE quote_events (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  revision_id TEXT,
  kind TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('member','customer','system')),
  actor_id TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_quote_events_quote ON quote_events(quote_id, created_at);

CREATE TABLE acceptances (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  revision_id TEXT NOT NULL REFERENCES quote_revisions(id),
  option_key TEXT NOT NULL,
  addons TEXT NOT NULL DEFAULT '[]',
  signer_name TEXT NOT NULL,
  signer_title TEXT NOT NULL DEFAULT '',
  signer_email TEXT NOT NULL,
  po_number TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  total TEXT NOT NULL,
  revision_hash TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  paid_status TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_acceptances_revision ON acceptances(revision_id);
CREATE INDEX idx_acceptances_quote ON acceptances(quote_id);

CREATE TABLE views (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  revision_id TEXT,
  viewed_at INTEGER NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_views_quote ON views(quote_id, viewed_at);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  author_type TEXT NOT NULL CHECK (author_type IN ('member','customer')),
  author_id TEXT,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('internal','customer')),
  answered_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_comments_quote ON comments(quote_id, created_at);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  quote_id TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('quote_customer','quote_internal','brand','content','import','export')),
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage TEXT NOT NULL DEFAULT 'sqlite' CHECK (storage IN ('sqlite','r2')),
  r2_key TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_files_quote ON files(quote_id);

CREATE TABLE file_chunks (
  file_id TEXT NOT NULL REFERENCES files(id),
  idx INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (file_id, idx)
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  revision_id TEXT NOT NULL,
  reasons TEXT NOT NULL,
  approver_role TEXT,
  approver_member_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cleared')),
  decided_by TEXT,
  decided_at INTEGER,
  comment TEXT NOT NULL DEFAULT '',
  reminded_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_approvals_quote ON approvals(quote_id);
CREATE INDEX idx_approvals_status ON approvals(status);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL,
  quote_id TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_notifications_member ON notifications(member_id, created_at);

CREATE TABLE notification_prefs (
  member_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email','both','off')),
  PRIMARY KEY (member_id, kind)
);

CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('email','webhook','crm','chat')),
  target TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE INDEX idx_outbox_due ON outbox(status, next_attempt_at);

CREATE TABLE outbox_attempts (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL REFERENCES outbox(id),
  at INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  status_code INTEGER,
  error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_outbox_attempts_outbox ON outbox_attempts(outbox_id);

CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret_enc TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE TABLE integrations (
  kind TEXT PRIMARY KEY,
  config TEXT NOT NULL DEFAULT '{}',
  secret_enc TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

CREATE TABLE crm_links (
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  provider TEXT NOT NULL CHECK (provider IN ('hubspot','salesforce')),
  external_id TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (quote_id, provider)
);

CREATE TABLE email_templates (
  kind TEXT NOT NULL,
  language TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (kind, language)
);

CREATE TABLE labels (
  language TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (language, key)
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  after_days INTEGER NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('not_viewed','not_accepted')),
  due_at INTEGER NOT NULL,
  sent_at INTEGER,
  cancelled_at INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_reminders_due ON reminders(due_at);

CREATE TABLE saved_views (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  name TEXT NOT NULL,
  filters TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_saved_views_member ON saved_views(member_id);

CREATE TABLE drafts (
  member_id TEXT NOT NULL,
  quote_id TEXT NOT NULL,
  data TEXT NOT NULL,
  base_version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (member_id, quote_id)
);

CREATE TABLE report_daily (
  day TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  value TEXT NOT NULL DEFAULT '0',
  PRIMARY KEY (day, owner_id, template_id, metric)
);

CREATE TABLE usage_daily (
  day TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  ws_messages INTEGER NOT NULL DEFAULT 0,
  outbound INTEGER NOT NULL DEFAULT 0,
  warned_70 INTEGER NOT NULL DEFAULT 0,
  warned_90 INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  locked_until INTEGER
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  run_at INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  UNIQUE (kind, ref)
);
CREATE INDEX idx_jobs_run_at ON jobs(run_at);

CREATE TABLE support_grants (
  id TEXT PRIMARY KEY,
  granted_by TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE restore_points (
  id TEXT PRIMARY KEY,
  bookmark TEXT NOT NULL,
  reason TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  app_version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('member','customer','system','staff','api_key')),
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  before TEXT,
  after TEXT,
  ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_audit_at ON audit_log(at);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, at);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log
WHEN OLD.at > (CAST(strftime('%s','now') AS INTEGER) * 1000 - 31536000000)
BEGIN SELECT RAISE(ABORT, 'audit_log rows younger than 1 year cannot be deleted'); END;
`,
};
