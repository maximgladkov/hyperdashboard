const WS_URL = "wss://api.hyperliquid.xyz/ws";
const PING_MS = 30 * 1000;
const STALE_MS = 20 * 1000;
const WATCHDOG_MS = 5 * 1000;
const MAX_BACKOFF_MS = 30 * 1000;

type Subscription = Record<string, unknown>;
type Handler = (data: unknown) => void;
type WsMessage = { channel?: string; data?: unknown };

type Entry = {
  subscription: Subscription;
  handlers: Set<Handler>;
};

class HyperliquidSocket {
  private ws: WebSocket | null = null;
  private entries = new Map<string, Entry>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private backoff = 1000;
  private lastMessageAt = 0;
  private lifecycleBound = false;

  subscribe(subscription: Subscription, handler: Handler): () => void {
    const key = JSON.stringify(subscription);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { subscription, handlers: new Set() };
      this.entries.set(key, entry);
      this.ensureConnection();
      this.sendSub(subscription);
    }
    entry.handlers.add(handler);
    return () => {
      const current = this.entries.get(key);
      if (!current) return;
      current.handlers.delete(handler);
      if (current.handlers.size === 0) {
        this.entries.delete(key);
        this.sendUnsub(subscription);
        if (this.entries.size === 0) this.teardown();
      }
    };
  }

  private ensureConnection() {
    if (typeof window === "undefined") return;
    this.bindLifecycle();
    this.startWatchdog();
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.connect();
  }

  private connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.lastMessageAt = Date.now();
    this.ws.onopen = () => {
      this.backoff = 1000;
      this.lastMessageAt = Date.now();
      for (const entry of this.entries.values()) this.sendSub(entry.subscription);
      this.startPing();
    };
    this.ws.onmessage = (ev) => this.handleMessage(ev);
    this.ws.onclose = () => {
      this.stopPing();
      this.ws = null;
      if (this.entries.size) this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      try {
        this.ws?.close();
      } catch {}
    };
  }

  private bindLifecycle() {
    if (this.lifecycleBound || typeof window === "undefined") return;
    this.lifecycleBound = true;
    const wake = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      this.checkAlive(true);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
  }

  private startWatchdog() {
    if (this.watchdogTimer || typeof window === "undefined") return;
    this.watchdogTimer = setInterval(() => this.checkAlive(false), WATCHDOG_MS);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private checkAlive(immediate: boolean) {
    if (!this.entries.size) return;
    const state = this.ws?.readyState;
    if (state === WebSocket.OPEN) {
      if (this.lastMessageAt && Date.now() - this.lastMessageAt > STALE_MS) this.reconnect();
    } else if (state !== WebSocket.CONNECTING) {
      if (immediate) this.reconnect();
      else if (!this.reconnectTimer) this.connect();
    }
  }

  private reconnect() {
    const socket = this.ws;
    this.ws = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      try {
        socket.close();
      } catch {}
    }
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.backoff = 1000;
    if (this.entries.size) this.connect();
  }

  private handleMessage(ev: MessageEvent) {
    this.lastMessageAt = Date.now();
    let msg: WsMessage;
    try {
      msg = JSON.parse(ev.data as string);
    } catch {
      return;
    }
    const channel = msg?.channel;
    if (!channel || channel === "subscriptionResponse" || channel === "pong" || channel === "error") return;
    const data = msg.data as { user?: string; coin?: string } | undefined;
    for (const entry of this.entries.values()) {
      const sub = entry.subscription as { type?: string; user?: string; coin?: string };
      if (sub.type !== channel) continue;
      if (sub.user && data?.user && sub.user.toLowerCase() !== data.user.toLowerCase()) continue;
      if (sub.coin && data?.coin && sub.coin !== data.coin) continue;
      for (const handler of entry.handlers) {
        try {
          handler(msg.data);
        } catch {}
      }
    }
  }

  private send(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  private sendSub(subscription: Subscription) {
    this.send({ method: "subscribe", subscription });
  }

  private sendUnsub(subscription: Subscription) {
    this.send({ method: "unsubscribe", subscription });
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send({ method: "ping" }), PING_MS);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.entries.size) this.connect();
    }, delay);
  }

  private teardown() {
    this.stopPing();
    this.stopWatchdog();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.backoff = 1000;
    const socket = this.ws;
    this.ws = null;
    try {
      socket?.close();
    } catch {}
  }
}

export const hlSocket = new HyperliquidSocket();
