/**
 * The customer-facing document model. The server builds it from a FROZEN revision through an
 * allowlist serializer (SEC-3); the customer page, the PDF and customer emails all render from it.
 * Nothing internal (cost, margin, trace, internal notes, internal-only lines, owner email) may ever
 * appear in this type. Adding a field here = deciding it is customer-safe.
 */

export interface Money {
  /** decimal string in the quote currency, e.g. "1250.00" */
  amount: string;
  currency: string;
}

export interface DocLine {
  id: string;
  label: string;
  qty: string;
  unit: string;
  /** omitted when the workspace hides unit prices (PDF-5) */
  unitPrice?: string;
  gross: string;
  discount: string;
  net: string;
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'yearly';
  /** children rolled into this line (CAT-8) are NOT listed; the parent carries the total */
}

export interface DocGroup {
  id: string;
  label: string;
  lines: DocLine[];
  subtotal: string;
}

export interface DocTotals {
  oneTime: string;
  monthly: string;
  quarterly: string;
  yearly: string;
  contract: string;
  discount: string;
  tax: string;
  taxLabel: string;
  total: string;
}

export interface DocOption {
  key: string;
  label: string;
  description?: string;
  groups: DocGroup[];
  totals: DocTotals;
}

export interface DocAddon {
  key: string;
  label: string;
  description?: string;
  /** frozen at send time (PRC-12) */
  amount: string;
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'yearly';
  taxable: boolean;
  defaultSelected: boolean;
}

export interface DocContentBlock {
  id: string;
  kind: 'text' | 'cards' | 'image';
  title?: string;
  /** sanitized HTML (SEC-5) */
  body?: string;
  cards?: { title: string; body: string }[];
  imageUrl?: string;
}

export interface DocAttachment {
  id: string;
  name: string;
  size: number;
  mime: string;
  url: string;
}

export interface DocAcceptance {
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  poNumber: string;
  optionKey: string;
  optionLabel: string;
  addons: string[];
  total: string;
  acceptedAt: number;
  revisionHash: string;
  /** typed name or a data:image/png;base64 drawing */
  signature: string;
  signatureKind: 'typed' | 'drawn';
}

export interface QuoteDocument {
  /** document model version, bump on breaking change */
  v: 1;
  quoteNumber: string;
  revisionNumber: number;
  revisionHash: string;
  title: string;
  language: string;
  currency: string;
  currencyDecimals: number;
  /** second currency display (CV-4), using the FROZEN rate */
  secondaryCurrency?: { currency: string; rate: string; asOf: string };
  status: 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | 'superseded';
  validFrom: string | null;
  validUntil: string | null;
  sentAt: number | null;
  brand: {
    name: string;
    logoUrl: string | null;
    primary: string;
    accent: string;
    font: string;
    footer: string;
  };
  entity: {
    name: string;
    legalName: string;
    address: string[];
    taxId: string;
    email: string;
    phone: string;
    bank?: string[];
  };
  customer: {
    name: string;
    contactName: string;
    contactEmail: string;
    address: string[];
  };
  rep: { name: string; email: string; phone?: string };
  /** sanitized HTML */
  letter: string;
  scope: string;
  terms: string;
  content: DocContentBlock[];
  options: DocOption[];
  addons: DocAddon[];
  attachments: DocAttachment[];
  pdf: {
    pageSize: 'letter' | 'a4';
    logoPosition: 'left' | 'right';
    showUnitPrices: boolean;
    showLineDetail: boolean;
  };
  acceptance: DocAcceptance | null;
  /** an updated revision replaced the one this link first showed (QT-2) */
  updatedNotice: boolean;
  /** customer-facing labels already resolved for `language` (I18N-1) */
  labels: Record<string, string>;
  /** what the customer may do now */
  actions: {
    accept: boolean;
    decline: boolean;
    ask: boolean;
    requestUpdate: boolean;
    verifyEmailFirst: boolean;
  };
}
