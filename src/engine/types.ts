/**
 * Pricing engine public contract.
 *
 * Everything outside src/engine imports ONLY from 'src/engine' (index.ts), which re-exports these
 * types plus the functions declared at the bottom. The engine is pure: no I/O, no clock, no globals.
 * The same code runs in the browser (live preview) and the Worker (authoritative result).
 *
 * All decimal numbers cross the boundary as strings ("12.50") so nothing passes through binary floats.
 */

// ---------- units ----------

/** Units a value can carry. 'money' values also carry a currency. */
export type UnitKind =
  | 'money'
  | 'hour'
  | 'day'
  | 'night'
  | 'week'
  | 'month'
  | 'year'
  | 'distance'
  | 'count'
  | 'percent'
  | 'bool'
  | 'text'
  | 'date'
  | 'none';

export type Frequency = 'one_time' | 'monthly' | 'quarterly' | 'yearly';
export type Visibility = 'shown' | 'rolled' | 'internal';
export type DiscountLevel = 'line' | 'option' | 'quote';

export interface Issue {
  code: string;
  message: string;
  /** Where it happened: e.g. "groups.travel.lines.lodging.qty" or "values.room_nights" */
  path?: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

// ---------- template document (stored JSON, authored in the admin UI) ----------

export type InputType =
  | 'number'
  | 'integer'
  | 'money'
  | 'percent'
  | 'yesno'
  | 'choice'
  | 'multichoice'
  | 'date'
  | 'daterange'
  | 'text'
  | 'catalog_pick'
  | 'site'
  | 'asset_list'
  | 'labor_list'
  | 'group';

export interface InputDef {
  id: string;
  type: InputType;
  label: string;
  help?: string;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: UnitKind;
  choices?: { value: string; label: string }[];
  /** For catalog_pick: restrict to a category */
  category?: string;
  /** For 'group' (repeating group): the fields of each row */
  fields?: InputDef[];
  /** Show this input only when the formula is true */
  when?: string;
  /** Public in the instant-estimate widget */
  public?: boolean;
  /** Builder screen this input appears on (guided mode) */
  screen?: string;
}

export interface LineDef {
  id: string;
  label: string;
  /** Formula for quantity */
  qty: string;
  unit: UnitKind | string;
  /** Formula for unit price (money) */
  price: string;
  /** Include condition formula; default true */
  when?: string;
  cost?: string;
  frequency?: Frequency;
  taxable?: boolean;
  discountable?: boolean;
  visibility?: Visibility;
  /** Parent line id when visibility = 'rolled' */
  parent?: string;
  /** Named value this line owns (PRC-9): no other line may bill it */
  owns?: string;
  /** Catalog category for tax rules */
  category?: string;
  /** Repeat this line per row of a repeating input group */
  each?: string;
}

export interface GroupDef {
  id: string;
  label: string;
  lines: LineDef[];
  when?: string;
}

/** Built-in blocks (PRC-10). Expanded into groups/lines at compile time. */
export type BlockDef =
  | { block: 'labor'; id: string; label?: string; input: string }
  | { block: 'travel'; id: string; label?: string; legsInput: string }
  | { block: 'lodging'; id: string; label?: string; nights: string; rate?: string }
  | { block: 'per_diem'; id: string; label?: string; days: string; rate?: string }
  | { block: 'asset_service'; id: string; label?: string; input: string }
  | { block: 'parts'; id: string; label?: string; input: string }
  | { block: 'recurring'; id: string; label?: string; price: string; frequency: Frequency; term: string }
  | { block: 'fixed_fee'; id: string; label: string; amount: string }
  | { block: 'custom_lines'; id: string; label?: string; input: string };

export interface OptionDef {
  key: string;
  label: string;
  description?: string;
  /** Parameters readable in formulas as option.<name> */
  params: Record<string, string | number | boolean>;
}

export interface AddonDef {
  key: string;
  label: string;
  description?: string;
  /** Formula for the add-on amount (money), computed and frozen at send time */
  amount: string;
  frequency?: Frequency;
  defaultSelected?: boolean;
  taxable?: boolean;
}

export interface ContentBlockDef {
  id: string;
  kind: 'text' | 'cards' | 'image';
  title?: string;
  body?: string;
  cards?: { title: string; body: string }[];
  imageFileId?: string;
}

export interface TemplateDoc {
  key: string;
  name: string;
  description?: string;
  inputs: InputDef[];
  /** Named intermediate values: name -> formula */
  values?: Record<string, string>;
  groups?: GroupDef[];
  blocks?: BlockDef[];
  options?: OptionDef[];
  addons?: AddonDef[];
  discountOrder?: DiscountLevel[];
  rounding?: { lineStep?: string };
  allowNegativeTotal?: boolean;
  content?: ContentBlockDef[];
  /** Screens for guided mode, in order */
  screens?: { id: string; title: string }[];
}

/** Opaque to callers. JSON-serializable so it can be stored with the template version. */
export interface CompiledTemplate {
  engineVersion: string;
  doc: TemplateDoc;
  /** implementation-defined; JSON-serializable */
  program: unknown;
}

export type CompileResult =
  | { ok: true; compiled: CompiledTemplate; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] };

// ---------- pricing context (supplied by the caller; the engine never fetches) ----------

export interface RateValue {
  value: string;
  unit: UnitKind | string;
  currency?: string;
}

export interface CatalogItemCtx {
  id: string;
  sku: string;
  name: string;
  unit: UnitKind | string;
  /** price in the quote currency */
  price: string;
  cost?: string;
  frequency: Frequency;
  taxable: boolean;
  category?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface LaborRoleCtx {
  id: string;
  name: string;
  hourly: string;
  daily: string;
  overtimeMultiplier: string;
  travelTimeMultiplier: string;
  lodging: boolean;
  perDiem: boolean;
}

export interface RateContext {
  currency: string;
  /** minor units for rounding, e.g. 2 for USD, 0 for JPY */
  currencyDecimals: number;
  region: string;
  distanceUnit: 'km' | 'mi';
  /** ISO date the quote is priced for; the engine has no clock */
  today: string;
  rates: Record<string, RateValue>;
  catalog: Record<string, CatalogItemCtx>;
  laborRoles: Record<string, LaborRoleCtx>;
  calendar: { workdays: number[]; holidays: string[] };
  entity: Record<string, string | number | boolean>;
  customer: Record<string, string | number | boolean>;
  site: Record<string, string | number | boolean>;
  quote: Record<string, string | number | boolean>;
  tax: { rate: string; label: string; taxableCategories: string[] | 'all' } | null;
  taxExempt: boolean;
  /** Customer price agreement: category -> percent off, or item id -> price */
  agreements?: { categoryPercent: Record<string, string>; itemPrice: Record<string, string> };
  /** lookup tables usable via lookup(table, key) */
  tables?: Record<string, Record<string, string | number>>;
}

// ---------- quote inputs ----------

export interface DiscountInput {
  level: DiscountLevel;
  /** line id for level 'line', option key for 'option', omitted for 'quote' */
  target?: string;
  kind: 'percent' | 'amount';
  value: string;
  reason?: string;
}

export interface OverrideInput {
  /** 'rate.<name>' | 'line.<lineId>.price' | 'line.<lineId>.qty' */
  target: string;
  value: string;
  reason?: string;
}

export interface QuoteInputs {
  values: Record<string, unknown>;
  discounts?: DiscountInput[];
  overrides?: OverrideInput[];
  /** add-on keys the rep pre-selects */
  addons?: string[];
}

// ---------- results ----------

export interface TraceNode {
  id: string;
  /** e.g. "line travel.lodging amount" */
  label: string;
  formula?: string;
  inputs: { name: string; value: string; unit?: string }[];
  value: string;
  unit?: string;
  note?: string;
}

export interface LineResult {
  id: string;
  groupId: string;
  label: string;
  qty: string;
  unit: string;
  unitPrice: string;
  /** qty x unitPrice, rounded, before discounts */
  gross: string;
  discount: string;
  /** gross - discount */
  net: string;
  cost?: string;
  frequency: Frequency;
  taxable: boolean;
  discountable: boolean;
  visibility: Visibility;
  parent?: string;
  overridden: boolean;
  traceId: string;
}

export interface GroupResult {
  id: string;
  label: string;
  lines: LineResult[];
  subtotal: string;
}

export interface DiscountStep {
  level: DiscountLevel;
  target?: string;
  kind: 'percent' | 'amount';
  value: string;
  amount: string;
  before: string;
  after: string;
}

export interface Totals {
  oneTime: string;
  monthly: string;
  quarterly: string;
  yearly: string;
  /** full value over the recurring term(s) plus one-time */
  contract: string;
  discount: string;
  tax: string;
  /** grand total due = oneTime net + first-period recurring is NOT assumed; total = contract + tax */
  total: string;
  cost?: string;
  margin?: string;
  marginPercent?: string;
}

export interface OptionResult {
  key: string;
  label: string;
  groups: GroupResult[];
  discounts: DiscountStep[];
  totals: Totals;
}

export interface AddonResult {
  key: string;
  label: string;
  amount: string;
  frequency: Frequency;
  taxable: boolean;
  selected: boolean;
}

export interface PriceResult {
  ok: boolean;
  errors: Issue[];
  engineVersion: string;
  currency: string;
  /** Always at least one option; templates without options get a single 'default' option */
  options: OptionResult[];
  addons: AddonResult[];
  trace: TraceNode[];
  /** overrides actually applied (for approval rules, PRC-14) */
  overridesApplied: OverrideInput[];
  /** largest total discount percent across options, as a decimal string ("12.5") */
  maxDiscountPercent: string;
  /** smallest margin percent across options when cost is known */
  minMarginPercent?: string;
  /** evaluation steps used (SEC-7) */
  steps: number;
}

// ---------- pricing examples (CHK) ----------

export interface PricingExample {
  id: string;
  name: string;
  inputs: QuoteInputs;
  context: RateContext;
  /** expected: option key -> { line id -> net, total -> total } */
  expected: Record<string, { lines: Record<string, string>; total: string }>;
}

export interface ExampleResult {
  id: string;
  name: string;
  pass: boolean;
  diffs: { option: string; target: string; expected: string; actual: string }[];
  errors: Issue[];
}

// ---------- limits (SEC-7) ----------

export const LIMITS = {
  maxFormulaNodes: 500,
  maxSteps: 50_000,
  maxInputBytes: 1_000_000,
} as const;
