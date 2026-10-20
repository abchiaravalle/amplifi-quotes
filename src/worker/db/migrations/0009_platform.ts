/**
 * Migration slot 0009 (platform). Owner: Platform workstream (UPD, ADM, BAK, IMP-3/4).
 * Add ALTER TABLE / CREATE TABLE / CREATE INDEX statements to `sql` if this workstream needs schema
 * changes beyond 0001. Never edit 0001. Never renumber. Empty sql = no-op.
 */
export const m0009 = { version: 9, name: 'platform', sql: '' };
