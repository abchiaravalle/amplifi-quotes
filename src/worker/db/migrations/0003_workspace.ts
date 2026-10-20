/**
 * Migration slot 0003 (workspace). Owner: Workspace workstream (WS, CUS, IMP-1/2).
 * Add ALTER TABLE / CREATE TABLE / CREATE INDEX statements to `sql` if this workstream needs schema
 * changes beyond 0001. Never edit 0001. Never renumber. Empty sql = no-op.
 */
export const m0003 = { version: 3, name: 'workspace', sql: '' };
