import type { Hono } from 'hono';
import type { AppEnv, WsCtx } from '../app/types';

/**
 * A workstream module. Each workstream owns ONE module file listed below and adds routes, job
 * handlers, outbox senders and event subscribers from its init/routes functions.
 */
export interface Module {
  name: string;
  /** Called once per Durable Object start, before any request. Register jobs/senders/events here. */
  init?(ws: WsCtx): void;
  /** Register HTTP routes on the app. */
  routes(app: Hono<AppEnv>, ws: WsCtx): void;
}

import { authModule } from './auth';
import { commsModule } from './comms';
import { dataModule } from './data';
import { hostedModule } from './hosted';
import { integrationsModule } from './integrations';
import { platformModule } from './platform';
import { quotesModule } from './quotes';

export const MODULES: Module[] = [
  platformModule,
  authModule,
  dataModule,
  quotesModule,
  commsModule,
  integrationsModule,
  hostedModule,
];
