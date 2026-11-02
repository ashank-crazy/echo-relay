// The simulation has no DOM, network, clock, or random-number dependency.
export const ACTIONS = ['up', 'right', 'down', 'left', 'wait', 'rewind'];
export const DELTAS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0], wait: [0, 0] };
export const COLORS = ['#b5a2ff', '#ffb58b', '#78d9ec'];
export const LEVELS = [
  {
    id: 'first-contact', name: 'First contact', subtitle: 'A favor from the past.',
    briefing: 'The exit is beyond a locked door. Leave an echo on switch A, rewind, then take the open door home.',
    hint: 'Go → ↓ ↓ to A. Rewind. Your echo will repeat that route and stay on A. Now go ↓ ↓ → → → → ↑ ↑ → →.',
    rows: ['#########', '#S..#..E#', '#...#...#', '#.A.a...#', '#...#...#', '#...#...#', '#########'],
    limit: 20, requirements: { a: ['A'] },
    demo: ['right', 'down', 'down', 'rewind', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up', 'right', 'right'],
  },
  {
    id: 'second-opinion', name: 'Second opinion', subtitle: 'It takes three timelines.',
    briefing: 'Two doors. Two switches. Record an echo on A, then a second on B. The present can finally go all the way.',
    hint: 'First record → ↓ ↓ on A. Rewind. Then ↓ ↓ → → → → → to B. Rewind again. Both echoes will hold the doors for you.',
    rows: ['###########', '#S..#...#E#', '#...#...#.#', '#.A.a.B.b.#', '#...#...#.#', '#...#...#.#', '###########'],
    limit: 22, requirements: { a: ['A'], b: ['B'] },
    demo: ['right', 'down', 'down', 'rewind', 'down', 'down', 'right', 'right', 'right', 'right', 'right', 'rewind', 'down', 'down', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'up', 'up'],
  },
  {
    id: 'long-way-home', name: 'The long way home', subtitle: 'Leave someone behind. Bring everyone home.',
    briefing: 'A deeper chamber. Your echoes hold the two relays while you find the winding route to the exit.',
    hint: 'A: ↓ ↓ →. Rewind. B: ↓ ↓ → → → → ↓ ↓ ↓ ↓. Rewind. Head through A, then east to column 7, south twice, and east through B. The exit is up the far-right corridor.',
    rows: ['#############', '#S..#...#..E#', '#.#.#.#.#.#.#', '#.A.a...#...#', '###.#.#.###.#', '#...#...b...#', '#.#.#.#.#.#.#', '#...#B..#...#', '#############'],
    limit: 24, requirements: { a: ['A'], b: ['B'] },
    demo: ['down', 'down', 'right', 'rewind', 'down', 'down', 'right', 'right', 'right', 'right', 'down', 'down', 'down', 'down', 'rewind', 'down', 'down', 'right', 'right', 'right', 'right', 'right', 'right', 'down', 'down', 'right', 'right', 'right', 'right', 'up', 'up', 'up', 'up'],
  },
];

const same = (a, b) => a.x === b.x && a.y === b.y;
const copy = p => ({ x: p.x, y: p.y });
export function parseCommand(text) {
  const match = String(text).trim().toLowerCase().match(/^!(up|right|down|left|wait|rewind)(?:\s|$)/);
  return match ? match[1] : null;
}

export class Ballot {
  constructor() { this.votes = new Map(); }
  vote(userId, action, name = 'Viewer') {
    if (!userId || !ACTIONS.includes(action)) return false;
    this.votes.set(String(userId).slice(0, 128), { action, name: String(name).slice(0, 32) });
    return true;
  }
  remove(userId) { this.votes.delete(String(userId)); }
  tally() {
    const counts = Object.fromEntries(ACTIONS.map(a => [a, 0]));
    for (const v of this.votes.values()) counts[v.action]++;
    return counts;
  }
  result() {
    const counts = this.tally();
    const highest = Math.max(...Object.values(counts));
    const tied = ACTIONS.filter(a => counts[a] === highest);
    // A tied crowd holds position, rather than silently favoring one direction.
    return { action: highest > 0 && tied.length === 1 ? tied[0] : 'wait', counts, size: this.votes.size, tied: highest > 0 && tied.length > 1, names: [...this.votes.values()].map(v => v.name) };
  }
  clear() { this.votes.clear(); }
}

export class Game {
  constructor(levelIndex = 0) { this.loadLevel(levelIndex); }
  loadLevel(index) {
    if (!Number.isInteger(index) || !LEVELS[index]) throw new Error('Unknown chamber.');
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.tiles = [];
    this.level.rows.forEach((row, y) => [...row].forEach((type, x) => {
      if (type === 'S') this.spawn = { x, y };
      if (type !== '#') this.tiles.push({ x, y, type });
    }));
    this.echoes = [];
    this.loop = 1;
    this.resetPresent();
  }
  resetPresent() {
    this.position = copy(this.spawn);
    this.turn = 0;
    this.trace = [copy(this.spawn)];
    this.actions = [];
    this.contributors = new Set();
    this.won = false;
    this.lastEvent = { type: 'ready', text: this.level.briefing };
  }
  tileAt(p) { return this.tiles.find(t => same(t, p)); }
  echoPositions(turn = this.turn) {
    return this.echoes.map(e => ({ ...copy(e.path[Math.min(turn, e.path.length - 1)]), id: e.id, color: e.color, holding: turn >= e.path.length - 1 }));
  }
  activePlates(turn = this.turn, player = this.position) {
    const actors = [...this.echoPositions(turn), player];
    return this.tiles.filter(t => /^[A-D]$/.test(t.type) && actors.some(p => same(p, t))).map(t => t.type);
  }
  gateOpen(type, turn = this.turn, player = this.position) {
    const active = this.activePlates(turn, player);
    return (this.level.requirements[type] || []).every(p => active.includes(p));
  }
  step(action, names = []) {
    if (!ACTIONS.includes(action)) return { type: 'ignored', text: 'Unknown command.' };
    if (this.won) return { type: 'ignored', text: 'Chamber already complete.' };
    if (action === 'rewind') return this.rewind();
    for (const name of names) if (this.contributors.size < 100) this.contributors.add(String(name).slice(0, 32));
    const [dx, dy] = DELTAS[action];
    const target = { x: this.position.x + dx, y: this.position.y + dy };
    const tile = this.tileAt(target);
    const nextTurn = this.turn + 1;
    const blocked = !tile || (this.level.requirements[tile.type] && !this.gateOpen(tile.type, nextTurn));
    if (!blocked) this.position = target;
    this.turn = nextTurn;
    this.trace.push(copy(this.position));
    this.actions.push(action);
    if (this.tileAt(this.position)?.type === 'E') {
      this.won = true;
      this.lastEvent = { type: 'win', text: 'Paradox solved. You couldn’t have done it without you.' };
    } else if (this.turn >= this.level.limit) {
      return this.rewind(true);
    } else {
      this.lastEvent = { type: blocked ? 'blocked' : action === 'wait' ? 'wait' : 'move', text: blocked ? 'Path blocked. A past self might be able to help.' : action === 'wait' ? 'Holding position. The echoes keep moving.' : `Chat moved ${action}.` };
    }
    return this.lastEvent;
  }
  rewind(automatic = false) {
    if (!this.turn || this.won) return { type: 'ignored', text: 'Make a move before recording an echo.' };
    const echo = { id: this.loop, color: COLORS[(this.loop - 1) % COLORS.length], path: this.trace.map(copy), actions: [...this.actions], contributors: [...this.contributors] };
    this.echoes.push(echo);
    if (this.echoes.length > 3) this.echoes.shift();
    this.loop++;
    this.resetPresent();
    this.lastEvent = { type: 'rewind', text: `${automatic ? 'Time’s up. ' : ''}Echo ${echo.id} recorded. Your past is now part of the team.` };
    return this.lastEvent;
  }
  capsule() {
    return { format: 'echo-relay', version: 1, level: this.levelIndex, loop: this.loop, echoes: structuredClone(this.echoes) };
  }
  importCapsule(input) {
    if (!input || input.format !== 'echo-relay' || input.version !== 1 || !Number.isInteger(input.level) || !LEVELS[input.level] || !Array.isArray(input.echoes) || input.echoes.length > 3) throw new Error('This is not a valid Echo Relay time capsule.');
    const candidate = new Game(input.level);
    const echoes = input.echoes.map((e, i) => {
      if (!e || !Array.isArray(e.path) || e.path.length < 2 || e.path.length > candidate.level.limit + 1 || !same(e.path[0] || {}, candidate.spawn)) throw new Error('The capsule contains an invalid timeline.');
      const path = e.path.map((p, j) => {
        if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y) || !candidate.tileAt(p) || (j && Math.abs(p.x - e.path[j - 1].x) + Math.abs(p.y - e.path[j - 1].y) > 1)) throw new Error('The capsule contains an impossible move.');
        return copy(p);
      });
      return { id: i + 1, color: COLORS[i], path, actions: [], contributors: Array.isArray(e.contributors) ? e.contributors.slice(0, 100).map(n => String(n).slice(0, 32)) : [] };
    });
    this.loadLevel(input.level);
    this.echoes = echoes;
    this.loop = echoes.length + 1;
    this.lastEvent = { type: 'import', text: 'A message from another timeline. Their echoes are ready to help.' };
    return this;
  }
}
