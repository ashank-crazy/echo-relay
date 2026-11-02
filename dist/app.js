import { Game, Ballot, LEVELS, parseCommand } from './engine.js?v=1.0.2';
import { Scene } from './scene.js?v=1.0.2';
import { TwitchConnection } from './twitch.js?v=1.0.2';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const symbols = { up: '↑', right: '→', down: '↓', left: '←', wait: '·', rewind: '↶' };
const game = new Game();
const ballot = new Ballot();
const messageUsers = new Map();
const latestVoteMessage = new Map();
let mode = 'local', connected = false, running = false, beatDuration = 8000;
let deadline = 0, demoTimer = null, toastTimer, pendingConfirmation;
let soundOn = false, audio;
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* The lab still works when storage is disabled. */ } },
};

try {
  const saved = storage.get('echo-relay-capsule');
  if (saved) game.importCapsule(JSON.parse(saved));
} catch { /* Ignore a damaged or outdated save. */ }
const scene = new Scene($('#scene'), game);

function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
function beep(type = 'move') {
  if (!soundOn) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = type === 'win' ? [392, 493.88, 587.33, 783.99] : type === 'rewind' ? [587.33, 392, 261.63] : type === 'blocked' ? [146.83] : [293.66];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + i * .12;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .02); gain.gain.exponentialRampToValueAtTime(.001, start + .24);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + .25);
    });
  } catch { soundOn = false; $('#sound-toggle').setAttribute('aria-pressed', 'false'); $('#sound-toggle span').textContent = 'Sound off'; }
}
function remember() { storage.set('echo-relay-capsule', JSON.stringify(game.capsule())); }
function clearBallot() { ballot.clear(); messageUsers.clear(); latestVoteMessage.clear(); renderVotes(); }
function renderVotes() {
  const counts = ballot.tally();
  $$('[data-count]').forEach(el => { el.textContent = mode === 'local' ? '' : String(counts[el.dataset.count]); });
  const result = ballot.result();
  $$('[data-action]').forEach(el => el.classList.toggle('active', result.size > 0 && !result.tied && el.dataset.action === result.action));
}
function render() {
  $('#chamber-id').textContent = `CHAMBER ${String(game.levelIndex + 1).padStart(2, '0')}`;
  $('#chamber-name').textContent = game.level.name;
  $('#chamber-subtitle').textContent = game.level.subtitle;
  $('#loop-label').textContent = `LOOP ${String(game.loop).padStart(2, '0')}`;
  $('#briefing').textContent = game.level.briefing;
  $('#hint').textContent = game.level.hint;
  $('#turn-count').textContent = String(game.turn).padStart(2, '0');
  $('#turn-limit').textContent = game.level.limit;
  $('#position-label').textContent = `Present · X ${String(game.position.x).padStart(2, '0')} / Y ${String(game.position.y).padStart(2, '0')}`;
  $('#scene').setAttribute('aria-label', `${game.level.name}. Present robot at column ${game.position.x}, row ${game.position.y}. Beat ${game.turn} of ${game.level.limit}. ${game.echoes.length} recorded echoes. Active switches: ${game.activePlates().join(', ') || 'none'}.${game.won ? ' Chamber solved.' : ''}`);
  $('#level-select').value = String(game.levelIndex);
  const timeline = document.createDocumentFragment();
  for (let i = 0; i < game.level.limit; i++) {
    const el = document.createElement('span');
    el.className = 'timeline-cell';
    el.classList.toggle('filled', i < game.turn);
    el.classList.toggle('current', i === game.turn);
    el.classList.toggle('ghost-mark', game.echoes.some(e => i < e.path.length - 1));
    el.textContent = symbols[game.actions[i]] || '';
    el.title = `Beat ${i + 1}${game.actions[i] ? `: ${game.actions[i]}` : ''}`;
    timeline.append(el);
  }
  $('#timeline').replaceChildren(timeline);
  $('#echo-count').textContent = `${String(game.echoes.length).padStart(2, '0')} / 03`;
  const echoes = document.createDocumentFragment();
  if (!game.echoes.length) {
    const p = document.createElement('p'); p.className = 'empty-echo';
    p.append('Nobody here. Yet.', document.createElement('br'));
    const span = document.createElement('span'); span.textContent = 'Rewind to meet your first echo.'; p.append(span); echoes.append(p);
  }
  game.echoes.forEach(e => {
    const row = document.createElement('div'); row.className = 'echo-row';
    const dot = document.createElement('span'); dot.className = 'echo-color'; dot.style.background = e.color;
    const info = document.createElement('div'); info.className = 'echo-info';
    const label = document.createElement('b'); label.textContent = `Echo ${String(e.id).padStart(2, '0')}`;
    const path = document.createElement('span'); path.textContent = `${e.path.length - 1} beats · ${e.contributors.length || 1} ${e.contributors.length > 1 ? 'contributors' : 'contributor'}`;
    info.append(label, path);
    const state = document.createElement('span'); state.className = 'echo-state';
    const position = e.path[Math.min(game.turn, e.path.length - 1)];
    const plate = game.tileAt(position)?.type;
    state.textContent = /^[A-D]$/.test(plate) ? `ON ${plate}` : game.turn >= e.path.length - 1 ? 'HOLDING' : 'REPLAYING';
    row.append(dot, info, state); echoes.append(row);
  });
  $('#echo-list').replaceChildren(echoes);
  $('#win-overlay').hidden = !game.won;
  $('#win-caption').textContent = `${game.turn} beats. ${game.echoes.length} ${game.echoes.length === 1 ? 'echo' : 'echoes'}. One collective mind.`;
  $('#win-overlay h3').replaceChildren();
  const h = $('#win-overlay h3'); h.append('You had it in you.', document.createElement('br'));
  const em = document.createElement('em'); em.textContent = game.echoes.length > 1 ? `All ${game.echoes.length + 1} of you.` : 'Both of you.'; h.append(em);
  $('#next-level').textContent = game.levelIndex === LEVELS.length - 1 ? 'Run the experiment again ↶' : 'Enter the next chamber →';
  $('#event-message').textContent = game.lastEvent.text;
  $('#run-toggle').hidden = mode !== 'live';
  $('#run-toggle').textContent = running ? 'Pause the clock Ⅱ' : 'Start the clock ▶';
  $('#controls-label').textContent = mode === 'live' ? 'THE CROWD DECIDES' : mode === 'demo' ? 'DEMO VOTES · SIMULATED' : 'MAKE YOUR MOVE';
  $('#mode-label').textContent = mode === 'live' ? 'TWITCH LIVE' : mode === 'demo' ? 'DEMO PLAYBACK' : 'LOCAL PLAY';
  $('#control-note').textContent = mode === 'live' ? 'One viewer, one vote · ties become a wait' : mode === 'demo' ? 'Simulated voters · tap any move to take over' : 'Arrow keys to move · Space to wait · R to rewind';
  if (mode !== 'live') { $('#beat-clock').textContent = mode === 'demo' ? 'REPLAY' : 'YOUR TURN'; $('#beat-progress').style.width = '0%'; }
  $('#watch-demo').textContent = demoTimer ? 'Stop the demo ↶' : 'Watch the paradox ↗';
  renderVotes();
}
function apply(action, names = ['You']) {
  const event = game.step(action, names);
  if (event.type === 'ignored') { toast(event.text); return; }
  beep(event.type);
  if (game.won) { running = false; if (demoTimer) { clearInterval(demoTimer); demoTimer = null; } }
  remember(); render();
}
function pause() { running = false; clearBallot(); render(); }
function stopDemo() {
  clearInterval(demoTimer); demoTimer = null;
  if (mode === 'demo') {
    mode = connected ? 'live' : 'local';
    if (!connected) $('#connection-status').textContent = 'Local lab · no account needed';
  }
  clearBallot(); render();
}
function confirmChange(title, description, action) {
  $('#confirm-title').textContent = title; $('#confirm-description').textContent = description;
  pendingConfirmation = action; $('#confirm-dialog').showModal();
}
function askBeforeClearing(action, title = 'Start a fresh timeline?') {
  if (game.turn || game.echoes.length) confirmChange(title, 'This clears the current chamber’s route and echoes. Bottle the timeline first if you want to keep it.', action);
  else action();
}
function changeLevel(index) {
  stopDemo(); pause(); game.loadLevel(index); scene.animations.clear();
  $('#hint').hidden = true; $('#show-hint').setAttribute('aria-expanded', 'false');
  remember(); render();
}
function launchDemo() {
  twitch.disconnect(); connected = false;
  game.loadLevel(game.levelIndex); scene.animations.clear(); pause();
  mode = 'demo'; let index = 0;
  const script = game.level.demo;
  $('#connection-status').textContent = 'Guided demo · simulated chat, real game';
  $('#connection-dot').className = 'tiny-dot';
  const voters = ['Demo_Ada', 'Demo_Orbit', 'Demo_Moss', 'Demo_Loop', 'Demo_Nova'];
  demoTimer = setInterval(() => {
    if (index >= script.length || game.won) { clearInterval(demoTimer); demoTimer = null; render(); return; }
    clearBallot();
    voters.forEach((name, i) => ballot.vote(`demo-${i}`, script[index], name));
    const choice = ballot.result(); apply(choice.action, choice.names); index++;
  }, 1150);
  render(); $('#experiment').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function requestDemo() {
  if (demoTimer) { stopDemo(); return; }
  askBeforeClearing(launchDemo, 'Run the guided experiment?');
}

const twitch = new TwitchConnection({
  onChat(message) {
    if (mode !== 'live' || !running || game.won) return;
    const action = parseCommand(message.text);
    if (!action) return;
    ballot.vote(message.userId, action, message.name);
    messageUsers.set(message.id, message.userId); latestVoteMessage.set(message.userId, message.id);
    // Bound message metadata even if a viewer repeatedly changes their vote.
    if (messageUsers.size > 10000) messageUsers.delete(messageUsers.keys().next().value);
    renderVotes();
  },
  onModeration(type, event) {
    if (type === 'channel.chat.clear') clearBallot();
    else if (type === 'channel.chat.clear_user_messages') { ballot.remove(event.target_user_id); renderVotes(); }
    else if (type === 'channel.chat.message_delete') {
      const user = messageUsers.get(event.message_id);
      if (user && latestVoteMessage.get(user) === event.message_id) ballot.remove(user);
      renderVotes();
    }
  },
  onStatus(status, text) {
    $('#connection-status').textContent = text;
    $('#connect-status').textContent = text;
    $('#connection-dot').className = `tiny-dot${status === 'connected' || status === 'transferring' ? ' connected' : status === 'error' ? ' error' : ''}`;
    if (status === 'connected') {
      // A Twitch-directed transfer never stopped delivering chat, so only a fresh connection stops the clock.
      if (!connected) {
        mode = 'live'; running = false;
        $('#connect-dialog').close();
        toast('Chat connected. Start the clock when your viewers are ready.');
      }
      connected = true;
      $('#connect-label').textContent = `#${twitch.channel}`;
      $('#disconnect-twitch').hidden = false;
    } else if (status === 'connecting' || status === 'reconnecting') { running = false; connected = false; clearBallot(); }
    else if (status === 'error' || status === 'disconnected') {
      connected = false; running = false;
      if (mode === 'live') mode = 'local';
      $('#connect-label').textContent = 'Connect Twitch';
      $('#disconnect-twitch').hidden = true;
      if (status === 'error') toast(text);
    }
    render();
  },
});

$$('[data-action]').forEach(button => button.addEventListener('click', () => handleAction(button.dataset.action)));
function handleAction(action) {
  if (game.won) { toast('Chamber solved. Enter the next chamber to keep playing.'); return; }
  if (mode === 'demo') stopDemo();
  if (mode === 'live') {
    if (!running) { toast('Start the clock to open voting.'); return; }
    ballot.vote('local-host', action, 'Timekeeper'); renderVotes();
  } else apply(action);
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('stream-view')) { document.body.classList.remove('stream-view'); return; }
  if ($('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || (event.key === ' ' && document.activeElement?.tagName === 'BUTTON') || event.ctrlKey || event.altKey || event.metaKey) return;
  const action = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', ' ': 'wait', r: 'rewind', R: 'rewind' }[event.key];
  if (action) { event.preventDefault(); handleAction(action); }
});
$('#watch-demo').addEventListener('click', requestDemo);
$('#host-demo').addEventListener('click', () => { $('#host-dialog').close(); requestDemo(); });
$('#show-hint').addEventListener('click', () => { $('#hint').hidden = !$('#hint').hidden; $('#show-hint').setAttribute('aria-expanded', String(!$('#hint').hidden)); });
$('#next-level').addEventListener('click', () => changeLevel((game.levelIndex + 1) % LEVELS.length));
$('#level-select').addEventListener('change', event => {
  const index = Number(event.target.value); event.target.value = String(game.levelIndex);
  if (index !== game.levelIndex) askBeforeClearing(() => changeLevel(index), 'Move to another chamber?');
});
$('#run-toggle').addEventListener('click', () => {
  if (game.won) return;
  if (!connected) { toast('Reconnect Twitch before starting the clock.'); return; }
  running = !running; deadline = performance.now() + beatDuration; clearBallot(); render();
});
$('#beat-duration').addEventListener('change', event => {
  beatDuration = Number(event.target.value); deadline = performance.now() + beatDuration; clearBallot();
  toast(`Each new beat is ${beatDuration / 1000} seconds.`);
});
setInterval(() => {
  if (!running || mode !== 'live' || !connected || game.won) return;
  const remaining = Math.max(0, deadline - performance.now());
  $('#beat-clock').textContent = `${(remaining / 1000).toFixed(1)}s · ${ballot.votes.size} VOTES`;
  $('#beat-progress').style.width = `${(1 - remaining / beatDuration) * 100}%`;
  if (!remaining) {
    const choice = ballot.result(); apply(choice.action, choice.names);
    if (choice.tied && !game.won) $('#event-message').textContent = 'A split timeline. The crowd tied, so the present waited.';
    clearBallot(); deadline = performance.now() + beatDuration;
  }
}, 100);

$$('[data-dialog]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.dialog}`).showModal()));
$$('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
}));
$('#confirm-cancel').addEventListener('click', () => { pendingConfirmation = null; $('#confirm-dialog').close(); });
$('#confirm-ok').addEventListener('click', () => { const action = pendingConfirmation; pendingConfirmation = null; $('#confirm-dialog').close(); action?.(); });
$('#confirm-dialog').addEventListener('cancel', () => { pendingConfirmation = null; });
$('#reset-level').addEventListener('click', () => { $('#host-dialog').close(); askBeforeClearing(() => changeLevel(game.levelIndex), 'Clear this chamber?'); });
$('#sound-toggle').addEventListener('click', () => {
  soundOn = !soundOn; $('#sound-toggle').setAttribute('aria-pressed', String(soundOn)); $('#sound-toggle span').textContent = soundOn ? 'Sound on' : 'Sound off';
  if (soundOn) beep();
});
$('#fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('#experiment').requestFullscreen(); }
  catch { document.body.classList.toggle('stream-view'); scrollTo(0, 0); }
});
$('#stream-view').addEventListener('click', () => { $('#host-dialog').close(); document.body.classList.toggle('stream-view'); scrollTo(0, 0); toast('Stream view · Escape returns to the page.'); });

function exportCapsule() {
  if (!game.echoes.length) { toast('Record an echo with a rewind first, then bottle the timeline.'); return; }
  const file = new Blob([JSON.stringify(game.capsule(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = `echo-relay-${game.level.id}-capsule.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Time capsule exported. Send it to the next streamer to pass your echoes forward.');
}
$('#export-capsule').addEventListener('click', exportCapsule);
$('#import-capsule').addEventListener('click', () => $('#capsule-file').click());
$('#capsule-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 128000) throw new Error('Time capsules must be smaller than 128 KB.');
    const capsule = JSON.parse(await file.text()); new Game().importCapsule(capsule);
    $('#host-dialog').close();
    askBeforeClearing(() => { stopDemo(); pause(); game.importCapsule(capsule); scene.animations.clear(); remember(); render(); toast('Capsule opened. Another chat’s past is now on your team.'); }, 'Open this time capsule?');
  } catch (error) { toast(error instanceof SyntaxError ? 'That file is not a readable JSON time capsule.' : error.message); }
});

const redirectUri = new URL(location.pathname, location.origin).href;
$('#redirect-url').textContent = redirectUri;
$('#client-input').value = storage.get('echo-relay-client') || '';
$('#channel-input').value = storage.get('echo-relay-channel') || '';
function saveSettings() {
  storage.set('echo-relay-client', $('#client-input').value.trim());
  storage.set('echo-relay-channel', $('#channel-input').value.trim());
}
$('#authorize-twitch').addEventListener('click', () => {
  if (!$('#channel-input').reportValidity()) return;
  const clientId = $('#client-input').value.trim();
  if (!/^[a-zA-Z0-9]{10,100}$/.test(clientId)) { $('#connect-status').textContent = 'Enter the public client ID from your registered Twitch application.'; return; }
  saveSettings();
  try {
    const state = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('echo-relay-oauth-state', state);
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'token', scope: 'user:read:chat', state }).toString();
    location.assign(url);
  } catch { $('#connect-status').textContent = 'Enable session storage for secure Twitch sign-in, or use a temporary token below.'; }
});
async function connectToken(token) {
  stopDemo(); pause(); saveSettings();
  const submit = $('#connect-form button[type="submit"]'); submit.disabled = true;
  try { await twitch.connect({ token, clientId: $('#client-input').value.trim(), channel: $('#channel-input').value.trim() }); }
  catch (error) { twitch.disconnect(); $('#connect-status').textContent = error.message; toast(error.message); }
  finally { submit.disabled = false; $('#token-input').value = ''; }
}
$('#connect-form').addEventListener('submit', async event => { event.preventDefault(); await connectToken($('#token-input').value); });
$('#disconnect-twitch').addEventListener('click', () => { twitch.disconnect(); $('#connect-dialog').close(); });

// Erase OAuth fragments before any other handling, and require a matching random state.
const oauth = new URLSearchParams(location.hash.slice(1));
if (oauth.has('access_token') || oauth.has('error')) {
  history.replaceState(null, '', location.pathname + location.search);
  let expected;
  try { expected = sessionStorage.getItem('echo-relay-oauth-state'); sessionStorage.removeItem('echo-relay-oauth-state'); } catch { /* Fail closed. */ }
  if (!expected || oauth.get('state') !== expected) toast('Twitch sign-in state did not match. Please begin sign-in again.');
  else if (oauth.has('error')) toast('Twitch sign-in was cancelled. The local lab is still ready.');
  else { $('#connect-dialog').showModal(); connectToken(oauth.get('access_token')); }
  oauth.delete('access_token');
}
const denied = new URLSearchParams(location.search);
if (denied.has('error')) { history.replaceState(null, '', location.pathname); toast('Twitch sign-in was not completed. You can try again from Connect Twitch.'); }
render();
