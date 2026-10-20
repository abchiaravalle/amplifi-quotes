import type { Clock } from '../app/types';
import type { Db } from '../db/sql';

/** Typed workspace settings stored in the `settings` table (one row per key, JSON value). */
export interface SettingsShape {
  'workspace.name': string;
  'workspace.timezone': string;
  'workspace.currency': string;
  'workspace.language': string;
  'workspace.setupComplete': boolean;
  'workspace.ownerClaimedWithCode': string; // sha256 of the SETUP_CODE used to claim (DEP-8 detects change)
  'workspace.numberFormat': string; // e.g. "Q-{YYYY}-{SEQ:4}"
  'workspace.numberSeq': number;
  'workspace.validityDays': number;
  'workspace.salesSeeTeamQuotes': boolean;
  'workspace.allowSelfApproval': boolean;
  'workspace.calendar': { workdays: number[]; holidays: string[] };
  'workspace.testMode': { enabled: boolean; address: string };
  branding: {
    logoFileId: string | null;
    primary: string;
    accent: string;
    font: 'inter' | 'source-sans' | 'ibm-plex' | 'lora' | 'merriweather' | 'work-sans';
    address: string;
    footer: string;
    previewFileId: string | null;
  };
  'email.provider': 'none' | 'cloudflare' | 'resend' | 'smtp2go' | 'postmark' | 'ses';
  'email.from': { name: string; address: string };
  'email.verifyBeforeAccept': boolean;
  'auth.oidc': {
    google?: { clientId: string; allowedDomains: string[] };
    microsoft?: { clientId: string; tenant: string; allowedDomains: string[] };
  };
  'fx.autoFetch': boolean;
  'maps.provider': 'none' | 'mapbox' | 'google';
  'updates.check': boolean;
  'updates.autoMerge': boolean;
  'pdf.layout': {
    pageSize: 'letter' | 'a4';
    logoPosition: 'left' | 'right';
    showUnitPrices: boolean;
    showLineDetail: boolean;
  };
  'backups.r2Nightly': boolean;
  'widget.enabled': boolean;
  'widget.dailyCap': number;
  'ai.enabled': boolean;
  'ai.monthlyCap': number;
  'chat.webhooks': { slack?: string; teams?: string; events: string[] };
}

export const DEFAULT_SETTINGS: SettingsShape = {
  'workspace.name': '',
  'workspace.timezone': 'UTC',
  'workspace.currency': 'USD',
  'workspace.language': 'en',
  'workspace.setupComplete': false,
  'workspace.ownerClaimedWithCode': '',
  'workspace.numberFormat': 'Q-{YYYY}-{SEQ:4}',
  'workspace.numberSeq': 0,
  'workspace.validityDays': 30,
  'workspace.salesSeeTeamQuotes': false,
  'workspace.allowSelfApproval': false,
  'workspace.calendar': { workdays: [1, 2, 3, 4, 5], holidays: [] },
  'workspace.testMode': { enabled: false, address: '' },
  branding: {
    logoFileId: null,
    primary: '#1c2024',
    accent: '#00a86b',
    font: 'inter',
    address: '',
    footer: '',
    previewFileId: null,
  },
  'email.provider': 'none',
  'email.from': { name: '', address: '' },
  'email.verifyBeforeAccept': false,
  'auth.oidc': {},
  'fx.autoFetch': false,
  'maps.provider': 'none',
  'updates.check': false,
  'updates.autoMerge': false,
  'pdf.layout': { pageSize: 'letter', logoPosition: 'left', showUnitPrices: true, showLineDetail: true },
  'backups.r2Nightly': false,
  'widget.enabled': false,
  'widget.dailyCap': 500,
  'ai.enabled': false,
  'ai.monthlyCap': 200,
  'chat.webhooks': { events: [] },
};

export type SettingKey = keyof SettingsShape;

export class Settings {
  private cache = new Map<string, unknown>();
  constructor(
    private db: Db,
    private clock: Clock,
  ) {}

  get<K extends SettingKey>(key: K): SettingsShape[K] {
    if (this.cache.has(key)) return this.cache.get(key) as SettingsShape[K];
    const raw = this.db.value<string>('SELECT value FROM settings WHERE key=?', key);
    const v = raw == null ? DEFAULT_SETTINGS[key] : (JSON.parse(raw) as SettingsShape[K]);
    this.cache.set(key, v);
    return v;
  }

  set<K extends SettingKey>(key: K, value: SettingsShape[K], by: string | null = null): void {
    this.db.run(
      `INSERT INTO settings(key,value,updated_at,updated_by) VALUES (?,?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by`,
      key,
      JSON.stringify(value),
      this.clock.now(),
      by,
    );
    this.cache.set(key, value);
  }

  /** Call after a rollback or restore */
  clearCache(): void {
    this.cache.clear();
  }
}
