/**
 * Thin typed wrapper over Durable Object SQLite (ctx.storage.sql).
 * - all/one/run/value for queries; tx() for atomic multi-statement work (transactionSync).
 * - Counts rows read/written so the usage page can report them (ADM-1).
 * - JSON helpers: j() to stringify params, parse<T>() to read JSON columns.
 */
export type SqlValue = string | number | null | ArrayBuffer | Uint8Array;
export type Row = Record<string, SqlValue>;

export class Db {
  rowsRead = 0;
  rowsWritten = 0;
  constructor(
    private sql: SqlStorage,
    private storage: DurableObjectStorage,
  ) {}

  all<T = Row>(query: string, ...params: SqlValue[]): T[] {
    const cur = this.sql.exec(query, ...params);
    const rows = cur.toArray() as unknown as T[];
    this.rowsRead += cur.rowsRead;
    this.rowsWritten += cur.rowsWritten;
    return rows;
  }

  one<T = Row>(query: string, ...params: SqlValue[]): T | null {
    const rows = this.all<T>(query, ...params);
    return rows[0] ?? null;
  }

  /** First column of the first row */
  value<T = SqlValue>(query: string, ...params: SqlValue[]): T | null {
    const cur = this.sql.exec(query, ...params);
    const raw = [...cur.raw()];
    this.rowsRead += cur.rowsRead;
    this.rowsWritten += cur.rowsWritten;
    const first = raw[0];
    return first ? ((first[0] ?? null) as T) : null;
  }

  run(query: string, ...params: SqlValue[]): { rowsWritten: number } {
    const cur = this.sql.exec(query, ...params);
    // drain so the statement fully executes
    cur.toArray();
    this.rowsRead += cur.rowsRead;
    this.rowsWritten += cur.rowsWritten;
    return { rowsWritten: cur.rowsWritten };
  }

  /** Run fn atomically. Throwing inside rolls everything back. */
  tx<T>(fn: () => T): T {
    return this.storage.transactionSync(fn);
  }

  /** Execute a multi-statement script (migrations only). */
  exec(script: string): void {
    const cur = this.sql.exec(script);
    cur.toArray();
    this.rowsWritten += cur.rowsWritten;
  }

  get databaseSize(): number {
    return this.sql.databaseSize;
  }

  resetCounters(): { rowsRead: number; rowsWritten: number } {
    const out = { rowsRead: this.rowsRead, rowsWritten: this.rowsWritten };
    this.rowsRead = 0;
    this.rowsWritten = 0;
    return out;
  }
}

/** Stringify a value for a JSON column. */
export const j = (v: unknown): string => JSON.stringify(v ?? null);

/** Parse a JSON column; returns fallback on null/invalid. */
export function parse<T>(v: SqlValue | undefined, fallback: T): T {
  if (typeof v !== 'string') return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** SQLite boolean helpers */
export const b = (v: boolean | undefined | null): number => (v ? 1 : 0);
export const isTrue = (v: SqlValue | undefined): boolean => v === 1 || v === '1';
