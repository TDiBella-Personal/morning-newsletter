'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const GRID   = 15;          // cells per side
const CELL   = 32;          // px per cell
const ENERGY = 10;          // energy per turn

// Heading → [dx, dy] in grid coords (0=North/up, clockwise)
const DIRS = [
  [ 0,-1], [ 1,-1], [ 1, 0], [ 1, 1],
  [ 0, 1], [-1, 1], [-1, 0], [-1,-1],
];

// Shield facings: 0=Fore, 1=Starboard, 2=Aft, 3=Port
const SHIELD_NAMES = ['Fore','Stbd','Aft','Port'];

// ─── Ship ────────────────────────────────────────────────────────────────────
class Ship {
  constructor({ name, x, y, heading, isPlayer }) {
    this.name     = name;
    this.x        = x;
    this.y        = y;
    this.heading  = heading;   // 0-7
    this.isPlayer = isPlayer;

    this.maxHull    = 30;
    this.hull       = 30;
    this.maxShields = [10, 10, 10, 10]; // F S A P
    this.shields    = [10, 10, 10, 10];
    this.torpedoes  = 6;

    // Per-turn allocation
    this.allocMove    = 4;
    this.allocShields = 3;
    this.allocWeapons = 3;

    // Phase counters (set at start of move/combat phase)
    this.moveLeft   = 0;
    this.weaponLeft = 0;
  }

  alive() { return this.hull > 0; }

  // Move one step forward in heading direction; returns false if blocked
  stepForward() {
    const [dx, dy] = DIRS[this.heading];
    const nx = this.x + dx, ny = this.y + dy;
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return false;
    this.x = nx; this.y = ny;
    return true;
  }

  turnLeft()  { this.heading = (this.heading + 7) % 8; }
  turnRight() { this.heading = (this.heading + 1) % 8; }

  // Which of the 4 shield facings takes a hit coming from (fx, fy)?
  hitFacing(fx, fy) {
    const dx = fx - this.x, dy = fy - this.y;
    // Angle of attacker relative to this ship in screen-coords (0=right, CW)
    const atk = Math.atan2(dy, dx) * 180 / Math.PI;           // -180..180
    // Ship's nose direction in screen-coords (heading 0=up=-90°)
    const nose = this.heading * 45 - 90;
    let rel = atk - nose;
    if (rel >  180) rel -= 360;
    if (rel < -180) rel += 360;
    // rel: 0 = straight ahead, ±90 = beam, ±180 = dead aft
    if (rel >= -45  && rel <  45 ) return 0; // Fore
    if (rel >=  45  && rel < 135 ) return 1; // Starboard
    if (rel >= -135 && rel < -45 ) return 3; // Port
    return 2;                                                   // Aft
  }

  // Is attacker in forward 90° arc?
  inForwardArc(tx, ty) {
    const dx = tx - this.x, dy = ty - this.y;
    const atk  = Math.atan2(dy, dx) * 180 / Math.PI;
    const nose = this.heading * 45 - 90;
    let rel = atk - nose;
    if (rel >  180) rel -= 360;
    if (rel < -180) rel += 360;
    return rel >= -45 && rel < 45;
  }

  takeDamage(amount, fromX, fromY) {
    const f = this.hitFacing(fromX, fromY);
    const shieldAbs = Math.min(this.shields[f], amount);
    this.shields[f] -= shieldAbs;
    const hull = amount - shieldAbs;
    this.hull   = Math.max(0, this.hull - hull);
    return { facing: f, shieldAbs, hull };
  }

  rechargeShields(energy) {
    let e = energy;
    for (let i = 0; i < 4 && e > 0; i++) {
      const need = this.maxShields[i] - this.shields[i];
      const add  = Math.min(need, Math.min(e, 3)); // cap 3/facing/turn
      this.shields[i] += add;
      e -= add;
    }
  }

  // Chebyshev distance to another ship
  distTo(other) {
    return Math.max(Math.abs(this.x - other.x), Math.abs(this.y - other.y));
  }
}

// ─── Game state ──────────────────────────────────────────────────────────────
let player, enemy, turn, phase, lastShot, gameLog;

function initGame() {
  player = new Ship({ name: 'USS Enterprise', x: 2,  y: 7,  heading: 2, isPlayer: true  });
  enemy  = new Ship({ name: 'IKS Klothos',   x: 12, y: 7,  heading: 6, isPlayer: false });
  turn     = 1;
  phase    = 'energy';
  lastShot = null;
  gameLog  = [];

  buildShieldUI('p-shields', 'player');
  buildShieldUI('e-shields', 'enemy');
  refreshUI();
  setPhase('energy');
  log('Battle commenced. Allocate energy and engage!', 'system');
}

// ─── Logging ─────────────────────────────────────────────────────────────────
function log(msg, cls = '') {
  gameLog.unshift({ msg, cls });
  const el   = document.getElementById('log-entries');
  const div  = document.createElement('div');
  div.textContent = msg;
  if (cls) div.className = `log-${cls}`;
  el.prepend(div);
  // Trim log display to 50 entries
  while (el.children.length > 50) el.removeChild(el.lastChild);
}

// ─── UI construction ─────────────────────────────────────────────────────────
function buildShieldUI(containerId, side) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  SHIELD_NAMES.forEach((name, i) => {
    const bar = document.createElement('div');
    bar.className = 'shield-bar';
    bar.innerHTML = `
      <div class="shield-label">${name}</div>
      <div class="shield-track">
        <div class="shield-fill" id="${side}-sh-${i}" style="width:100%"></div>
      </div>`;
    el.appendChild(bar);
  });
}

function refreshUI() {
  // Player hull
  const ph = document.getElementById('p-hull');
  ph.textContent = player.hull;
  const pm = document.getElementById('p-hull-meter');
  pm.value = player.hull;
  pm.optimum = player.maxHull;
  pm.low = player.maxHull * 0.3;

  // Enemy hull
  document.getElementById('e-hull').textContent = enemy.hull;
  const em = document.getElementById('e-hull-meter');
  em.value = enemy.hull;
  em.optimum = enemy.maxHull;
  em.low = enemy.maxHull * 0.3;

  // Shields
  [player, enemy].forEach((ship, si) => {
    const side = si === 0 ? 'player' : 'enemy';
    ship.shields.forEach((val, i) => {
      const fill = document.getElementById(`${side}-sh-${i}`);
      if (fill) fill.style.width = `${(val / ship.maxShields[i]) * 100}%`;
    });
  });

  // Torpedoes / energy
  document.getElementById('p-torps').textContent = player.torpedoes;
  document.getElementById('p-energy-left').textContent =
    phase === 'move'   ? `${player.moveLeft} impulse` :
    phase === 'combat' ? `${player.weaponLeft} weapons` : '—';

  // Turn
  document.getElementById('turn-num').textContent = turn;

  // Move panel counter
  const ml = document.getElementById('move-left');
  if (ml) ml.textContent = player.moveLeft;
  const wl = document.getElementById('weapon-left');
  if (wl) wl.textContent = player.weaponLeft;

  render();
}

// ─── Phase management ────────────────────────────────────────────────────────
function setPhase(p) {
  phase = p;
  document.getElementById('phase-name').textContent = {
    energy:        'Energy Allocation',
    move:          'Movement',
    combat:        'Combat',
    'enemy-move':  'Enemy Turn',
    'enemy-combat':'Enemy Combat',
    gameover:      'Game Over',
  }[p] || p;

  document.getElementById('energy-panel').classList.toggle('hidden', p !== 'energy');
  document.getElementById('move-panel')  .classList.toggle('hidden', p !== 'move');
  document.getElementById('combat-panel').classList.toggle('hidden', p !== 'combat');

  if (p === 'energy') {
    document.getElementById('p-energy-left').textContent = '—';
  }
  if (p === 'move') {
    document.getElementById('move-left').textContent = player.moveLeft;
  }
  if (p === 'combat') {
    document.getElementById('weapon-left').textContent = player.weaponLeft;
    updateCombatHint();
  }
  if (p === 'enemy-move' || p === 'enemy-combat') {
    // Run AI after a short delay so the player can see what's happening
    setTimeout(runEnemyTurn, 600);
  }
  if (p === 'gameover') {
    document.getElementById('gameover-overlay').classList.remove('hidden');
  }
  refreshUI();
}

// ─── Energy allocation ────────────────────────────────────────────────────────
function setupSliders() {
  const ids = ['move', 'shields', 'weapons'];
  ids.forEach(id => {
    const sl = document.getElementById(`sl-${id}`);
    sl.addEventListener('input', onSliderChange);
  });
  document.getElementById('btn-confirm-energy').addEventListener('click', confirmEnergy);
  onSliderChange();
}

function onSliderChange() {
  const mv = +document.getElementById('sl-move').value;
  const sh = +document.getElementById('sl-shields').value;
  const wp = +document.getElementById('sl-weapons').value;
  document.getElementById('vl-move').textContent    = mv;
  document.getElementById('vl-shields').textContent = sh;
  document.getElementById('vl-weapons').textContent = wp;
  const total = mv + sh + wp;
  const warn  = document.getElementById('alloc-warn');
  const btn   = document.getElementById('btn-confirm-energy');
  if (total > ENERGY) {
    warn.textContent = `Over by ${total - ENERGY} — reduce allocation`;
    btn.disabled = true;
  } else {
    warn.textContent = total < ENERGY ? `${ENERGY - total} unallocated (wasted)` : '';
    btn.disabled = false;
  }
}

function confirmEnergy() {
  player.allocMove    = +document.getElementById('sl-move').value;
  player.allocShields = +document.getElementById('sl-shields').value;
  player.allocWeapons = +document.getElementById('sl-weapons').value;

  // Recharge player shields
  player.rechargeShields(player.allocShields);

  player.moveLeft   = player.allocMove;
  player.weaponLeft = player.allocWeapons;

  log(`Turn ${turn}: Engines ${player.allocMove}, Shields ${player.allocShields}, Weapons ${player.allocWeapons}`, 'player');
  setPhase('move');
}

// ─── Movement phase ───────────────────────────────────────────────────────────
function setupMovement() {
  document.getElementById('btn-fwd').addEventListener('click', () => {
    if (player.moveLeft < 1) return;
    if (!player.stepForward()) { log('Edge of space — cannot move there', 'system'); return; }
    player.moveLeft--;
    lastShot = null;
    refreshUI();
  });
  document.getElementById('btn-left').addEventListener('click', () => {
    if (player.moveLeft < 1) return;
    player.turnLeft();
    player.moveLeft--;
    lastShot = null;
    refreshUI();
  });
  document.getElementById('btn-right').addEventListener('click', () => {
    if (player.moveLeft < 1) return;
    player.turnRight();
    player.moveLeft--;
    lastShot = null;
    refreshUI();
  });
  document.getElementById('btn-end-move').addEventListener('click', () => {
    setPhase('combat');
  });
}

// ─── Combat phase ─────────────────────────────────────────────────────────────
function updateCombatHint() {
  const dist = player.distTo(enemy);
  const inArc = player.inForwardArc(enemy.x, enemy.y);
  const hint = document.getElementById('combat-hint');
  const torpBtn = document.getElementById('btn-torpedo');

  if (!enemy.alive()) { hint.textContent = 'Target destroyed.'; return; }

  const hints = [`Range: ${dist}`];
  if (!inArc)             hints.push('Torpedo: target not in forward arc');
  else if (dist > 10)     hints.push('Torpedo: out of range (10)');
  else if (player.torpedoes < 1) hints.push('Torpedo: none remaining');
  else if (player.weaponLeft < 3) hints.push('Torpedo: need 3 weapon energy');

  torpBtn.disabled = !(inArc && dist <= 10 && player.torpedoes > 0 && player.weaponLeft >= 3);
  document.getElementById('btn-phasers').disabled = (player.weaponLeft < 1 || dist > 8);
  if (dist > 8) hints.push('Phasers: out of range (8)');

  hint.textContent = hints.join(' | ');
}

function setupCombat() {
  document.getElementById('btn-phasers').addEventListener('click', () => {
    const dist = player.distTo(enemy);
    if (dist > 8 || player.weaponLeft < 1) return;
    const energy  = Math.min(player.weaponLeft, 5);
    const rangeMod = Math.max(1, 9 - dist);   // 8 at range 1, 1 at range 8
    const dmg      = Math.round(energy * rangeMod / 4);
    player.weaponLeft -= energy;
    const { facing, shieldAbs, hull } = enemy.takeDamage(dmg, player.x, player.y);
    lastShot = { x1: player.x, y1: player.y, x2: enemy.x, y2: enemy.y, color: '#4a9eff' };
    log(`Phasers: ${dmg} dmg → ${SHIELD_NAMES[facing]} shield. Shields -${shieldAbs}, Hull -${hull}`, 'player');
    if (!enemy.alive()) { log('IKS Klothos destroyed! Victory!', 'system'); refreshUI(); setPhase('gameover'); return; }
    updateCombatHint();
    refreshUI();
  });

  document.getElementById('btn-torpedo').addEventListener('click', () => {
    const dist = player.distTo(enemy);
    if (!player.inForwardArc(enemy.x, enemy.y) || dist > 10 || player.torpedoes < 1 || player.weaponLeft < 3) return;
    player.weaponLeft -= 3;
    player.torpedoes--;
    const dmg = 10;
    const { facing, shieldAbs, hull } = enemy.takeDamage(dmg, player.x, player.y);
    lastShot = { x1: player.x, y1: player.y, x2: enemy.x, y2: enemy.y, color: '#ff9800' };
    log(`Torpedo: ${dmg} dmg → ${SHIELD_NAMES[facing]} shield. Shields -${shieldAbs}, Hull -${hull}`, 'player');
    if (!enemy.alive()) { log('IKS Klothos destroyed! Victory!', 'system'); refreshUI(); setPhase('gameover'); return; }
    updateCombatHint();
    refreshUI();
  });

  document.getElementById('btn-end-combat').addEventListener('click', () => {
    lastShot = null;
    setPhase('enemy-move');
  });
}

// ─── Enemy AI ─────────────────────────────────────────────────────────────────
function runEnemyTurn() {
  if (phase !== 'enemy-move' && phase !== 'enemy-combat') return;

  // Enemy energy allocation (simple fixed ratio)
  enemy.allocMove    = 4;
  enemy.allocShields = 3;
  enemy.allocWeapons = 3;
  enemy.rechargeShields(enemy.allocShields);
  enemy.moveLeft   = enemy.allocMove;
  enemy.weaponLeft = enemy.allocWeapons;

  // ── Movement: try to keep medium range (3-4 hexes), face the player
  let steps = enemy.moveLeft;
  while (steps > 0) {
    const dist = enemy.distTo(player);
    // Turn to face player
    const targetHeading = bestHeadingToward(enemy, player);
    const diff = headingDiff(enemy.heading, targetHeading);
    if (diff !== 0 && steps > 0) {
      if (diff > 0) enemy.turnRight(); else enemy.turnLeft();
      steps--;
      continue;
    }
    // Move: approach if far, retreat if too close, hold if good
    if (dist > 5 && steps > 0) {
      enemy.stepForward();
      steps--;
    } else if (dist < 3 && steps > 0) {
      // reverse-turn 180° and step
      enemy.heading = (enemy.heading + 4) % 8;
      enemy.stepForward();
      enemy.heading = (enemy.heading + 4) % 8;
      steps--;
    } else {
      break;
    }
  }

  refreshUI();

  // ── Combat
  setTimeout(() => {
    const dist = enemy.distTo(player);
    if (dist <= 8 && enemy.weaponLeft >= 1) {
      const energy  = Math.min(enemy.weaponLeft, 5);
      const rangeMod = Math.max(1, 9 - dist);
      const dmg      = Math.round(energy * rangeMod / 4);
      enemy.weaponLeft -= energy;
      const { facing, shieldAbs, hull } = player.takeDamage(dmg, enemy.x, enemy.y);
      lastShot = { x1: enemy.x, y1: enemy.y, x2: player.x, y2: player.y, color: '#cc3333' };
      log(`Enemy phasers: ${dmg} dmg → ${SHIELD_NAMES[facing]} shield. Shields -${shieldAbs}, Hull -${hull}`, 'enemy');
      if (!player.alive()) {
        log('USS Enterprise destroyed! Defeat.', 'system');
        refreshUI();
        setPhase('gameover');
        return;
      }
    }
    // Torpedo if in arc, range, and worth it
    if (enemy.inForwardArc(player.x, player.y) && dist <= 10 && enemy.torpedoes > 0 && enemy.weaponLeft >= 3) {
      enemy.weaponLeft -= 3;
      enemy.torpedoes--;
      const dmg = 10;
      const { facing, shieldAbs, hull } = player.takeDamage(dmg, enemy.x, enemy.y);
      lastShot = { x1: enemy.x, y1: enemy.y, x2: player.x, y2: player.y, color: '#ff9800' };
      log(`Enemy torpedo: ${dmg} dmg → ${SHIELD_NAMES[facing]} shield. Shields -${shieldAbs}, Hull -${hull}`, 'enemy');
      if (!player.alive()) {
        log('USS Enterprise destroyed! Defeat.', 'system');
        refreshUI();
        setPhase('gameover');
        return;
      }
    }

    turn++;
    lastShot = null;
    refreshUI();
    setPhase('energy');
  }, 700);
}

// ─── AI helpers ───────────────────────────────────────────────────────────────
function bestHeadingToward(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy === 0) return from.heading;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI; // screen coords
  // Convert to heading: heading = (angle + 90) / 45, mod 8
  const h = Math.round((angle + 90) / 45);
  return ((h % 8) + 8) % 8;
}

// Returns signed shortest turn to reach target heading
function headingDiff(current, target) {
  let d = (target - current + 8) % 8;
  if (d > 4) d -= 8; // prefer shorter rotation
  return d; // positive = turn right, negative = turn left
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────
const CANVAS = document.getElementById('grid');
const CTX    = CANVAS.getContext('2d');

function render() {
  const ctx = CTX;
  ctx.fillStyle = '#060b14';
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  // Stars (static, seeded pattern)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 80; i++) {
    const sx = (i * 137 + 23) % CANVAS.width;
    const sy = (i * 251 + 47) % CANVAS.height;
    ctx.fillRect(sx, sy, 1, 1);
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(30,58,95,0.5)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, GRID * CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(GRID * CELL, i * CELL); ctx.stroke();
  }

  // Weapon shot
  if (lastShot) {
    const { x1, y1, x2, y2, color } = lastShot;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(x1 * CELL + CELL / 2, y1 * CELL + CELL / 2);
    ctx.lineTo(x2 * CELL + CELL / 2, y2 * CELL + CELL / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawShip(ctx, player, '#4a9eff', '#2060c0');
  if (enemy.alive()) drawShip(ctx, enemy, '#cc3333', '#801010');
}

function drawShip(ctx, ship, fill, stroke) {
  const cx = ship.x * CELL + CELL / 2;
  const cy = ship.y * CELL + CELL / 2;
  const angle = ship.heading * Math.PI / 4 - Math.PI / 2; // rotate: 0=up

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Draw ship as a pointed triangle
  ctx.beginPath();
  ctx.moveTo(0, -12);       // nose
  ctx.lineTo(8, 10);        // starboard
  ctx.lineTo(0, 6);         // aft center
  ctx.lineTo(-8, 10);       // port
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  // Show shield health as colored overlay on the 4 facings
  const faces = [
    [0, -14, 'fore'],   // fore
    [14, 0, 'stbd'],    // stbd
    [0, 14, 'aft'],     // aft
    [-14, 0, 'port'],   // port
  ];
  ship.shields.forEach((val, i) => {
    const pct = val / ship.maxShields[i];
    const [fx, fy] = [faces[i][0], faces[i][1]];
    ctx.beginPath();
    ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = pct > 0.5 ? '#4caf50' : pct > 0.2 ? '#ff9800' : pct > 0 ? '#cc3333' : '#333';
    ctx.fill();
  });

  ctx.restore();

  // Name label
  ctx.fillStyle = fill;
  ctx.font = '8px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(ship.name.split(' ').pop(), cx, cy + CELL / 2 - 2);
}

// ─── Gameover ─────────────────────────────────────────────────────────────────
function setupGameover() {
  document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('gameover-overlay').classList.add('hidden');
    document.getElementById('log-entries').innerHTML = '';
    initGame();
  });
}

function updateGameoverMsg() {
  const msg = document.getElementById('gameover-msg');
  if (!player.alive()) {
    msg.textContent = '☠ USS Enterprise Destroyed';
    msg.style.color = '#cc3333';
  } else {
    msg.textContent = '★ Victory! Klingons Defeated';
    msg.style.color = '#f0c040';
  }
}

// Override setPhase to set gameover message
const _setPhase = setPhase;
// (already defined above; add hook for gameover message)

// ─── Init ─────────────────────────────────────────────────────────────────────
setupSliders();
setupMovement();
setupCombat();
setupGameover();

// Hook gameover message into phase switch
const origSetPhase = setPhase;
window.addEventListener('DOMContentLoaded', () => {}); // no-op, already loaded

// Patch: intercept gameover
(function patchGameover() {
  const orig = window.setPhase || setPhase; // setPhase is a closure; patch via the event
})();

// We call updateGameoverMsg whenever gameover-overlay becomes visible
const observer = new MutationObserver(() => {
  if (!document.getElementById('gameover-overlay').classList.contains('hidden')) {
    updateGameoverMsg();
  }
});
observer.observe(document.getElementById('gameover-overlay'), { attributes: true });

initGame();
