// Browser-only EventSub: a public client ID is fine; client secrets never belong here.
export class TwitchConnection {
  constructor({ onChat = () => {}, onStatus = () => {}, onModeration = () => {} } = {}) {
    this.onChat = onChat; this.onStatus = onStatus; this.onModeration = onModeration;
    this.generation = 0; this.sockets = new Set(); this.seen = new Set();
  }
  async connect({ token, clientId, channel }) {
    this.disconnect(false);
    const generation = this.generation;
    channel = String(channel).trim().toLowerCase().replace(/^#/, '');
    if (!/^[a-z0-9_]{1,25}$/.test(channel)) throw new Error('Enter a valid Twitch channel name.');
    token = String(token).trim().replace(/^oauth:/, '');
    if (!token) throw new Error('Add a user access token, or sign in with Twitch.');
    this.onStatus('connecting', 'Validating Twitch authorization…');
    const auth = await this.validate(token);
    if (generation !== this.generation) return;
    if (!auth.user_id) throw new Error('Use a user access token, rather than an application access token.');
    if (!auth.scopes?.includes('user:read:chat')) throw new Error('The token needs the user:read:chat permission. Sign in again with that scope.');
    if (clientId && auth.client_id !== clientId.trim()) throw new Error('This token belongs to a different Twitch app. Check the client ID.');
    this.token = token; this.clientId = auth.client_id; this.userId = auth.user_id; this.channel = channel;
    const response = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`, { headers: this.headers() });
    if (!response.ok) throw new Error('Could not look up that Twitch channel. Check your authorization.');
    const data = await response.json();
    if (generation !== this.generation) return;
    if (!data.data?.[0]) throw new Error('That Twitch channel was not found.');
    this.broadcasterId = data.data[0].id;
    this.retries = 0;
    this.open('wss://eventsub.wss.twitch.tv/ws', false, generation);
    this.authCheck = setInterval(async () => {
      try { await this.validate(this.token); } catch { if (generation === this.generation) this.fail('Twitch authorization expired. Reconnect to continue.'); }
    }, 60 * 60 * 1000);
    this.watchdog = setInterval(() => {
      if (this.current && Date.now() - this.lastMessage > this.keepalive * 1000 + 6000) this.current.close();
    }, 3000);
  }
  headers() { return { Authorization: `Bearer ${this.token}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json' }; }
  async validate(token) {
    const response = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
    if (!response.ok) throw new Error('Twitch could not validate that access token. Sign in again.');
    return response.json();
  }
  async subscribe(sessionId, generation) {
    // Moderation events remove deleted messages from the current ballot as well.
    for (const type of ['channel.chat.message', 'channel.chat.message_delete', 'channel.chat.clear_user_messages', 'channel.chat.clear']) {
      if (generation !== this.generation) return;
      const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST', headers: this.headers(),
        body: JSON.stringify({ type, version: '1', condition: { broadcaster_user_id: this.broadcasterId, user_id: this.userId }, transport: { method: 'websocket', session_id: sessionId } }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(response.status === 401 ? 'Twitch authorization expired. Sign in again.' : `Twitch could not subscribe to ${type}: ${String(body.message || response.status).slice(0, 180)}`);
      }
    }
  }
  open(url, transferred, generation) {
    if (generation !== this.generation) return;
    const socket = new WebSocket(url);
    this.sockets.add(socket);
    let welcomed = false;
    const welcomeTimeout = setTimeout(() => { if (!welcomed) socket.close(); }, 15000);
    socket.onmessage = async message => {
      if (generation !== this.generation) return;
      let data;
      try { data = JSON.parse(message.data); } catch { return; }
      this.lastMessage = Date.now();
      const type = data.metadata?.message_type;
      if (type === 'session_welcome') {
        welcomed = true; clearTimeout(welcomeTimeout);
        const old = this.current;
        this.current = socket;
        this.keepalive = data.payload?.session?.keepalive_timeout_seconds || 10;
        try {
          if (!transferred) await this.subscribe(data.payload.session.id, generation);
          if (generation !== this.generation || socket.readyState !== WebSocket.OPEN) return;
          this.retries = 0;
          if (old && old !== socket) old.close();
          this.onStatus('connected', `Listening to #${this.channel}`);
        } catch (error) { if (generation === this.generation) this.fail(error.message); }
      } else if (type === 'session_reconnect') {
        const next = data.payload?.session?.reconnect_url;
        try {
          const parsed = new URL(next);
          if (parsed.protocol !== 'wss:' || parsed.hostname !== 'eventsub.wss.twitch.tv') throw new Error();
          this.onStatus('reconnecting', 'Twitch is moving this connection…');
          this.open(next, true, generation);
        } catch { this.fail('Twitch supplied an invalid reconnect address. Please reconnect.'); }
      } else if (type === 'revocation') {
        this.fail('Twitch revoked this chat connection. Sign in again.');
      } else if (type === 'notification') {
        const id = data.metadata.message_id;
        if (!id || this.seen.has(id)) return;
        this.seen.add(id);
        if (this.seen.size > 2000) this.seen.delete(this.seen.values().next().value);
        const event = data.payload?.event;
        if (!event || event.broadcaster_user_id !== this.broadcasterId) return;
        const subscription = data.payload.subscription?.type;
        if (subscription === 'channel.chat.message') {
          this.onChat({ id: event.message_id, userId: event.chatter_user_id, name: event.chatter_user_name, text: event.message?.text || '' });
        } else this.onModeration(subscription, event);
      }
    };
    socket.onclose = () => {
      clearTimeout(welcomeTimeout); this.sockets.delete(socket);
      if (generation !== this.generation || (this.current && this.current !== socket)) return;
      this.current = null;
      if (++this.retries > 5) { this.fail('Twitch connection lost. Reconnect when your network is ready.'); return; }
      this.onStatus('reconnecting', 'Chat connection interrupted. Retrying…');
      this.retryTimer = setTimeout(() => this.open('wss://eventsub.wss.twitch.tv/ws', false, generation), Math.min(1000 * 2 ** this.retries, 30000));
    };
    socket.onerror = () => {}; // onclose owns recovery and avoids duplicate retries.
  }
  fail(message) { this.disconnect(false); this.onStatus('error', message); }
  disconnect(notify = true) {
    this.generation++;
    clearTimeout(this.retryTimer); clearInterval(this.authCheck); clearInterval(this.watchdog);
    for (const socket of this.sockets) socket.close();
    this.sockets.clear(); this.current = null; this.token = null; this.seen.clear();
    if (notify) this.onStatus('disconnected', 'Local lab');
  }
}
