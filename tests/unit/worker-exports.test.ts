import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('worker main module', () => {
  it('exports only the default handler and Durable Object classes (workerd requirement)', () => {
    const src = readFileSync(new URL('../../src/worker/index.ts', import.meta.url), 'utf8');
    const named = [...src.matchAll(/^export (?:const|let|function|class|async function) (\w+)/gm)].map(
      (m) => m[1],
    );
    expect(named).toEqual([]);
    const reexports = [...src.matchAll(/^export \{ (\w+) \} from/gm)].map((m) => m[1]);
    expect(reexports.sort()).toEqual(['DirectoryDO', 'WorkspaceDO']);
  });
});
