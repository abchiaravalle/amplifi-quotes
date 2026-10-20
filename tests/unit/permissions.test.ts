import { describe, expect, it } from 'vitest';
import { ACTIONS, can, MATRIX, ROLES } from '../../src/shared/permissions';

describe('permission matrix (Appendix A)', () => {
  it('has a rule for every role on every action', () => {
    for (const a of ACTIONS) for (const r of ROLES) expect(MATRIX[a][r]).toBeDefined();
  });

  it('owner can do everything', () => {
    for (const a of ACTIONS) {
      expect(
        can({ role: 'owner', memberId: 'o', grants: { canOverridePrices: true, canSeeCost: true } }, a),
      ).toBe(true);
    }
  });

  it('viewer cannot change anything', () => {
    const writes = ACTIONS.filter((a) => !['quote.view', 'report.view', 'quote.see_cost'].includes(a));
    for (const a of writes) expect(can({ role: 'viewer', memberId: 'v' }, a)).toBe(false);
  });

  it('sales sees only own quotes unless team view is on', () => {
    const s = { role: 'sales' as const, memberId: 's1' };
    expect(can(s, 'quote.view', { recordOwnerId: 's1' })).toBe(true);
    expect(can(s, 'quote.view', { recordOwnerId: 's2' })).toBe(false);
    expect(can(s, 'quote.view', { recordOwnerId: 's2', settings: { salesSeeTeamQuotes: true } })).toBe(true);
  });

  it('approver cannot approve own quote unless allowed (APR-6)', () => {
    const a = { role: 'approver' as const, memberId: 'a1' };
    expect(can(a, 'quote.approve', { recordOwnerId: 'a1' })).toBe(false);
    expect(can(a, 'quote.approve', { recordOwnerId: 'x' })).toBe(true);
    expect(can(a, 'quote.approve', { recordOwnerId: 'a1', settings: { allowSelfApproval: true } })).toBe(
      true,
    );
  });

  it('if_allowed needs the grant', () => {
    expect(can({ role: 'sales', memberId: 's' }, 'quote.override_price')).toBe(false);
    expect(
      can({ role: 'sales', memberId: 's', grants: { canOverridePrices: true } }, 'quote.override_price'),
    ).toBe(true);
  });

  it('only the owner can export, restore, bill, grant support, delete', () => {
    for (const a of [
      'workspace.export',
      'backup.restore',
      'billing.manage',
      'support.grant',
      'workspace.delete',
    ] as const) {
      for (const r of ROLES) expect(can({ role: r, memberId: 'x' }, a)).toBe(r === 'owner');
    }
  });
});
