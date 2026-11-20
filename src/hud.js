// Game HUD: bottom material dock, selection tag, quiet status, controls sheet.
import './hud.css';

const ICON = {
  tower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 21V8h2.5V5H10v3h4V5h2.5v3H19v13z"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/></svg>',
  battlement: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 27V11h5v4h4v-4h6v4h4v-4h5v16z"/><path d="M4 20h24" opacity=".45"/><path d="M12 27v-3h8v3" opacity=".45"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
  brush: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M26 5 14.5 16.5"/><path d="M12.5 15.5c2-.6 4 1.4 3.4 3.4-.9 3.1-3.6 5.6-9.4 6.1 1.4-1.7 1.3-3.5 2-5.6.6-2 2-3.4 4-3.9z"/></svg>',
  clear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
};

const CONTROLS = [
  ['Building', [
    ['Select an area', 'Left-drag a surface (crosshair in Fly)'],
    ['Build out / dig in', 'Drag the selection'],
    ['Add / remove one step', '<kbd>E</kbd> <kbd>Q</kbd>'],
    ['Clear selection', '<kbd>Esc</kbd>'],
    ['Expand the plot 8 blocks', 'Click a + at a plot edge'],
    ['Materials', '<kbd>1</kbd> – <kbd>8</kbd>'],
    ['Castle / Land & Water tab', '<kbd>V</kbd>'],
    ['Paint selection with material', '<kbd>F</kbd>'],
    ['Step: full / half / quarter', '<kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd>'],
    ['Auto-shape on / off', '<kbd>B</kbd>'],
  ]],
  ['Moving', [
    ['Fly', '<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>'],
    ['Up / down', '<kbd>Space</kbd> <kbd>Shift</kbd>'],
    ['Switch Fly / Build mode', '<kbd>Tab</kbd>'],
    ['Look (Build mode)', 'Hold right mouse'],
    ['Glide forward / back', 'Wheel'],
    ['Fly speed', 'Right mouse + wheel'],
    ['Tilt-shift lens', '<kbd>T</kbd>'],
  ]],
  ['Interface', [
    ['Hide the HUD', '<kbd>H</kbd>'],
    ['This sheet', '<kbd>?</kbd> or <kbd>F1</kbd>'],
    ['Leave Fly mode', '<kbd>Esc</kbd>'],
  ]],
];

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

export function createHud({ materials, steps, onMat, onStep, onShape, onClear, onGroup, onPaint, onExpand }) {
  const root = el(`
    <div id="hud">
      <div class="hud-top">
        <div class="panel brand">
          <span class="brand-mark">${ICON.tower}</span>
          <span class="brand-name">Castle Builder</span>
          <span class="save"></span>
        </div>
        <div class="panel icons">
          <button class="icon-btn" data-act="help" data-tip="Controls  ?">${ICON.help}</button>
          <button class="icon-btn" data-act="hide" data-tip="Hide HUD  H">${ICON.eye}</button>
          <button class="icon-btn" data-act="clear" data-tip="Clear the plot">${ICON.clear}</button>
          <div class="confirm">Clear the whole plot? <button class="yes">Clear</button><button class="no">Keep</button></div>
        </div>
      </div>

      <div class="crosshair"></div>
      <div class="mode-badge panel"><span class="mode-name"></span><kbd>Tab</kbd></div>

      <div class="edges">
        <button class="edge" data-side="n" data-tip="Expand plot north">+</button>
        <button class="edge" data-side="s" data-tip="Expand plot south">+</button>
        <button class="edge" data-side="e" data-tip="Expand plot east">+</button>
        <button class="edge" data-side="w" data-tip="Expand plot west">+</button>
      </div>

      <div class="tag"><span class="dim"></span><span class="pull"></span></div>

      <div class="panel hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to <b>fly</b><span class="dot"></span>drag a surface, then drag it up to <b>build</b><span class="dot"></span><kbd>Tab</kbd> fly / build<span class="dot"></span><kbd>?</kbd> controls</div>

      <div class="dock-wrap">
        <div class="mat-name"></div>
        <div class="panel dock">
          <div class="mat-col">
            <div class="tabs"><button data-g="castle">Castle</button><button data-g="land">Land &amp; Water</button><kbd>V</kbd></div>
            <div class="group mats"></div>
          </div>
          <div class="sep"></div>
          <div class="seg">
            <div class="seg-label">Step</div>
            <div class="seg-row steps"></div>
          </div>
          <div class="sep"></div>
          <div class="group">
            <button class="toggle paint" data-tip="Paint selection  F">${ICON.brush}</button>
            <button class="toggle shape" data-tip="Auto-shape  B">${ICON.battlement}</button>
          </div>
        </div>
      </div>

      <div class="sheet-back">
        <div class="panel sheet">
          <h2>Controls <span>Esc to close</span></h2>
          <div class="sheet-cols">
            ${CONTROLS.map(([h, rows]) => `<h3>${h}</h3>` + rows.map(([a, k]) => `<div class="row-k"><span>${a}</span><span>${k}</span></div>`).join('')).join('')}
          </div>
        </div>
      </div>
    </div>`);
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);

  // materials
  const matsEl = $('.mats');
  for (const m of materials) {
    const b = el(`<button class="chip" data-tip="${m.name}"><span class="key">${m.key}</span></button>`);
    b.style.backgroundImage = `url(${m.thumb})`;
    b.dataset.id = m.id;
    b.dataset.group = m.group;
    b.addEventListener('click', () => onMat(m.id));
    matsEl.appendChild(b);
  }
  const stepsEl = $('.steps');
  for (const s of steps) {
    const b = el(`<button data-tip="${s.name}  ${s.key}">${s.label}</button>`);
    b.dataset.v = s.value;
    b.addEventListener('click', () => onStep(s.value));
    stepsEl.appendChild(b);
  }
  $('.shape').addEventListener('click', () => onShape());
  const edges = {};
  for (const b of root.querySelectorAll('.edge')) { edges[b.dataset.side] = b; b.addEventListener('click', () => onExpand(b.dataset.side)); }
  $('.paint').addEventListener('click', () => onPaint());
  for (const t of root.querySelectorAll('.tabs button')) t.addEventListener('click', () => onGroup(t.dataset.g));

  // name banner
  const nameEl = $('.mat-name');
  let nameTimer;
  function flashName(text) {
    nameEl.textContent = text;
    nameEl.classList.add('show');
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => nameEl.classList.remove('show'), 1400);
  }

  // top-right actions
  const icons = $('.icons');
  icons.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'help') toggleControls();
    else if (act === 'hide') toggleHidden();
    else if (act === 'clear') icons.classList.add('confirming');
  });
  $('.confirm .yes').addEventListener('click', () => { icons.classList.remove('confirming'); onClear(); });
  $('.confirm .no').addEventListener('click', () => icons.classList.remove('confirming'));

  // controls sheet
  const sheet = $('.sheet-back');
  sheet.addEventListener('click', e => { if (e.target === sheet) toggleControls(false); });
  function toggleControls(force) {
    sheet.classList.toggle('show', force ?? !sheet.classList.contains('show'));
  }
  function toggleHidden() { root.classList.toggle('hidden'); }

  // one-time hint
  const hint = $('.hint');
  let hintSeen = false;
  try { hintSeen = localStorage.getItem('castle.hint') === '1'; } catch {}
  if (hintSeen) hint.remove();
  function dismissHint() {
    if (!hint.isConnected) return;
    hint.classList.add('gone');
    setTimeout(() => hint.remove(), 700);
    try { localStorage.setItem('castle.hint', '1'); } catch {}
  }

  // save status
  const saveEl = $('.save');
  let saveTimer;
  function saved(ok) {
    saveEl.textContent = ok ? 'Saved' : 'Save failed';
    saveEl.classList.toggle('error', !ok);
    saveEl.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveEl.classList.remove('show'), ok ? 1600 : 5000);
  }

  // selection tag
  const tag = $('.tag'), dimEl = $('.tag .dim'), pullEl = $('.tag .pull');

  let first = true;
  return {
    setGroup(g) {
      for (const t of root.querySelectorAll('.tabs button')) t.classList.toggle('on', t.dataset.g === g);
      for (const b of matsEl.children) b.hidden = b.dataset.group !== g;
    },
    setMat(id) {
      for (const b of matsEl.children) b.classList.toggle('on', +b.dataset.id === id);
      if (!first) flashName(materials.find(m => m.id === id).name);
    },
    setStep(v) { for (const b of stepsEl.children) b.classList.toggle('on', +b.dataset.v === v); },
    setMode(m) {
      root.classList.toggle('mode-fly', m === 'fly');
      $('.mode-name').textContent = m === 'fly' ? 'Fly' : 'Build';
    },
    flash: flashName,
    setShape(on) { $('.shape').classList.toggle('on', on); if (!first) flashName('Auto-shape ' + (on ? 'on' : 'off')); },
    ready() { first = false; },
    tag(dim, pull = '', neg = false) {
      if (dim == null) { tag.classList.remove('show'); return; }
      dimEl.textContent = dim;
      pullEl.textContent = pull;
      pullEl.classList.toggle('neg', neg);
      tag.classList.add('show');
    },
    placeTag(x, y) { tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 10px))`; },
    tagVisible: () => tag.classList.contains('show'),
    placeEdge(side, x, y, show) {
      const b = edges[side];
      b.classList.toggle('show', show);
      if (show) b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    },
    saved,
    dismissHint,
    toggleControls,
    toggleHidden,
    controlsOpen: () => sheet.classList.contains('show'),
  };
}
