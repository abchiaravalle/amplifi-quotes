/**
 * Appendix A of the spec, as data. The backend enforces it and tests are generated from it (TST-3).
 * Change this file and the spec together.
 */

export const ROLES = ['owner', 'admin', 'pricing_editor', 'approver', 'sales', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Rule values:
 *  - 'yes'        always allowed
 *  - 'no'         never allowed
 *  - 'own'        allowed on records the member owns
 *  - 'own_team'   own, or all when the workspace setting `salesSeeTeamQuotes` is on
 *  - 'not_own'    allowed except on records the member owns (self-approval guard; overridable by setting)
 *  - 'if_allowed' allowed when the member has the matching per-member grant (e.g. `canOverridePrices`)
 */
export type Rule = 'yes' | 'no' | 'own' | 'own_team' | 'not_own' | 'if_allowed';

export const ACTIONS = [
  'quote.create',
  'quote.edit_draft',
  'quote.view',
  'quote.send',
  'quote.revise',
  'quote.change_order',
  'quote.withdraw',
  'quote.approve',
  'quote.override_price',
  'quote.see_cost',
  'catalog.edit',
  'template.edit',
  'template.accept_example_change',
  'customer.manage',
  'member.manage',
  'branding.edit',
  'integration.manage',
  'report.view',
  'audit.view',
  'workspace.export',
  'backup.restore',
  'billing.manage',
  'support.grant',
  'workspace.delete',
] as const;
export type Action = (typeof ACTIONS)[number];

type Row = Record<Role, Rule>;

const r = (
  owner: Rule,
  admin: Rule,
  pricing_editor: Rule,
  approver: Rule,
  sales: Rule,
  viewer: Rule,
): Row => ({ owner, admin, pricing_editor, approver, sales, viewer });

export const MATRIX: Record<Action, Row> = {
  'quote.create': r('yes', 'yes', 'yes', 'yes', 'yes', 'no'),
  'quote.edit_draft': r('yes', 'yes', 'own', 'yes', 'own', 'no'),
  'quote.view': r('yes', 'yes', 'yes', 'yes', 'own_team', 'yes'),
  'quote.send': r('yes', 'yes', 'own', 'yes', 'own', 'no'),
  'quote.revise': r('yes', 'yes', 'own', 'yes', 'own', 'no'),
  'quote.change_order': r('yes', 'yes', 'no', 'no', 'no', 'no'),
  'quote.withdraw': r('yes', 'yes', 'own', 'yes', 'own', 'no'),
  'quote.approve': r('yes', 'yes', 'no', 'not_own', 'no', 'no'),
  'quote.override_price': r('yes', 'yes', 'yes', 'yes', 'if_allowed', 'no'),
  'quote.see_cost': r('yes', 'yes', 'yes', 'if_allowed', 'if_allowed', 'if_allowed'),
  'catalog.edit': r('yes', 'yes', 'yes', 'no', 'no', 'no'),
  'template.edit': r('yes', 'yes', 'yes', 'no', 'no', 'no'),
  'template.accept_example_change': r('yes', 'yes', 'yes', 'no', 'no', 'no'),
  'customer.manage': r('yes', 'yes', 'yes', 'yes', 'yes', 'no'),
  'member.manage': r('yes', 'yes', 'no', 'no', 'no', 'no'),
  'branding.edit': r('yes', 'yes', 'no', 'no', 'no', 'no'),
  'integration.manage': r('yes', 'yes', 'no', 'no', 'no', 'no'),
  'report.view': r('yes', 'yes', 'yes', 'yes', 'own', 'yes'),
  'audit.view': r('yes', 'yes', 'no', 'no', 'no', 'no'),
  'workspace.export': r('yes', 'no', 'no', 'no', 'no', 'no'),
  'backup.restore': r('yes', 'no', 'no', 'no', 'no', 'no'),
  'billing.manage': r('yes', 'no', 'no', 'no', 'no', 'no'),
  'support.grant': r('yes', 'no', 'no', 'no', 'no', 'no'),
  'workspace.delete': r('yes', 'no', 'no', 'no', 'no', 'no'),
};

/** Per-member grants that unlock 'if_allowed' cells. */
export const GRANT_FOR: Partial<Record<Action, 'canOverridePrices' | 'canSeeCost'>> = {
  'quote.override_price': 'canOverridePrices',
  'quote.see_cost': 'canSeeCost',
};

export interface Subject {
  role: Role;
  memberId: string;
  grants?: { canOverridePrices?: boolean; canSeeCost?: boolean };
}

export interface PolicyContext {
  /** owner (member id) of the record being acted on, when the action targets a record */
  recordOwnerId?: string | null;
  settings?: { salesSeeTeamQuotes?: boolean; allowSelfApproval?: boolean };
}

/** Single decision function used by the server. Pure. */
export function can(subject: Subject, action: Action, ctx: PolicyContext = {}): boolean {
  const rule = MATRIX[action][subject.role];
  const isOwn = ctx.recordOwnerId != null && ctx.recordOwnerId === subject.memberId;
  switch (rule) {
    case 'yes':
      return true;
    case 'no':
      return false;
    case 'own':
      return ctx.recordOwnerId === undefined ? true : isOwn;
    case 'own_team':
      if (ctx.recordOwnerId === undefined) return true;
      return isOwn || ctx.settings?.salesSeeTeamQuotes === true;
    case 'not_own':
      if (ctx.recordOwnerId === undefined) return true;
      return !isOwn || ctx.settings?.allowSelfApproval === true;
    case 'if_allowed': {
      const grant = GRANT_FOR[action];
      return grant ? subject.grants?.[grant] === true : false;
    }
  }
}
