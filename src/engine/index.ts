/**
 * Pricing engine entry point. See types.ts for the contract.
 * Implementation lives in sibling modules; this file only re-exports.
 */
export * from './types';

import type {
  CompiledTemplate,
  CompileResult,
  ExampleResult,
  Issue,
  PriceResult,
  PricingExample,
  QuoteInputs,
  RateContext,
  TemplateDoc,
} from './types';

export const ENGINE_VERSION = '0.0.0-contract';

/** Parse, unit-check, order, and compile a template document. Never throws. */
export function compileTemplate(_doc: unknown): CompileResult {
  return {
    ok: false,
    errors: [{ code: 'not_implemented', message: 'engine not built yet', severity: 'error' }],
    warnings: [],
  };
}

/** Price a quote. Pure and deterministic. Never throws; problems come back in result.errors. */
export function priceQuote(
  _compiled: CompiledTemplate,
  _inputs: QuoteInputs,
  _ctx: RateContext,
): PriceResult {
  throw new Error('engine not built yet');
}

/** Run a template's pricing examples (CHK-1). */
export function runExamples(_compiled: CompiledTemplate, _examples: PricingExample[]): ExampleResult[] {
  throw new Error('engine not built yet');
}

/** Built-in invariant checks over priced examples (CHK-4). */
export function checkInvariants(_compiled: CompiledTemplate, _result: PriceResult): Issue[] {
  throw new Error('engine not built yet');
}

/** Validate a single formula for the editor (line/column errors). */
export function checkFormula(_formula: string): Issue[] {
  throw new Error('engine not built yet');
}

/** Canonical JSON (sorted keys) used for hashing frozen revisions and parity checks. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .map((k) => [k, sortKeys(o[k])]),
    );
  }
  return v;
}

export type { TemplateDoc };
