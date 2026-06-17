"use strict";

// ===== Ball Point =====
// Натяни рогатку, запусти крутящуюся пилу, лопни все шары.
// Пила отскакивает от блоков; падение в пустоту = потеря пилы.

const W = 960;          // логическая ширина игрового поля
const H = 600;          // логическая высота
const GRAVITY = 0.42;   // притяжение вниз (px/кадр^2)
const RESTITUTION = 0.74; // упругость отскока (0..1)
const WALL_BOUNCE = 0.7;
const POWER = 0.19;     // натяжение -> скорость
const MAX_PULL = 185;   // макс. натяжение рогатки (px)
const SAW_R = 19;       // радиус пилы
const BALLOON_R = 17;   // радиус шара
const PREVIEW_STEPS = 26; // длина предпросмотра траектории (меньше = сложнее целиться)
const SAVE_KEY = "ballpoint.level"; // localStorage: на каком уровне игрок остановился

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// ---------- Уровни ----------
// anchor — рогатка; balloons — шары; blocks — блоки-отбойники; voids — пустоты.
// Низ экрана всегда «пустота». Шары лежат вдоль реального пути пилы С ОТСКОКАМИ,
// поэтому без рикошета от блоков уровень не пройти. Все решаются за один бросок.
const LEVELS = [
  // 1 — обучение: мягкая дуга, без блоков. Предпросмотр показывает весь путь.
  {
    anchor: { x: 140, y: 330 },
    balloons: [
      { x: 308, y: 277 }, { x: 404, y: 256 }, { x: 500, y: 242 },
      { x: 596, y: 235 }, { x: 692, y: 234 },
    ],
    blocks: [],
    voids: [],
  },
  // 2 — потолок-отражатель: бей вверх, отскок от потолка уводит пилу вниз по шарам.
  {
    anchor: { x: 150, y: 470 },
    balloons: [
      { x: 217, y: 315 }, { x: 283, y: 170 }, { x: 336, y: 61 },
      { x: 415, y: 95 }, { x: 520, y: 49 }, { x: 623, y: 65 },
    ],
    blocks: [ { x: 340, y: 150, w: 380, h: 28 } ],
    voids: [],
  },
  // 3 — скип по платформе над пустотой: пила прыгает, по бокам — провалы.
  {
    anchor: { x: 140, y: 300 },
    balloons: [
      { x: 221, y: 135 }, { x: 301, y: 36 }, { x: 381, y: 150 },
      { x: 461, y: 279 }, { x: 539, y: 421 }, { x: 631, y: 303 },
    ],
    blocks: [ { x: 360, y: 440, w: 320, h: 28 } ],
    voids: [ { x: 0, y: 472, w: 360, h: 128 }, { x: 680, y: 472, w: 280, h: 128 } ],
  },
  // 4 — две колонны: пила рикошетит между ними.
  {
    anchor: { x: 140, y: 330 },
    balloons: [
      { x: 181, y: 226 }, { x: 215, y: 151 }, { x: 255, y: 75 },
      { x: 355, y: 95 }, { x: 402, y: 178 }, { x: 456, y: 123 },
    ],
    blocks: [ { x: 380, y: 200, w: 28, h: 300 }, { x: 660, y: 120, w: 28, h: 300 } ],
    voids: [],
  },
  // 5 — полка: отскок от её верхней грани раскидывает пилу по шарам.
  {
    anchor: { x: 140, y: 440 },
    balloons: [
      { x: 173, y: 359 }, { x: 238, y: 241 }, { x: 291, y: 190 },
      { x: 412, y: 230 }, { x: 505, y: 233 }, { x: 571, y: 241 },
    ],
    blocks: [ { x: 430, y: 300, w: 300, h: 28 } ],
    voids: [],
  },
  // 6 — потолок и пропасть: серия отскоков, справа провал в пустоту.
  {
    anchor: { x: 150, y: 470 },
    balloons: [
      { x: 166, y: 383 }, { x: 196, y: 252 }, { x: 215, y: 184 },
      { x: 276, y: 68 }, { x: 364, y: 125 }, { x: 461, y: 123 },
    ],
    blocks: [ { x: 300, y: 160, w: 360, h: 26 } ],
    voids: [ { x: 700, y: 474, w: 260, h: 126 } ],
  },
  // 7 — высокая колонна-отбойник справа.
  {
    anchor: { x: 140, y: 360 },
    balloons: [
      { x: 239, y: 226 }, { x: 322, y: 126 }, { x: 404, y: 37 },
      { x: 502, y: 69 }, { x: 599, y: 155 }, { x: 708, y: 151 },
    ],
    blocks: [ { x: 600, y: 200, w: 30, h: 360 } ],
    voids: [],
  },
  // 8 — центральная колонна: попади в неё, рикошет уводит назад вверх-влево.
  {
    anchor: { x: 140, y: 330 },
    balloons: [
      { x: 257, y: 273 }, { x: 344, y: 235 }, { x: 431, y: 201 },
      { x: 280, y: 120 }, { x: 196, y: 95 }, { x: 111, y: 77 },
    ],
    blocks: [ { x: 470, y: 180, w: 30, h: 340 } ],
    voids: [],
  },
  // 9 — две ступени-полки: пила скачет по ним через всё поле.
  {
    anchor: { x: 140, y: 300 },
    balloons: [
      { x: 297, y: 124 }, { x: 430, y: 35 }, { x: 585, y: 156 },
      { x: 739, y: 188 }, { x: 892, y: 104 }, { x: 820, y: 34 },
    ],
    blocks: [ { x: 340, y: 360, w: 170, h: 26 }, { x: 560, y: 250, w: 170, h: 26 } ],
    voids: [],
  },
  // 10 — стена с проёмом-воронкой: рикошет уводит вверх-влево.
  {
    anchor: { x: 140, y: 330 },
    balloons: [
      { x: 235, y: 268 }, { x: 329, y: 212 }, { x: 400, y: 175 },
      { x: 332, y: 121 }, { x: 245, y: 78 }, { x: 160, y: 45 },
    ],
    blocks: [ { x: 420, y: 120, w: 26, h: 200 }, { x: 420, y: 380, w: 26, h: 200 } ],
    voids: [],
  },

  // ===== Уровни 11–20 (коды из редактора, сделаны игроком) =====
  "A3mbrB64a29tcmdt9qh76ykp8fK6edd9i09fo950c4fft98670aln690834058ubp08bl65a90abp6d082h", // 11
  "A3z9dB9f3rf93nlb3rj16vcp6x9q9hl4achvdbfnabK4c1lj90n7u4ycs0jn1230f6kak7zco0k7z5f0h6m8ebiby0en58d0f6jfreb7h0hfpbp0e2s", // 12
  "A3w96B7z6mau51di48hibiK1p7t0d5e23cjhd0dcu6e0m4nj50w09by", // 13
  "Ad4dcBcbate276c13vhu1vKbb350hbkem330gbget344v0hj7020b36bc000d3q", // 14
  "A3w96Bdq9xKbm234l0ubo2u0q3tbo604h0mfg680p5pbxb7420o7bbe3j0q695n0s0r6x4s0p0z7h3v0s0x82300q0z8n1z0m9f", // 15
  "A9v2aB58326t6i5f9gK42210hcc4ddt3o0m7k000de6V4jd2310w", // 16
  "A3w96Bag7eq85jK9cemg30o9e5q0h93gy3s0l6w", // 17
  "A3w96B5x896k8676837w838j7z987ya07zap7ybh7vca7xd07zdr82ej84fc86g686gv8chr8gio8ojj8tkf90lf99md9ln69vnxa9oyanpqb1q9bwprcjp4ctoed8n9dunrdmmhecllewl4f93d9e47904y8m12ab1pa1299t2u9l", // 18
  "A3w96Bh92cK6g7j15187f8m171d8b9nba18j68d151jk47a13198r281p1ygc3d211xV01e2qn2i", // 19
  "A3w96B588x6j8c8r7o7h7x9u7jb17eca7edi7del79fk77K4a190k504p1c200l4r331o0h872d0j3t861b0k0jam130j4vb5170l1obq2v0k1kca4c0j11cu0x0k4sew2d0m32ex130i0lgk112k0fgm190i22gp2u2e0eik300h2ogq52270kky0q0e4sl92m270fna0m0e4tam8z300ed0990k2iatb62l0kaxbc0b1sb3cm2i0gf88v0g3uer8w0h10evcb1b0hhc970d3khmcd0x09j193083lj7971a0ej7af140ej7c50z0gku980c27l3bd0f13lh9d0e22m9950838mf92180jmgag140amgbw150col8y0h39oybr0z0cea9t0g15dtdp1v0cdxdt0810e5en1b08f7ew0d0ue0fg1f0bg9di081ygddj1b0chddr0b1nggf3130aifdl0a1tikdn1509jfds091likf41408kgdj081rkmdm0e10kyek0f0kledq091gmfeu0k0kncez0q0fodez0p0g", // 20
];

// ---------- Компактный код уровня ----------
// Числа — base36 фиксированной ширины (2 символа = 0..1295). Маркеры секций —
// заглавные буквы (их нет в base36): A=рогатка, B=шары, K=блоки, V=пустоты.
function enc2(n) { return clamp(Math.round(n), 0, 1295).toString(36).padStart(2, "0"); }
function isMarker(c) { return c === "A" || c === "B" || c === "K" || c === "V"; }

function encodeLevel(L) {
  let s = "A" + enc2(L.anchor.x) + enc2(L.anchor.y) + "B";
  for (const b of L.balloons) s += enc2(b.x) + enc2(b.y);
  if (L.blocks.length) { s += "K"; for (const r of L.blocks) s += enc2(r.x) + enc2(r.y) + enc2(r.w) + enc2(r.h); }
  if (L.voids.length) { s += "V"; for (const v of L.voids) s += enc2(v.x) + enc2(v.y) + enc2(v.w) + enc2(v.h); }
  return s;
}

function decodeLevel(code) {
  code = code.replace(/\s+/g, "");
  const L = { anchor: { x: 140, y: 330 }, balloons: [], blocks: [], voids: [] };
  let i = 0;
  const num = () => { const v = parseInt(code.substr(i, 2), 36); i += 2; return v; };
  while (i < code.length) {
    const m = code[i++];
    if (m === "A") { L.anchor = { x: num(), y: num() }; }
    else if (m === "B") { while (i + 4 <= code.length && !isMarker(code[i])) L.balloons.push({ x: num(), y: num() }); }
    else if (m === "K") { while (i + 8 <= code.length && !isMarker(code[i])) L.blocks.push({ x: num(), y: num(), w: num(), h: num() }); }
    else if (m === "V") { while (i + 8 <= code.length && !isMarker(code[i])) L.voids.push({ x: num(), y: num(), w: num(), h: num() }); }
    else break;
  }
  return L;
}

function codeToLevel(x) { return typeof x === "string" ? decodeLevel(x) : x; }

// ---------- Состояние игры ----------
const game = {
  levelIndex: 0,
  state: "ready",   // ready | aim | fly | win
  anchor: { x: 0, y: 0 },
  balloons: [],
  blocks: [],
  voids: [],
  saw: null,        // {x,y,vx,vy,angle}
  aiming: false,
  pull: { x: 0, y: 0 },   // вектор натяжения (от anchor к точке захвата)
  particles: [],
  toast: null,      // {text, life}
  shotFrames: 0,
  restFrames: 0,
  testing: false,   // проигрывание уровня из редактора
};

const PALETTE = ["#ff6b6b", "#ffd93d", "#6bcB77", "#4d9de0", "#c77dff", "#ff9f4d"];

// ---------- DOM ----------
const overlay = document.getElementById("overlay");
const message = document.getElementById("message");
const msgTitle = document.getElementById("msgTitle");
const msgText = document.getElementById("msgText");
const msgBtn = document.getElementById("msgBtn");
const levelLabel = document.getElementById("levelLabel");
const balloonLabel = document.getElementById("balloonLabel").querySelector("span");

document.getElementById("startBtn").addEventListener("click", () => {
  overlay.classList.remove("show");
  overlay.classList.add("hidden");
  loadLevel(loadProgress());
});
document.getElementById("restartBtn").addEventListener("click", () => {
  if (game.testing) loadLevelData(editor.level);
  else loadLevel(game.levelIndex);
});
msgBtn.addEventListener("click", onMsgButton);

// кнопки редактора — подключаются только если DOM редактора есть на странице
// (его содержит локальный editor.html; в опубликованном index.html редактора нет).
if (document.getElementById("editorBtn")) {
  document.getElementById("editorBtn").addEventListener("click", enterEditor);
  document.getElementById("edMenu").addEventListener("click", exitEditorToMenu);
  document.getElementById("edTest").addEventListener("click", editorTest);
  document.getElementById("edClear").addEventListener("click", editorClear);
  document.getElementById("edCopy").addEventListener("click", editorCopy);
  document.getElementById("edLoad").addEventListener("click", editorLoadFromText);
  document.getElementById("backToEdBtn").addEventListener("click", backToEditor);
  for (const btn of document.querySelectorAll(".edtool"))
    btn.addEventListener("click", () => editorSetTool(btn.dataset.tool));
}

// ---------- Утилиты ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const len = (x, y) => Math.hypot(x, y);

// ---------- Загрузка уровня ----------
function loadLevel(i) {
  game.levelIndex = i;
  game.testing = false;
  try { localStorage.setItem(SAVE_KEY, String(i)); } catch (e) {}
  loadLevelData(codeToLevel(LEVELS[i]));
}

// прогресс игрока (последний открытый уровень) из localStorage
function loadProgress() {
  let i = 0;
  try { i = parseInt(localStorage.getItem(SAVE_KEY), 10) || 0; } catch (e) {}
  return clamp(i, 0, LEVELS.length - 1);
}

function loadLevelData(lv) {
  game.anchor = { ...lv.anchor };
  game.balloons = lv.balloons.map((b, idx) => ({
    x: b.x, y: b.y, r: BALLOON_R, popped: false,
    color: PALETTE[idx % PALETTE.length], phase: Math.random() * Math.PI * 2,
  }));
  game.blocks = lv.blocks.map((b) => ({ ...b }));
  game.voids = lv.voids.map((v) => ({ ...v }));
  game.particles = [];
  game.toast = null;
  message.classList.add("hidden");
  message.classList.remove("show");
  resetSaw();
  updateHud();
}

function resetSaw() {
  game.saw = { x: game.anchor.x, y: game.anchor.y, vx: 0, vy: 0, angle: 0 };
  game.pull = { x: 0, y: 0 };
  game.aiming = false;
  game.state = "aim";
  game.shotFrames = 0;
  game.restFrames = 0;
}

function updateHud() {
  levelLabel.textContent = game.testing ? "Тест" : "Уровень " + (game.levelIndex + 1);
  balloonLabel.textContent = game.balloons.filter((b) => !b.popped).length;
}

// ---------- Ввод (мышь + тач) ----------
function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  return {
    x: ((src.clientX - rect.left) / rect.width) * W,
    y: ((src.clientY - rect.top) / rect.height) * H,
  };
}

function onDown(e) {
  if (editor.active) { e.preventDefault(); editorPointer("down", e); return; }
  if (game.state !== "aim") return;
  e.preventDefault();
  game.aiming = true;
  onMove(e);
}

function onMove(e) {
  if (editor.active) { if (editor.drag) { e.preventDefault(); editorPointer("move", e); } return; }
  if (!game.aiming || game.state !== "aim") return;
  e.preventDefault();
  const p = pointerPos(e);
  let dx = p.x - game.anchor.x;
  let dy = p.y - game.anchor.y;
  const d = len(dx, dy);
  if (d > MAX_PULL) { dx = (dx / d) * MAX_PULL; dy = (dy / d) * MAX_PULL; }
  game.pull = { x: dx, y: dy };
  // пила «оттянута» в точку захвата
  game.saw.x = game.anchor.x + dx;
  game.saw.y = game.anchor.y + dy;
}

function onUp(e) {
  if (editor.active) { editorPointer("up", e); return; }
  if (!game.aiming || game.state !== "aim") return;
  e.preventDefault();
  game.aiming = false;
  const d = len(game.pull.x, game.pull.y);
  if (d < 12) { resetSaw(); return; } // слишком слабо — отмена
  // запуск в сторону, противоположную натяжению (рогатка)
  game.saw.vx = -game.pull.x * POWER;
  game.saw.vy = -game.pull.y * POWER;
  game.state = "fly";
  game.shotFrames = 0;
  game.restFrames = 0;
}

canvas.addEventListener("mousedown", onDown);
window.addEventListener("mousemove", onMove);
window.addEventListener("mouseup", onUp);
canvas.addEventListener("touchstart", onDown, { passive: false });
canvas.addEventListener("touchmove", onMove, { passive: false });
canvas.addEventListener("touchend", onUp, { passive: false });

// ---------- Редактор уровней ----------
const editor = {
  active: false,
  tool: "balloon",
  level: { anchor: { x: 140, y: 330 }, balloons: [], blocks: [], voids: [] },
  drag: null,   // {x0,y0,x1,y1,kind} во время рисования блока/пустоты
};
const editorUI = document.getElementById("editorUI");
const hudEl = document.getElementById("hud");
const backToEdBtn = document.getElementById("backToEdBtn");
const edText = document.getElementById("edText");

function enterEditor() {
  overlay.classList.add("hidden"); overlay.classList.remove("show");
  message.classList.add("hidden"); message.classList.remove("show");
  game.testing = false;
  editor.active = true;
  editor.drag = null;
  game.state = "editor";
  editorUI.classList.remove("hidden");
  hudEl.classList.add("hidden");
  backToEdBtn.classList.add("hidden");
  editorRefreshCode();
}

function exitEditorToMenu() {
  editor.active = false;
  editorUI.classList.add("hidden");
  hudEl.classList.remove("hidden");
  overlay.classList.remove("hidden"); overlay.classList.add("show");
  game.state = "ready";
}

function editorSetTool(t) {
  editor.tool = t;
  for (const btn of document.querySelectorAll(".edtool"))
    btn.classList.toggle("active", btn.dataset.tool === t);
}

function editorPointer(phase, e) {
  const p = pointerPos(e);
  p.x = clamp(Math.round(p.x), 0, W);
  p.y = clamp(Math.round(p.y), 0, H);
  const L = editor.level, tool = editor.tool;
  if (tool === "balloon") {
    if (phase === "down") { L.balloons.push({ x: p.x, y: p.y }); editorRefreshCode(); }
  } else if (tool === "anchor") {
    if (phase === "down") { L.anchor = { x: p.x, y: p.y }; editorRefreshCode(); }
  } else if (tool === "erase") {
    if (phase === "down") { editorErase(p); editorRefreshCode(); }
  } else if (tool === "block" || tool === "void") {
    if (phase === "down") editor.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, kind: tool };
    else if (phase === "move" && editor.drag) { editor.drag.x1 = p.x; editor.drag.y1 = p.y; }
    else if (phase === "up" && editor.drag) {
      const r = dragToRect(editor.drag), kind = editor.drag.kind;
      editor.drag = null;
      if (r.w >= 8 && r.h >= 8) { (kind === "block" ? L.blocks : L.voids).push(r); editorRefreshCode(); }
    }
  }
}

function dragToRect(d) {
  return { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) };
}

function pointInRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

function editorErase(p) {
  const L = editor.level;
  for (let i = L.balloons.length - 1; i >= 0; i--)
    if (len(L.balloons[i].x - p.x, L.balloons[i].y - p.y) < BALLOON_R + 6) { L.balloons.splice(i, 1); return; }
  for (let i = L.blocks.length - 1; i >= 0; i--) if (pointInRect(p, L.blocks[i])) { L.blocks.splice(i, 1); return; }
  for (let i = L.voids.length - 1; i >= 0; i--) if (pointInRect(p, L.voids[i])) { L.voids.splice(i, 1); return; }
}

function editorRefreshCode() { edText.value = encodeLevel(editor.level); }

function editorCopy() {
  edText.select();
  if (navigator.clipboard) navigator.clipboard.writeText(edText.value);
  else document.execCommand("copy");
  showToast("Код скопирован");
}

function editorLoadFromText() {
  const code = edText.value.trim();
  if (!code) return;
  try {
    editor.level = decodeLevel(code);
    editorRefreshCode();
    showToast("Уровень вставлен");
  } catch (err) { showToast("Не разобрал код"); }
}

function editorClear() {
  editor.level = { anchor: { x: 140, y: 330 }, balloons: [], blocks: [], voids: [] };
  editorRefreshCode();
}

function editorTest() {
  if (editor.level.balloons.length === 0) { showToast("Сначала добавь шары"); return; }
  editor.active = false;
  editorUI.classList.add("hidden");
  hudEl.classList.remove("hidden");
  backToEdBtn.classList.remove("hidden");
  game.testing = true;
  loadLevelData(editor.level);
}

function backToEditor() {
  backToEdBtn.classList.add("hidden");
  enterEditor();
}

// ---------- Физика ----------
function update() {
  if (game.state === "fly") stepSaw();
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= 1;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  for (const b of game.balloons) b.phase += 0.05;
  if (game.toast && --game.toast.life <= 0) game.toast = null;
}

function stepSaw() {
  const s = game.saw;
  game.shotFrames++;

  s.vy += GRAVITY;
  s.vx *= 0.999;
  s.x += s.vx;
  s.y += s.vy;

  const speed = len(s.vx, s.vy);
  s.angle += clamp(speed * 0.025, 0, 0.5) + 0.08;

  // стены поля (кроме низа — там пустота)
  if (s.x < SAW_R) { s.x = SAW_R; s.vx = Math.abs(s.vx) * WALL_BOUNCE; }
  if (s.x > W - SAW_R) { s.x = W - SAW_R; s.vx = -Math.abs(s.vx) * WALL_BOUNCE; }
  if (s.y < SAW_R) { s.y = SAW_R; s.vy = Math.abs(s.vy) * WALL_BOUNCE; }

  // блоки
  for (const r of game.blocks) collideRect(s, r);

  // шары — пила прорезает их насквозь
  for (const b of game.balloons) {
    if (b.popped) continue;
    if (len(s.x - b.x, s.y - b.y) < SAW_R + b.r) popBalloon(b);
  }

  // пустоты внутри поля
  for (const v of game.voids) {
    if (s.x > v.x && s.x < v.x + v.w && s.y + SAW_R > v.y) { loseSaw(); return; }
  }

  // упала за нижнюю границу — пустота
  if (s.y - SAW_R > H) { loseSaw(); return; }

  // победа
  if (game.balloons.every((b) => b.popped)) { winLevel(); return; }

  // пила почти остановилась — конец броска
  if (speed < 0.55) { if (++game.restFrames > 45) endShot(); }
  else game.restFrames = 0;

  // страховка от бесконечного полёта
  if (game.shotFrames > 60 * 14) endShot();
}

// круг (пила) против прямоугольника (блок)
function collideRect(s, r) {
  const cx = clamp(s.x, r.x, r.x + r.w);
  const cy = clamp(s.y, r.y, r.y + r.h);
  let dx = s.x - cx;
  let dy = s.y - cy;
  let d2 = dx * dx + dy * dy;
  if (d2 > SAW_R * SAW_R) return;

  let nx, ny, overlap;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    nx = dx / d; ny = dy / d;
    overlap = SAW_R - d;
  } else {
    // центр пилы внутри блока — выталкиваем по ближайшей грани
    const left = s.x - r.x, right = r.x + r.w - s.x;
    const top = s.y - r.y, bottom = r.y + r.h - s.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) { nx = -1; ny = 0; }
    else if (m === right) { nx = 1; ny = 0; }
    else if (m === top) { nx = 0; ny = -1; }
    else { nx = 0; ny = 1; }
    overlap = SAW_R + m;
  }

  s.x += nx * overlap;
  s.y += ny * overlap;
  const vn = s.vx * nx + s.vy * ny;
  if (vn < 0) {
    s.vx -= (1 + RESTITUTION) * vn * nx;
    s.vy -= (1 + RESTITUTION) * vn * ny;
  }
}

function popBalloon(b) {
  b.popped = true;
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 3;
    game.particles.push({
      x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
      life: 22 + Math.random() * 12, color: b.color, r: 2 + Math.random() * 3,
    });
  }
  updateHud();
}

function loseSaw() {
  if (game.balloons.every((b) => b.popped)) { winLevel(); return; }
  endShot();
}

function endShot() {
  if (game.balloons.every((b) => b.popped)) { winLevel(); return; }
  // промах — шары возвращаются, даём ещё один бросок
  restoreBalloons();
  showToast("Промах! Шары вернулись");
  resetSaw();
}

function restoreBalloons() {
  for (const b of game.balloons) b.popped = false;
  updateHud();
}

function showToast(text) {
  game.toast = { text, life: 100 };
}

function winLevel() {
  game.state = "win";
  if (game.testing) { showMessage("Тест пройден! 🎉", "Уровень проходится за один бросок.", "← В редактор"); return; }
  const last = game.levelIndex >= LEVELS.length - 1;
  showMessage(
    last ? "🏆 Победа!" : "Уровень пройден!",
    last ? "Ты прошёл все уровни Ball Point!" : "Отличный бросок!",
    last ? "Играть заново" : "Следующий уровень"
  );
}

function showMessage(title, text, btn) {
  msgTitle.textContent = title;
  msgText.textContent = text;
  msgBtn.textContent = btn;
  message.classList.remove("hidden");
  message.classList.add("show");
}

function onMsgButton() {
  if (game.testing) { backToEditor(); return; }
  const last = game.levelIndex >= LEVELS.length - 1;
  loadLevel(last ? 0 : game.levelIndex + 1);
}

// ---------- Отрисовка ----------
function render() {
  if (editor.active) { renderEditor(); return; }
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  for (const v of game.voids) drawVoid(v.x, v.y, v.w, v.h);
  drawBottomVoid();
  for (const r of game.blocks) drawBlock(r);
  for (const b of game.balloons) if (!b.popped) drawBalloon(b);
  drawParticles();
  drawSlingshot();
  if (game.state === "aim" && game.aiming) drawTrajectory();
  if (game.saw && (game.state === "aim" || game.state === "fly")) drawSaw(game.saw);
  if (game.toast) drawToast();
}

function renderEditor() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawEditorGrid();
  const L = editor.level;
  for (const v of L.voids) drawVoid(v.x, v.y, v.w, v.h);
  drawBottomVoid();
  for (const r of L.blocks) drawBlock(r);
  L.balloons.forEach((b, i) =>
    drawBalloon({ x: b.x, y: b.y, r: BALLOON_R, color: PALETTE[i % PALETTE.length], phase: 0 }));
  game.anchor = L.anchor;
  drawSlingshot();
  if (editor.drag) {
    const r = dragToRect(editor.drag);
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = editor.drag.kind === "block" ? "#aab4cf" : "#5a6b8c";
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  if (game.toast) drawToast();
}

function drawEditorGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
}

function drawToast() {
  const a = Math.min(1, game.toast.life / 30);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = "center";
  ctx.font = "bold 24px -apple-system, system-ui, sans-serif";
  const w = ctx.measureText(game.toast.text).width + 44;
  ctx.fillStyle = "rgba(10,14,22,0.72)";
  roundRect(W / 2 - w / 2, 74, w, 44, 14);
  ctx.fill();
  ctx.fillStyle = "#ffe08a";
  ctx.fillText(game.toast.text, W / 2, 102);
  ctx.restore();
}

// Кеш градиентов: создаём один раз и переиспользуем каждый кадр. Без этого
// на уровнях с десятками блоков/шаров пересоздание градиентов сильно тормозит.
let _bgGrad = null, _sunGrad = null, _sawGrad = null;
const _blockGrads = {};   // по высоте блока
const _voidGrads = {};    // по "y_h"
const _balloonGrads = {}; // по цвету

function drawBackground() {
  if (!_bgGrad) {
    _bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    _bgGrad.addColorStop(0, "#3a4d70");
    _bgGrad.addColorStop(1, "#222c40");
    _sunGrad = ctx.createRadialGradient(W * 0.5, -60, 30, W * 0.5, -60, 360);
    _sunGrad.addColorStop(0, "rgba(255,225,160,0.35)");
    _sunGrad.addColorStop(1, "rgba(255,225,160,0)");
  }
  ctx.fillStyle = _bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = _sunGrad;
  ctx.fillRect(0, 0, W, H);
}

function drawBottomVoid() {
  drawVoidShape(0, H - 26, W, 60);
}

function drawVoid(x, y, w, h) {
  drawVoidShape(x, y, w, h);
}

// Тёмная пропасть с зубчатым верхним краем
function drawVoidShape(x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  const teeth = Math.max(3, Math.round(w / 26));
  ctx.moveTo(x, y + 14);
  for (let i = 0; i <= teeth; i++) {
    const px = x + (w / teeth) * i;
    ctx.lineTo(px, y + (i % 2 === 0 ? 14 : 0));
  }
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  const vk = y + "_" + h;
  let g = _voidGrads[vk];
  if (!g) {
    g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#0b0e16");
    g.addColorStop(1, "#05070c");
    _voidGrads[vk] = g;
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(120,150,200,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBlock(r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  let g = _blockGrads[r.h];
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, r.h);
    g.addColorStop(0, "#7d8aa8");
    g.addColorStop(1, "#4a5573");
    _blockGrads[r.h] = g;
  }
  roundRect(0, 0, r.w, r.h, 8);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#2f3850";
  ctx.stroke();
  // блик сверху
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  roundRect(4, 4, r.w - 8, Math.min(8, r.h - 8), 4);
  ctx.fill();
  ctx.restore();
}

function drawBalloon(b) {
  const sway = Math.sin(b.phase) * 3;
  let c = _balloonGrads[b.color];
  if (!c) {
    const g = ctx.createRadialGradient(-5, -6, 3, 0, 0, BALLOON_R + 3);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, b.color);
    g.addColorStop(1, shade(b.color, -0.25));
    c = { body: g, knot: shade(b.color, -0.2) };
    _balloonGrads[b.color] = c;
  }
  ctx.save();
  ctx.translate(b.x + sway, b.y);
  // нить (нижний конец привязан без качания)
  ctx.beginPath();
  ctx.moveTo(0, b.r);
  ctx.quadraticCurveTo(1.5 * sway, b.r + 18, -sway, b.r + 34);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // тело шара
  ctx.beginPath();
  ctx.ellipse(0, 0, b.r, b.r + 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.body;
  ctx.fill();
  // узелок
  ctx.beginPath();
  ctx.moveTo(-4, b.r + 2);
  ctx.lineTo(4, b.r + 2);
  ctx.lineTo(0, b.r + 7);
  ctx.closePath();
  ctx.fillStyle = c.knot;
  ctx.fill();
  ctx.restore();
}

function drawSaw(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  const teeth = 12;
  const inner = SAW_R - 6;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    ctx.lineTo(Math.cos(a0) * SAW_R, Math.sin(a0) * SAW_R);
    ctx.lineTo(Math.cos(a1) * (SAW_R + 5), Math.sin(a1) * (SAW_R + 5));
    ctx.lineTo(Math.cos(a2) * SAW_R, Math.sin(a2) * SAW_R);
  }
  ctx.closePath();
  if (!_sawGrad) {
    _sawGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, SAW_R + 5);
    _sawGrad.addColorStop(0, "#eef2ff");
    _sawGrad.addColorStop(1, "#9aa6c4");
  }
  ctx.fillStyle = _sawGrad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#3a4258";
  ctx.stroke();
  // центр
  ctx.beginPath();
  ctx.arc(0, 0, inner * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = "#3a4258";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, inner * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "#cfd6ea";
  ctx.fill();
  ctx.restore();
}

function drawSlingshot() {
  const a = game.anchor;
  ctx.save();
  // рамка-рогатка
  ctx.strokeStyle = "#8a5a32";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + 46);
  ctx.lineTo(a.x, a.y + 12);
  ctx.moveTo(a.x, a.y + 12);
  ctx.lineTo(a.x - 14, a.y - 10);
  ctx.moveTo(a.x, a.y + 12);
  ctx.lineTo(a.x + 14, a.y - 10);
  ctx.stroke();
  // резинка (во время прицеливания тянется к пиле)
  if (game.state === "aim") {
    const sx = game.saw.x, sy = game.saw.y;
    ctx.strokeStyle = "#2d3550";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.x - 14, a.y - 10);
    ctx.lineTo(sx, sy);
    ctx.moveTo(a.x + 14, a.y - 10);
    ctx.lineTo(sx, sy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrajectory() {
  // прогноз полёта с реальными отскоками от блоков и стен
  const s = { x: game.saw.x, y: game.saw.y, vx: -game.pull.x * POWER, vy: -game.pull.y * POWER };
  ctx.save();
  for (let i = 0; i < PREVIEW_STEPS; i++) {
    s.vy += GRAVITY; s.vx *= 0.999;
    s.x += s.vx; s.y += s.vy;
    if (s.x < SAW_R) { s.x = SAW_R; s.vx = Math.abs(s.vx) * WALL_BOUNCE; }
    if (s.x > W - SAW_R) { s.x = W - SAW_R; s.vx = -Math.abs(s.vx) * WALL_BOUNCE; }
    if (s.y < SAW_R) { s.y = SAW_R; s.vy = Math.abs(s.vy) * WALL_BOUNCE; }
    for (const r of game.blocks) collideRect(s, r);
    // обрыв предпросмотра, если пила ушла бы в пустоту
    let dead = s.y - SAW_R > H;
    for (const v of game.voids) if (s.x > v.x && s.x < v.x + v.w && s.y + SAW_R > v.y) dead = true;
    if (dead) break;
    if (i % 2 === 0) {
      ctx.globalAlpha = Math.max(0.08, 0.55 - i * 0.005);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffe08a";
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 30);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- помощники рисования ----------
function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r + r * amt), 0, 255);
  g = clamp(Math.round(g + g * amt), 0, 255);
  b = clamp(Math.round(b + b * amt), 0, 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ---------- Главный цикл ----------
// В портретной ориентации на телефоне (показана заглушка «поверни телефон»)
// рендер ставим на паузу — экономим заряд и не считаем впустую.
const blockMQ = window.matchMedia("(hover: none) and (orientation: portrait) and (max-width: 900px)");
function loop() {
  if (!blockMQ.matches) { update(); render(); }
  requestAnimationFrame(loop);
}

// ---------- Масштаб под экран ----------
function fitCanvas() {
  // на тач-устройствах ограничиваем плотность пикселей — меньше нагрузка
  const touch = window.matchMedia("(hover: none)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

fitCanvas();
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", fitCanvas);
if (blockMQ.addEventListener) blockMQ.addEventListener("change", fitCanvas);
// есть сохранённый прогресс — предлагаем «Продолжить»
if (loadProgress() > 0) document.getElementById("startBtn").textContent = "Продолжить";
loop();
