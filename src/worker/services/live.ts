/**
 * Live updates over hibernating WebSockets (NTF-1, QB-7). No polling anywhere in the app.
 * Each socket is tagged with "member:<id>" and optionally "quote:<id>" (presence).
 */
export interface LiveMessage {
  type: string;
  [k: string]: unknown;
}

export class Live {
  constructor(private state: DurableObjectState) {}

  /** Accept a WebSocket for a member (hibernation API). */
  accept(ws: WebSocket, memberId: string, memberName: string): void {
    this.state.acceptWebSocket(ws, [`member:${memberId}`]);
    ws.serializeAttachment({ memberId, memberName, quoteId: null as string | null });
  }

  /** Send to every open socket of one member. */
  toMember(memberId: string, msg: LiveMessage): number {
    return this.send(this.state.getWebSockets(`member:${memberId}`), msg);
  }

  /** Send to everyone in the workspace. */
  broadcast(msg: LiveMessage): number {
    return this.send(this.state.getWebSockets(), msg);
  }

  /** Send to everyone viewing a quote (presence). */
  toQuote(quoteId: string, msg: LiveMessage, exceptMemberId?: string): number {
    const sockets = this.state.getWebSockets().filter((ws) => {
      const a = ws.deserializeAttachment() as { memberId: string; quoteId: string | null } | null;
      return a?.quoteId === quoteId && a.memberId !== exceptMemberId;
    });
    return this.send(sockets, msg);
  }

  /** Who is viewing a quote right now */
  viewers(quoteId: string): { memberId: string; memberName: string }[] {
    const seen = new Map<string, string>();
    for (const ws of this.state.getWebSockets()) {
      const a = ws.deserializeAttachment() as {
        memberId: string;
        memberName: string;
        quoteId: string | null;
      } | null;
      if (a?.quoteId === quoteId) seen.set(a.memberId, a.memberName);
    }
    return [...seen].map(([memberId, memberName]) => ({ memberId, memberName }));
  }

  /** Handle an inbound client message. Supported: {type:'watch', quoteId} / {type:'unwatch'} / {type:'ping'} */
  onMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let msg: { type?: string; quoteId?: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const a = (ws.deserializeAttachment() ?? {}) as {
      memberId: string;
      memberName: string;
      quoteId: string | null;
    };
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    if (msg.type === 'watch' && typeof msg.quoteId === 'string') {
      const prev = a.quoteId;
      a.quoteId = msg.quoteId;
      ws.serializeAttachment(a);
      if (prev && prev !== msg.quoteId)
        this.toQuote(prev, { type: 'presence', quoteId: prev, viewers: this.viewers(prev) });
      this.toQuote(msg.quoteId, {
        type: 'presence',
        quoteId: msg.quoteId,
        viewers: this.viewers(msg.quoteId),
      });
      return;
    }
    if (msg.type === 'unwatch' && a.quoteId) {
      const prev = a.quoteId;
      a.quoteId = null;
      ws.serializeAttachment(a);
      this.toQuote(prev, { type: 'presence', quoteId: prev, viewers: this.viewers(prev) });
    }
  }

  onClose(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as { quoteId: string | null } | null;
    if (a?.quoteId) {
      const q = a.quoteId;
      a.quoteId = null;
      ws.serializeAttachment(a);
      this.toQuote(q, { type: 'presence', quoteId: q, viewers: this.viewers(q) });
    }
  }

  private send(sockets: WebSocket[], msg: LiveMessage): number {
    const data = JSON.stringify(msg);
    let n = 0;
    for (const ws of sockets) {
      try {
        ws.send(data);
        n++;
      } catch {
        // socket closing; ignore
      }
    }
    return n;
  }
}
