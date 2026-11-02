import test from 'node:test';
import assert from 'node:assert/strict';
import { TwitchConnection } from '../dist/twitch.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
class FakeSocket {
  static OPEN = 1;
  static all = [];
  constructor(url) { this.url = url; this.readyState = 1; FakeSocket.all.push(this); }
  close() { this.readyState = 3; this.onclose?.(); }
  async emit(type, payload, id = `message-${Math.random()}`) { await this.onmessage?.({ data: JSON.stringify({ metadata: { message_type: type, message_id: id }, payload }) }); }
}
function harness(t, options = {}) {
  FakeSocket.all = [];
  const calls = [], statuses = [], chats = [], moderation = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes('/validate')) return { ok: !options.invalid, json: async () => ({ client_id: 'test-client', user_id: 'user-1', scopes: options.scopes || ['user:read:chat'] }) };
    if (url.includes('/users?')) return { ok: true, json: async () => ({ data: options.noChannel ? [] : [{ id: 'broadcaster-1' }] }) };
    return { ok: !options.failSubscription, status: 403, json: async () => ({ message: 'denied' }) };
  });
  t.mock.property(globalThis, 'WebSocket', FakeSocket);
  const connection = new TwitchConnection({ onStatus: (status, text) => statuses.push({ status, text }), onChat: m => chats.push(m), onModeration: (type, event) => moderation.push({ type, event }) });
  t.after(() => connection.disconnect(false));
  return { connection, calls, statuses, chats, moderation };
}
async function connect(h) {
  await h.connection.connect({ token: 'test-token-not-a-real-credential', clientId: 'test-client', channel: 'my_channel' });
  const socket = FakeSocket.all.at(-1);
  await socket.emit('session_welcome', { session: { id: 'session-1', keepalive_timeout_seconds: 10 } });
  return socket;
}
test('Twitch setup validates the token and subscribes to chat and moderation', async t => {
  const h = harness(t); await connect(h);
  assert.equal(h.statuses.at(-1).status, 'connected');
  const subscriptions = h.calls.filter(c => c.init.method === 'POST').map(c => JSON.parse(c.init.body));
  assert.equal(subscriptions.length, 4);
  assert.equal(subscriptions[0].type, 'channel.chat.message');
  assert.deepEqual(subscriptions[0].condition, { broadcaster_user_id: 'broadcaster-1', user_id: 'user-1' });
  assert.ok(h.calls.every(c => new URL(c.url).hostname === 'api.twitch.tv' || new URL(c.url).hostname === 'id.twitch.tv'));
});
test('chat delivery deduplicates events and ignores unrelated channels', async t => {
  const h = harness(t), socket = await connect(h);
  const payload = { subscription: { type: 'channel.chat.message' }, event: { broadcaster_user_id: 'broadcaster-1', chatter_user_id: 'viewer-1', chatter_user_name: 'Ada', message_id: 'chat-1', message: { text: '!right' } } };
  await socket.emit('notification', payload, 'event-1'); await socket.emit('notification', payload, 'event-1');
  await socket.emit('notification', { ...payload, event: { ...payload.event, broadcaster_user_id: 'other' } }, 'event-2');
  assert.deepEqual(h.chats, [{ id: 'chat-1', userId: 'viewer-1', name: 'Ada', text: '!right' }]);
});
test('moderator message deletion is delivered to the ballot owner', async t => {
  const h = harness(t), socket = await connect(h);
  await socket.emit('notification', { subscription: { type: 'channel.chat.message_delete' }, event: { broadcaster_user_id: 'broadcaster-1', message_id: 'delete-me' } });
  assert.equal(h.moderation[0].type, 'channel.chat.message_delete');
  assert.equal(h.moderation[0].event.message_id, 'delete-me');
});
test('Twitch-directed reconnection transfers subscriptions rather than duplicating them', async t => {
  const h = harness(t), socket = await connect(h);
  await socket.emit('session_reconnect', { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect=test' } });
  const replacement = FakeSocket.all.at(-1);
  assert.notEqual(replacement, socket);
  await replacement.emit('session_welcome', { session: { id: 'session-2', keepalive_timeout_seconds: 10 } });
  assert.equal(h.calls.filter(c => c.init.method === 'POST').length, 4);
  assert.equal(socket.readyState, 3);
  assert.equal(h.connection.current, replacement);
});
test('reconnect URLs cannot send the connection to a different service', async t => {
  const h = harness(t), socket = await connect(h);
  await socket.emit('session_reconnect', { session: { reconnect_url: 'wss://malicious.example/ws' } });
  assert.equal(h.statuses.at(-1).status, 'error'); assert.equal(h.connection.token, null);
  assert.equal(FakeSocket.all.length, 1);
});
test('revocation closes all sockets and forgets authorization', async t => {
  const h = harness(t), socket = await connect(h);
  await socket.emit('revocation', {});
  assert.equal(h.connection.token, null); assert.equal(h.connection.sockets.size, 0);
  assert.equal(h.statuses.at(-1).status, 'error');
});
test('missing permissions, mismatched client IDs, nonexistent channels and invalid tokens fail clearly', async t => {
  for (const options of [{ scopes: ['chat:read'] }, { noChannel: true }, { invalid: true }]) {
    const h = harness(t, options);
    await assert.rejects(() => h.connection.connect({ token: 'test', clientId: 'test-client', channel: 'my_channel' }));
    h.connection.disconnect(false); t.mock.restoreAll();
  }
  const h = harness(t);
  await assert.rejects(() => h.connection.connect({ token: 'test', clientId: 'different-app', channel: 'my_channel' }), /different Twitch app/);
});
test('subscription failure does not report a live chat connection', async t => {
  const h = harness(t, { failSubscription: true }); await connect(h); await flush();
  assert.equal(h.statuses.at(-1).status, 'error');
  assert.equal(h.statuses.some(s => s.status === 'connected'), false);
  assert.equal(h.connection.token, null);
});
