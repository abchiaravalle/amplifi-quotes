/** Bindings and vars. Keep in sync with wrangler.jsonc and .dev.vars.example. */
export interface Env {
  ASSETS: Fetcher;
  WORKSPACE: DurableObjectNamespace;
  DIRECTORY: DurableObjectNamespace;
  /** 'self' = one workspace per deployment; 'hosted' = many, resolved by hostname */
  EDITION: 'self' | 'hosted';
  APP_VERSION: string;
  /** Required for first-run setup and owner reclaim (DEP-3, DEP-8) */
  SETUP_CODE?: string;
  RESEND_API_KEY?: string;
  SMTP2GO_API_KEY?: string;
  /** Encrypts integration secrets at rest (INT-8). Falls back to a per-workspace generated key. */
  INTEGRATION_KEY?: string;
  /** Hosted edition only */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  HOSTED_BASE_DOMAIN?: string;
  CF_API_TOKEN?: string;
  CF_ZONE_ID?: string;
  STAFF_EMAILS?: string;
  /** Optional R2 for nightly exports (BAK-3) and large files */
  FILES?: R2Bucket;
  /** Optional Workers AI (EXT-3) */
  AI?: Ai;
  /** Test-only: fixed clock (ms) and outbound mock switch. Never set in production. */
  TEST_NOW?: string;
}

/** Headers the Worker sets for the Durable Object. The Worker strips any client-sent copies. */
export const INTERNAL_HEADERS = {
  ip: 'x-aq-ip',
  country: 'x-aq-country',
  workspace: 'x-aq-workspace',
  host: 'x-aq-host',
} as const;
