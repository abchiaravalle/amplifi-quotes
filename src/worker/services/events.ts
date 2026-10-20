/**
 * In-process domain events. emit() runs subscribers synchronously, inside the caller's transaction,
 * so a quote status change and its notifications / outbox rows / report counters commit together.
 * Subscribers must not do network I/O; they enqueue outbox items instead.
 */
export interface EventMap {
  'quote.created': { quoteId: string; actorId: string };
  'quote.updated': { quoteId: string; actorId: string };
  'quote.status_changed': {
    quoteId: string;
    from: string;
    to: string;
    actorType: 'member' | 'customer' | 'system';
    actorId: string | null;
    revisionId?: string;
    reason?: string;
  };
  'quote.sent': { quoteId: string; revisionId: string; actorId: string };
  'quote.viewed': { quoteId: string; revisionId: string; first: boolean; afterGap: boolean };
  'quote.accepted': {
    quoteId: string;
    revisionId: string;
    acceptanceId: string;
    optionKey: string;
    total: string;
  };
  'quote.declined': { quoteId: string; revisionId: string; reason: string };
  'quote.expired': { quoteId: string };
  'quote.withdrawn': { quoteId: string; actorId: string };
  'quote.question': { quoteId: string; commentId: string; authorName: string };
  'quote.update_requested': { quoteId: string };
  'quote.mention': { quoteId: string; commentId: string; memberIds: string[]; actorId: string };
  'approval.requested': {
    quoteId: string;
    approvalId: string;
    reasons: string[];
    approverRole: string | null;
    approverMemberId: string | null;
  };
  'approval.decided': {
    quoteId: string;
    approvalId: string;
    decision: 'approved' | 'rejected';
    comment: string;
    actorId: string;
  };
  'member.invited': { inviteId: string; email: string; role: string; link: string; actorId: string };
  'member.removed': { memberId: string; reassignedTo: string; actorId: string };
  'auth.signin_link': { email: string; link: string };
  'auth.accept_code': { email: string; code: string; quoteId: string };
  'auth.reclaim_requested': { email: string; link: string };
  'usage.warning': { level: 70 | 90; metric: string; percent: number };

  // ---- auth workstream adds entries below this line ----

  // ---- workspace workstream adds entries below this line ----

  // ---- pricing workstream adds entries below this line ----

  // ---- quotes workstream adds entries below this line ----

  // ---- comms workstream adds entries below this line ----

  // ---- integrations workstream adds entries below this line ----

  // ---- hosted workstream adds entries below this line ----

  // ---- platform workstream adds entries below this line ----
}

export type EventName = keyof EventMap;
type Handler<K extends EventName> = (payload: EventMap[K]) => void;

export class Events {
  private subs = new Map<EventName, Handler<EventName>[]>();
  /** Last 200 emitted events, newest last. Memory only; used by tests (testEvents RPC). */
  readonly recent: { name: EventName; payload: unknown }[] = [];

  on<K extends EventName>(name: K, handler: Handler<K>): void {
    const list = this.subs.get(name) ?? [];
    list.push(handler as unknown as Handler<EventName>);
    this.subs.set(name, list);
  }

  emit<K extends EventName>(name: K, payload: EventMap[K]): void {
    this.recent.push({ name, payload });
    if (this.recent.length > 200) this.recent.shift();
    for (const h of this.subs.get(name) ?? []) h(payload as EventMap[EventName]);
  }
}
