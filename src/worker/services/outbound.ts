/**
 * The ONLY way server code makes outbound HTTP calls. Lets tests mock every outbound host and lets
 * the zero-outbound test (TST-8) assert that defaults make no calls (ADM-3).
 */
export interface OutboundCall {
  url: string;
  method: string;
  purpose: string;
  /** request body as text when it was a string (tests inspect it) */
  body?: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class Outbound {
  readonly calls: OutboundCall[] = [];
  constructor(private impl: FetchLike = (u, i) => fetch(u, i)) {}

  /** purpose: short tag like 'email.resend', 'webhook', 'crm.hubspot', 'fx', 'maps', 'oidc', 'updates', 'ai', 'chat' */
  async fetch(purpose: string, url: string, init: RequestInit = {}): Promise<Response> {
    this.calls.push({
      url,
      method: init.method ?? 'GET',
      purpose,
      body: typeof init.body === 'string' ? init.body : undefined,
    });
    return this.impl(url, init);
  }

  /** Swap the implementation (tests) */
  setImpl(impl: FetchLike): void {
    this.impl = impl;
  }
}

/** Every outbound host the app can contact, with the setting that enables it (ADM-3). */
export const OUTBOUND_HOSTS: { host: string; purpose: string; enabledBy: string }[] = [
  { host: 'api.resend.com', purpose: 'Email through Resend', enabledBy: 'email.provider = resend' },
  { host: 'api.smtp2go.com', purpose: 'Email through SMTP2GO', enabledBy: 'email.provider = smtp2go' },
  { host: 'api.postmarkapp.com', purpose: 'Email through Postmark', enabledBy: 'email.provider = postmark' },
  {
    host: 'email.<region>.amazonaws.com',
    purpose: 'Email through Amazon SES',
    enabledBy: 'email.provider = ses',
  },
  { host: 'api.frankfurter.app', purpose: 'Daily exchange rates', enabledBy: 'fx.autoFetch' },
  { host: 'api.mapbox.com', purpose: 'Distance from site address', enabledBy: 'maps.provider = mapbox' },
  { host: 'maps.googleapis.com', purpose: 'Distance from site address', enabledBy: 'maps.provider = google' },
  {
    host: 'accounts.google.com, oauth2.googleapis.com',
    purpose: 'Google sign-in',
    enabledBy: 'auth.oidc.google',
  },
  { host: 'login.microsoftonline.com', purpose: 'Microsoft sign-in', enabledBy: 'auth.oidc.microsoft' },
  { host: 'api.github.com', purpose: 'Check for new releases', enabledBy: 'updates.check' },
  { host: 'api.hubapi.com', purpose: 'HubSpot deal sync', enabledBy: 'integrations.hubspot' },
  {
    host: '<instance>.my.salesforce.com',
    purpose: 'Salesforce opportunity sync',
    enabledBy: 'integrations.salesforce',
  },
  { host: 'hooks.slack.com', purpose: 'Slack channel alerts', enabledBy: 'chat.webhooks.slack' },
  { host: '<tenant>.webhook.office.com', purpose: 'Teams channel alerts', enabledBy: 'chat.webhooks.teams' },
  {
    host: 'challenges.cloudflare.com',
    purpose: 'Turnstile check on the estimate widget',
    enabledBy: 'widget.enabled',
  },
  { host: 'api.stripe.com', purpose: 'Pay on accept', enabledBy: 'integrations.stripe' },
  { host: '(webhook URLs you add)', purpose: 'Your webhooks', enabledBy: 'webhooks' },

  // ---- auth workstream adds entries below this line ----

  // ---- workspace workstream adds entries below this line ----

  // ---- pricing workstream adds entries below this line ----

  // ---- quotes workstream adds entries below this line ----

  // ---- comms workstream adds entries below this line ----

  // ---- integrations workstream adds entries below this line ----

  // ---- hosted workstream adds entries below this line ----

  // ---- platform workstream adds entries below this line ----
];
