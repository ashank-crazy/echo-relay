const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

export class Scene {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    this.motionPreference.addEventListener('change', e => { this.reduced = e.matches; });
    this.animations = new Map();
    this.pulse = 0;
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas);
    this.fit();
    this.frame = t => { this.draw(t / 1000); this.raf = requestAnimationFrame(this.frame); };
    this.raf = requestAnimationFrame(this.frame);
  }
  fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.compact = rect.width < 560;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
  }
  project(x, y, z = 0) {
    const rows = this.game.level.rows;
    const w = rows[0].length, h = rows.length;
    const scale = Math.min(1, 18 / (w + h));
    return { x: 500 + (x - y - (w - h) / 2) * 39 * scale, y: (this.compact ? 390 : 310) + (x + y - (w + h) / 2) * 21 * scale - z, s: scale };
  }
  diamond(p, fill, stroke, height = 0) {
    const c = this.ctx, w = 39 * p.s, h = 21 * p.s;
    if (height) {
      c.fillStyle = '#15232c';
      c.beginPath(); c.moveTo(p.x - w, p.y); c.lineTo(p.x, p.y + h); c.lineTo(p.x, p.y + h + height); c.lineTo(p.x - w, p.y + height); c.closePath(); c.fill();
      c.fillStyle = '#1c2d37';
      c.beginPath(); c.moveTo(p.x, p.y + h); c.lineTo(p.x + w, p.y); c.lineTo(p.x + w, p.y + height); c.lineTo(p.x, p.y + h + height); c.closePath(); c.fill();
    }
    c.beginPath(); c.moveTo(p.x, p.y - h); c.lineTo(p.x + w, p.y); c.lineTo(p.x, p.y + h); c.lineTo(p.x - w, p.y); c.closePath();
    c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = .8; c.stroke(); }
  }
  text(text, x, y, color = '#9cabb5', size = 11, align = 'center') {
    const c = this.ctx;
    c.font = `500 ${size}px 'Courier New', monospace`;
    c.textAlign = align; c.fillStyle = color; c.fillText(text, x, y);
  }
  glow(x, y, color, radius) {
    const c = this.ctx, gradient = c.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
    c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  robot(position, color, id, time, alpha = 1) {
    const c = this.ctx, target = this.project(position.x, position.y);
    let anim = this.animations.get(id);
    if (!anim) { anim = { x: target.x, y: target.y }; this.animations.set(id, anim); }
    anim.x = this.reduced ? target.x : lerp(anim.x, target.x, .14);
    anim.y = this.reduced ? target.y : lerp(anim.y, target.y, .14);
    const x = anim.x, y = anim.y - (this.reduced ? 0 : Math.sin(time * 2.4 + id.length) * 2);
    c.save(); c.globalAlpha = alpha;
    this.glow(x, y - 4, `${color}30`, 49);
    c.fillStyle = `${color}25`; c.beginPath(); c.ellipse(x, y + 1, 19, 9, 0, 0, TAU); c.fill();
    c.strokeStyle = color; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, 17, 8, 0, 0, TAU); c.stroke();
    // A little levitating courier, drawn entirely with original geometry.
    c.fillStyle = id === 'present' ? '#d9e6d9' : color;
    c.strokeStyle = id === 'present' ? '#f3ffdf' : color;
    c.lineWidth = 1.4;
    c.beginPath(); c.roundRect(x - 12, y - 31, 24, 25, 7); c.fill(); c.stroke();
    c.fillStyle = '#14262a'; c.beginPath(); c.roundRect(x - 9, y - 25, 18, 10, 4); c.fill();
    c.fillStyle = color; c.fillRect(x - 5, y - 22, 3, 3); c.fillRect(x + 3, y - 22, 3, 3);
    c.strokeStyle = color; c.beginPath(); c.moveTo(x, y - 31); c.lineTo(x, y - 38); c.stroke();
    c.fillStyle = color; c.beginPath(); c.arc(x, y - 39, 2, 0, TAU); c.fill();
    c.fillStyle = `${color}55`; c.beginPath(); c.moveTo(x - 5, y - 4); c.lineTo(x + 5, y - 4); c.lineTo(x, y + 3); c.closePath(); c.fill();
    this.text(id === 'present' ? 'YOU, NOW' : `ECHO ${position.id}`, x, y - 51, color, 10);
    c.restore();
  }
  draw(time) {
    const c = this.ctx, canvas = this.canvas;
    if (!canvas.width || !canvas.height) return;
    const width = 1000, height = 620;
    c.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    c.clearRect(0, 0, width, height);
    const bg = c.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#111c26'); bg.addColorStop(.55, '#16232c'); bg.addColorStop(1, '#0e1922');
    c.fillStyle = bg; c.fillRect(0, 0, width, height);
    this.glow(550, 290, '#4c60711a', 320);
    // A faint technical grid and orbital guides give the chamber a sense of scale.
    c.fillStyle = '#a8bed219';
    for (let x = 20; x < width; x += 25) for (let y = 20; y < height; y += 25) c.fillRect(x, y, 1, 1);
    c.save(); c.translate(500, 330); c.scale(1, .48); c.strokeStyle = '#738ba215'; c.lineWidth = 1;
    [210, 300, 410].forEach(r => { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }); c.restore();
    // Suspended foundation, with cables hanging into the empty space.
    const rows = this.game.level.rows, scale = this.project(0, 0).s;
    const corners = [this.project(-.65, -.65), this.project(rows[0].length - .35, -.65), this.project(rows[0].length - .35, rows.length - .35), this.project(-.65, rows.length - .35)];
    c.save(); c.shadowBlur = 38; c.shadowColor = '#0009';
    c.beginPath(); corners.forEach((p, i) => i ? c.lineTo(p.x, p.y + 25) : c.moveTo(p.x, p.y + 25)); c.closePath(); c.fillStyle = '#0a131c'; c.fill(); c.restore();
    c.strokeStyle = '#32434e'; c.lineWidth = 1;
    for (let j = 1; j < 6; j++) {
      const p = this.project(j * rows[0].length / 6, rows.length - .35);
      c.beginPath(); c.moveTo(p.x, p.y + 10); c.lineTo(p.x, p.y + 44 + Math.sin(j * 7) * 15); c.stroke();
      c.fillStyle = '#6d7f8e'; c.fillRect(p.x - 1, p.y + 26, 2, 3);
    }
    // Sort in projection order so front walls cover the floor behind them.
    const all = [];
    rows.forEach((row, y) => [...row].forEach((type, x) => all.push({ x, y, type })));
    all.sort((a, b) => a.x + a.y - b.x - b.y || a.y - b.y);
    const active = this.game.activePlates();
    for (const tile of all) {
      const p = this.project(tile.x, tile.y);
      if (tile.type === '#') {
        this.diamond({ ...p, y: p.y - 12 * scale }, '#20313c', '#3b4a5580', 20 * scale);
        c.fillStyle = '#8c9ba522'; c.fillRect(p.x - 7, p.y - 16 * scale, 14, 1);
        continue;
      }
      const checker = (tile.x + tile.y) % 2;
      this.diamond(p, checker ? '#35454f' : '#30414c', '#62717c70', 8 * scale);
      c.fillStyle = '#c6d1ce15'; c.fillRect(p.x - 1, p.y - 1, 2, 2);
      if (tile.type === 'S') {
        this.diamond({ ...p, s: p.s * .65 }, '#283e40', '#c9f59290');
        this.text('ORIGIN', p.x, p.y + 4, '#c2dbac', 8);
      }
      if (/^[A-D]$/.test(tile.type)) {
        const on = active.includes(tile.type);
        if (on) this.glow(p.x, p.y, '#b3a0ff50', 45);
        this.diamond({ ...p, s: p.s * .69, y: p.y - 2 }, on ? '#8675bd' : '#484263', on ? '#dfcfff' : '#a492c9', 3);
        this.text(tile.type, p.x, p.y + 3, on ? '#fff' : '#d5c5fc', 15);
      }
      if (this.game.level.requirements[tile.type]) {
        const open = this.game.gateOpen(tile.type);
        const color = open ? '#d0f7a0' : '#ac9ad4';
        const off = 17 * scale;
        c.strokeStyle = color; c.lineWidth = 2;
        c.beginPath(); c.moveTo(p.x - off, p.y + off * .55); c.lineTo(p.x - off, p.y - 40); c.lineTo(p.x + off, p.y - 55); c.lineTo(p.x + off, p.y - off * .55); c.stroke();
        if (!open) {
          c.fillStyle = '#b19ce324'; c.beginPath(); c.moveTo(p.x - off, p.y + off * .55); c.lineTo(p.x - off, p.y - 40); c.lineTo(p.x + off, p.y - 55); c.lineTo(p.x + off, p.y - off * .55); c.closePath(); c.fill();
          for (let i = 0; i < 5; i++) { c.strokeStyle = '#ba9ff175'; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x - off, p.y - i * 9); c.lineTo(p.x + off, p.y - i * 9 - off); c.stroke(); }
        } else this.glow(p.x, p.y - 22, '#cbf7922a', 36);
        this.text(open ? 'OPEN' : tile.type.toUpperCase(), p.x, p.y - 65, color, 9);
      }
      if (tile.type === 'E') {
        this.glow(p.x, p.y - 20, this.game.won ? '#d0fa9290' : '#ceee9840', 70);
        c.save(); c.translate(p.x, p.y - 28); c.scale(.55, 1);
        c.strokeStyle = '#d4f6a4'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 24, 32, 0, 0, TAU); c.stroke();
        c.strokeStyle = '#d4f6a460'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, 31, 39, 0, 0, TAU); c.stroke();
        const g = c.createRadialGradient(0, 0, 2, 0, 0, 30); g.addColorStop(0, '#e6ffb630'); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(-30, -35, 60, 70); c.restore();
        this.text('EXIT', p.x, p.y - 80, '#d9edb4', 10);
      }
    }
    // The recorded footprints remain visible: the audience can reason about timing.
    for (const echo of this.game.echoes) {
      c.save(); c.strokeStyle = `${echo.color}60`; c.lineWidth = 2; c.setLineDash([3, 5]); c.beginPath();
      echo.path.forEach((pos, i) => { const p = this.project(pos.x, pos.y); i ? c.lineTo(p.x, p.y - 3) : c.moveTo(p.x, p.y - 3); }); c.stroke(); c.setLineDash([]);
      echo.path.forEach((pos, i) => { if (i > this.game.turn) return; const p = this.project(pos.x, pos.y); c.fillStyle = `${echo.color}80`; c.beginPath(); c.arc(p.x, p.y - 3, 2, 0, TAU); c.fill(); }); c.restore();
    }
    const robots = this.game.echoPositions().map(p => ({ position: p, color: p.color, id: `echo-${p.id}`, alpha: .68 }));
    robots.push({ position: this.game.position, color: '#d0f59c', id: 'present', alpha: 1 });
    robots.sort((a, b) => a.position.x + a.position.y - b.position.x - b.position.y);
    robots.forEach(r => this.robot(r.position, r.color, r.id, time, r.alpha));
    // Small atmospheric particles; fixed for people who prefer reduced motion.
    for (let i = 0; i < 25; i++) {
      const t = this.reduced ? 0 : time;
      const x = 95 + (i * 139.7) % 810, y = 105 + ((i * 83.3 + t * (3 + i % 3)) % 385);
      c.globalAlpha = .13 + Math.sin((this.reduced ? 0 : time) + i) * .08;
      c.fillStyle = i % 4 ? '#d7e4e7' : '#d5f6a3'; c.fillRect(x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2);
    }
    c.globalAlpha = 1;
    // Corner markings keep the scene grounded in a laboratory, not a generic HUD.
    this.text('TEMPORAL FIELD / STABLE', 35, 40, '#82949e', 10, 'left');
    this.text(`X ${String(this.game.position.x).padStart(2, '0')}   Y ${String(this.game.position.y).padStart(2, '0')}`, 964, 40, '#82949e', 10, 'right');
    this.text('ISOMETRIC VIEW', 36, 578, '#617681', 9, 'left');
    const cx = 84, cy = 528;
    c.strokeStyle = '#667d89'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 24, cy - 13); c.lineTo(cx + 24, cy + 13); c.moveTo(cx - 24, cy + 13); c.lineTo(cx + 24, cy - 13); c.stroke();
    this.text('↑', cx + 29, cy - 14, '#c3d1d6', 13); this.text('→', cx + 31, cy + 21, '#c3d1d6', 13);
    this.text('↓', cx - 29, cy + 21, '#c3d1d6', 13); this.text('←', cx - 31, cy - 14, '#c3d1d6', 13);
    this.text('PAST → PRESENT → POSSIBILITY', 963, 578, '#617681', 9, 'right');
    if (this.game.won) {
      const t = this.reduced ? 0 : time;
      for (let i = 0; i < 35; i++) { c.fillStyle = [ '#d0f59c', '#b5a2ff', '#ffb58b'][i % 3]; const x = 180 + (i * 97.1) % 650; const y = 80 + (i * 43 + t * 30) % 430; c.save(); c.translate(x, y); c.rotate(i + t); c.globalAlpha = .6; c.fillRect(-2, -2, 4, 6); c.restore(); }
    }
  }
}
