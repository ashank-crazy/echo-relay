import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, Ballot, LEVELS, parseCommand } from '../dist/engine.js';

for (let index = 0; index < LEVELS.length; index++) {
  const level = LEVELS[index];
  test(`${level.name}: the published demo solves the real puzzle`, () => {
    const game = new Game(index);
    for (const action of level.demo) game.step(action, ['Ada', 'Moss']);
    assert.equal(game.won, true);
    assert.equal(game.tileAt(game.position).type, 'E');
    assert.equal(game.echoes.length, index === 0 ? 1 : 2);
    assert.ok(game.turn < level.limit);
  });
  test(`${level.name}: no route to the exit exists without a switch held`, () => {
    const game = new Game(index), queue = [game.spawn], seen = new Set();
    let found = false;
    while (queue.length) {
      const p = queue.shift(), key = `${p.x},${p.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (game.tileAt(p).type === 'E') { found = true; break; }
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const next = { x: p.x + dx, y: p.y + dy }, tile = game.tileAt(next);
        if (tile && !game.level.requirements[tile.type]) queue.push(next);
      }
    }
    assert.equal(found, false);
  });
  test(`${level.name}: rows have consistent width and exactly one start and exit`, () => {
    assert.ok(level.rows.every(row => row.length === level.rows[0].length));
    assert.equal(level.rows.join('').split('S').length, 2);
    assert.equal(level.rows.join('').split('E').length, 2);
  });
}

test('rewinds preserve positions and contributors; echoes hold their final position', () => {
  const game = new Game();
  for (const action of ['right', 'down', 'down']) game.step(action, ['Ada', 'Ada', 'Moss']);
  assert.deepEqual(game.position, { x: 2, y: 3 });
  assert.equal(game.rewind().type, 'rewind');
  assert.deepEqual(game.position, game.spawn);
  assert.deepEqual(game.echoes[0].contributors, ['Ada', 'Moss']);
  for (let i = 0; i < 7; i++) game.step('wait');
  assert.deepEqual(game.activePlates(), ['A']);
  assert.equal(game.echoPositions()[0].holding, true);
  assert.equal(game.gateOpen('a'), true);
});
test('an echo on a switch allows the present through a previously closed door', () => {
  const game = new Game();
  for (const a of ['down', 'down', 'right', 'right', 'right']) game.step(a);
  assert.deepEqual(game.position, { x: 3, y: 3 });
  assert.equal(game.lastEvent.type, 'blocked');
  game.loadLevel(0);
  for (const a of ['right', 'down', 'down', 'rewind', 'down', 'down', 'right', 'right', 'right']) game.step(a);
  assert.deepEqual(game.position, { x: 4, y: 3 });
});
test('walls consume a beat, and idle beats advance echoes', () => {
  const game = new Game();
  assert.equal(game.step('up').type, 'blocked');
  assert.equal(game.turn, 1);
  assert.deepEqual(game.position, game.spawn);
  assert.equal(game.trace.length, 2);
});
test('beat exhaustion automatically records the loop and starts the next', () => {
  const game = new Game();
  for (let i = 0; i < game.level.limit; i++) game.step('wait');
  assert.equal(game.turn, 0);
  assert.equal(game.loop, 2);
  assert.equal(game.echoes[0].path.length, game.level.limit + 1);
  assert.equal(game.lastEvent.type, 'rewind');
});
test('three echo slots replace the oldest and do not share mutable paths', () => {
  const game = new Game();
  for (let i = 0; i < 4; i++) { game.step('right'); game.rewind(); }
  assert.deepEqual(game.echoes.map(e => e.id), [2, 3, 4]);
  game.trace[0].x = 99;
  assert.equal(game.echoes[0].path[0].x, 1);
});
test('empty rewinds and post-win inputs do not corrupt history', () => {
  const game = new Game();
  assert.equal(game.rewind().type, 'ignored');
  for (const action of game.level.demo) game.step(action);
  const position = { ...game.position }, turn = game.turn;
  assert.equal(game.step('left').type, 'ignored');
  assert.equal(game.rewind().type, 'ignored');
  assert.deepEqual(game.position, position);
  assert.equal(game.turn, turn);
});
test('a portable capsule gives another stream the same functional echoes', () => {
  const original = new Game(1);
  const split = original.level.demo.lastIndexOf('rewind');
  for (const action of original.level.demo.slice(0, split + 1)) original.step(action, ['PreviousChat']);
  const loaded = new Game().importCapsule(JSON.parse(JSON.stringify(original.capsule())));
  assert.equal(loaded.echoes.length, 2);
  assert.equal(loaded.levelIndex, 1);
  for (const action of original.level.demo.slice(split + 1)) loaded.step(action, ['NextChat']);
  assert.equal(loaded.won, true);
  assert.deepEqual(loaded.echoes[0].contributors, ['PreviousChat']);
});
test('malformed capsules, teleports, wall positions and excessive history are rejected atomically', () => {
  const game = new Game();
  game.step('right'); game.rewind();
  const base = game.capsule();
  const badInputs = [null, {}, { ...base, version: 99 }, { ...base, level: -1 }, { ...base, echoes: new Array(4).fill(base.echoes[0]) }, { ...base, echoes: [{ path: [{ x: 1, y: 1 }, { x: 7, y: 1 }] }] }, { ...base, echoes: [{ path: [{ x: 1, y: 1 }, { x: 0, y: 1 }] }] }, { ...base, echoes: [{ path: [{ x: 1, y: 1 }, { x: 1.5, y: 1 }] }] }];
  for (const input of badInputs) {
    assert.throws(() => game.importCapsule(input));
    assert.deepEqual(game.capsule(), base);
  }
});
test('each viewer gets one vote per beat; later commands replace earlier commands', () => {
  const ballot = new Ballot();
  ballot.vote('1', 'up', 'Ada'); ballot.vote('1', 'right', 'Ada');
  ballot.vote('2', 'right', 'Moss');
  assert.equal(ballot.votes.size, 2);
  assert.equal(ballot.result().action, 'right');
  assert.equal(ballot.tally().up, 0);
  assert.equal(ballot.vote('3', 'explode'), false);
  ballot.remove('2'); assert.equal(ballot.votes.size, 1);
  ballot.clear(); assert.equal(ballot.result().action, 'wait');
});
test('ties wait instead of biasing a direction; rewind participates fairly', () => {
  const ballot = new Ballot();
  ballot.vote('1', 'up'); ballot.vote('2', 'rewind');
  assert.equal(ballot.result().action, 'wait'); assert.equal(ballot.result().tied, true);
  ballot.vote('3', 'rewind'); assert.equal(ballot.result().action, 'rewind');
});
test('only exact command words are accepted; surrounding text never executes', () => {
  assert.equal(parseCommand('  !RIGHT  '), 'right');
  assert.equal(parseCommand('!up please'), 'up');
  for (const value of ['!upgrade', 'hello !up', '!up<script>', '!right!!!', '', null, '<img onerror=alert(1)>']) assert.equal(parseCommand(value), null);
});
