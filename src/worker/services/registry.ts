/**
 * Cross-module services. A module PROVIDES a named service in init(); other modules USE it at request
 * time with ws.services.get(). No module imports another module's files. Typed by the map below:
 * the providing workstream fills in the implementation, the signature here is the contract.
 */
import type { RateContext } from '../../engine/types';

export interface ServiceMap {
  /** workspace: next quote number in one transaction (WS-6) */
  'workspace.nextQuoteNumber': () => string;
  /** workspace: is the given date a working day / count workdays (WS-7) */
  'workspace.calendar': () => { workdays: number[]; holidays: string[] };
  /** workspace: customer + contact + site summary for documents */
  'workspace.customerSummary': (q: {
    customerId: string | null;
    contactId: string | null;
    siteId: string | null;
  }) => {
    customer: {
      id: string;
      name: string;
      address: string[];
      taxExempt: boolean;
      currency: string | null;
      language: string | null;
      paymentTerms: string;
      fields: Record<string, string | number | boolean>;
    } | null;
    contact: { id: string; name: string; email: string; title: string; phone: string } | null;
    site: {
      id: string;
      name: string;
      address: string[];
      country: string;
      regionId: string | null;
      fields: Record<string, string | number | boolean>;
    } | null;
  };
  /** workspace: entity summary for documents */
  'workspace.entity': (entityId: string | null) => {
    id: string;
    name: string;
    legalName: string;
    address: string[];
    taxId: string;
    email: string;
    phone: string;
    bank: string[];
    attributes: Record<string, string | number | boolean>;
  } | null;
  /** pricing: build the engine's RateContext for a quote (RATE-1..8, CUS-5) */
  'pricing.rateContext': (q: {
    currency: string;
    regionId: string | null;
    customerId: string | null;
    siteId: string | null;
    entityId: string | null;
    asOf: string; // YYYY-MM-DD
    quote: Record<string, string | number | boolean>;
  }) => RateContext;
  /** pricing: exchange rate for display (RATE-6); null when unknown */
  'pricing.fxRate': (base: string, quote: string, asOf: string) => { rate: string; asOf: string } | null;
  /** comms: resolve customer-facing labels for a language (I18N-1) */
  'comms.labels': (language: string) => Record<string, string>;
  /** comms: send an email now through the outbox (EML-6). Returns outbox id or null when email is off */
  'comms.email': (msg: {
    to: string;
    subject: string;
    html: string;
    text: string;
    kind: string;
    replyTo?: string;
  }) => string | null;
  /** quotes: build the customer-facing document for a quote's current sent revision */
  'quotes.document': (quoteId: string) => import('../../shared/document').QuoteDocument | null;
}

export class Services {
  private impl = new Map<string, unknown>();
  provide<K extends keyof ServiceMap>(name: K, fn: ServiceMap[K]): void {
    this.impl.set(name, fn);
  }
  get<K extends keyof ServiceMap>(name: K): ServiceMap[K] {
    const f = this.impl.get(name);
    if (!f) throw new Error(`service ${name} is not provided`);
    return f as ServiceMap[K];
  }
  has(name: keyof ServiceMap): boolean {
    return this.impl.has(name);
  }
}

/**
 * Durable Object RPC entry points callable from the Worker or other DOs (hosted edition sign-up,
 * staff console). Registered by modules in init(); the DO exposes them through `rpc(name, args)`.
 */
export type RpcHandler = (args: unknown) => Promise<unknown> | unknown;
export class RpcRegistry {
  private handlers = new Map<string, RpcHandler>();
  register(name: string, h: RpcHandler): void {
    this.handlers.set(name, h);
  }
  async call(name: string, args: unknown): Promise<unknown> {
    const h = this.handlers.get(name);
    if (!h) throw new Error(`rpc ${name} not found`);
    return h(args);
  }
}
