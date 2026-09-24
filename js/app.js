(function () {
'use strict';

// ===================== Утилиты =====================
const app = document.getElementById('app');
const $ = (s, r = app) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many); };
const countries = n => `${n} ${plural(n, 'страна', 'страны', 'стран')}`;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('geo:' + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('geo:' + k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } },
};
function saveBest(id, pct, secs, label) {
  if (!id) return;
  const b = store.get('best:' + id);
  if (!b || pct > b.pct || (pct === b.pct && secs < b.secs)) store.set('best:' + id, { pct, secs, label, at: Date.now() });
  else if (label && !b.label) store.set('best:' + id, Object.assign(b, { label }));
}
function allBest() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('geo:best:')) { const v = store.get(k.slice(4)); if (v) out.push(Object.assign({ id: k.slice(9) }, v)); }
    }
  } catch (e) { /* хранилище недоступно */ }
  return out;
}
const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(35); } catch (e) { /* нет вибрации */ } };
const best = id => { const b = store.get('best:' + id); return b ? `${b.pct}%` : ''; };

// ===================== Данные =====================
const C = {}, BYNAME = {};
COUNTRIES.forEach(([key, name, cont, sp]) => { C[key] = { key, name, cont, special: !!sp }; BYNAME[name] = key; });
const nameOf = k => (C[k] ? C[k].name : k);
const keysOf = names => names.map(n => { const k = BYNAME[n]; if (!k) console.warn('Неизвестная страна:', n); return k; }).filter(Boolean);
const UN_KEYS = Object.keys(C).filter(k => !C[k].special); // члены ООН + Ватикан

Object.keys(MONARCHIES).concat(Object.keys(FEDERATIONS)).forEach(n => { if (!BYNAME[n]) console.warn('Неизвестная страна:', n); });

const govOf = k => (MONARCHIES[nameOf(k)] ? MONARCHIES[nameOf(k)][0] : 'rep');
const govInfo = k => {
  const n = nameOf(k), m = MONARCHIES[n];
  if (m) return `${GOV_TYPES[m[0]].label}. Глава государства: ${m[1]}`;
  return REPUBLIC_NOTES[n] ? `Республика: ${REPUBLIC_NOTES[n]}` : 'Республика';
};
const isFed = k => !!FEDERATIONS[nameOf(k)];
const fedInfo = k => {
  const n = nameOf(k);
  if (FEDERATIONS[n]) return `Федерация: ${FEDERATIONS[n]}`;
  return UNITARY_NOTES[n] ? UNITARY_NOTES[n][0].toUpperCase() + UNITARY_NOTES[n].slice(1) : 'Унитарное государство';
};

const ORG_SETS = ORGS.map(o => ({ short: o.short, set: new Set(keysOf(o.members)) }));
const orgsOf = k => ORG_SETS.filter(o => o.set.has(k)).map(o => o.short);
const countryInfo = k => {
  const orgs = orgsOf(k), parts = [];
  if (C[k] && !C[k].special) parts.push(GOV_TYPES[govOf(k)].label + (isFed(k) ? ', федерация' : ''));
  parts.push(orgs.length ? 'Входит в: ' + orgs.join(', ') : 'Не входит в организации из списка');
  return parts.join('. ');
};

const REGION_FILTERS = [
  { id: 'ALL', label: 'Весь мир', conts: null, view: null, center: 10 },
  { id: 'EU', label: 'Европа', conts: ['EU'], view: [-25, 34, 45, 71] },
  { id: 'AS', label: 'Азия', conts: ['AS'], view: [25, -11, 150, 56], center: 90 },
  { id: 'AF', label: 'Африка', conts: ['AF'], view: [-26, -36, 60, 38] },
  { id: 'AM', label: 'Америка', conts: ['NA', 'SA'], view: [-170, -56, -30, 72] },
  { id: 'OC', label: 'Океания', conts: ['OC'], view: [110, -48, 200, 20], center: 160 },
];
const regionKeys = r => UN_KEYS.filter(k => !r.conts || r.conts.includes(C[k].cont));

const STRAIT_PINS = STRAITS.map((s, i) => ({ key: 's' + i, lonlat: s[1], label: s[0] }));
const straitName = k => STRAITS[+k.slice(1)][0];
const straitInfo = k => { const s = STRAITS[+k.slice(1)]; return `Соединяет ${s[2]}; разделяет ${s[3]}.`; };

// Геометрия карты
const FEATURES = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries).features;
const FIX = { 'Kosovo': 'XK', 'Somaliland': '706', 'N. Cyprus': '196' };
FEATURES.forEach(f => {
  let k = f.id != null ? String(f.id) : (FIX[f.properties.name] || null);
  if (k && !C[k]) k = null; // зависимые территории — некликабельны
  f.key = k;
});
const polysOf = (() => {
  const cache = new Map();
  return k => {
    if (cache.has(k)) return cache.get(k);
    const polys = [];
    FEATURES.filter(f => f.key === k).forEach(f => {
      const g = f.geometry; if (!g) return;
      if (g.type === 'Polygon') polys.push({ type: 'Polygon', coordinates: g.coordinates });
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(c => polys.push({ type: 'Polygon', coordinates: c }));
    });
    polys.forEach(p => { p.area = d3.geoArea(p); });
    polys.sort((a, b) => b.area - a.area);
    const main = polys.length ? polys.filter(p => p.area >= polys[0].area * 0.2) : [];
    cache.set(k, main);
    return main;
  };
})();

// ===================== Навигация =====================
let stack = [], cleanup = null;
function show(fn, arg) {
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  app.innerHTML = '';
  const r = fn(arg);
  cleanup = typeof r === 'function' ? r : null;
  const page = $('.page'); if (page) page.scrollTop = 0;
}
let histOK = true, skipPop = 0;
function go(fn, arg) {
  stack.push([fn, arg]);
  if (histOK) { try { history.pushState({ d: stack.length }, ''); } catch (e) { histOK = false; } }
  show(fn, arg);
}
function replace(fn, arg) { stack[stack.length - 1] = [fn, arg]; show(fn, arg); }
function pop() { if (stack.length > 1) { stack.pop(); const [fn, arg] = stack[stack.length - 1]; show(fn, arg); } }
function back() {
  if (stack.length <= 1) return;
  pop();
  if (histOK) { skipPop++; try { history.back(); } catch (e) { skipPop--; } setTimeout(() => { skipPop = 0; }, 400); }
}
// системная кнопка «Назад» на телефоне
window.addEventListener('popstate', () => { if (skipPop > 0) { skipPop--; return; } pop(); });

function topbar(title, stats = '') {
  return `<header class="topbar"><button class="back" aria-label="Назад">‹</button><div class="title">${esc(title)}</div><div class="stats">${stats}</div></header>`;
}
function bindBack() { const b = $('.back'); if (b) b.onclick = back; }

// ===================== Карта =====================
function GeoMap(el, o) {
  o = Object.assign({ center: 0, scope: null, pins: null, labels: false, noLandClick: false, onClick: null }, o);
  let W = Math.max(el.clientWidth, 200), H = Math.max(el.clientHeight, 160);
  const proj = d3.geoNaturalEarth1().rotate([-o.center, 0]).fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' });
  const path = d3.geoPath(proj);
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
  const g = svg.append('g');
  g.append('path').datum({ type: 'Sphere' }).attr('class', 'ocean').attr('d', path);
  g.append('path').datum(d3.geoGraticule10()).attr('class', 'grat').attr('d', path);

  const nodes = new Map();
  const reg = (k, n) => { if (!nodes.has(k)) nodes.set(k, []); nodes.get(k).push(n); };
  const base = k => (!k ? 'terr' : (o.scope && !o.scope.has(k) ? 'out' : 'in')) + (k && o.noLandClick ? ' noclick' : '');
  const fire = (k, ev) => { if (o.onClick) o.onClick(k, ev); };

  g.append('g').selectAll('path').data(FEATURES).join('path')
    .attr('d', path).attr('class', f => 'c ' + base(f.key))
    .each(function (f) { if (f.key) reg(f.key, this); })
    .on('click', (ev, f) => { if (f.key && !o.noLandClick) fire(f.key, ev); });

  const micro = o.pins ? [] : Object.entries(MICRO).filter(([k]) => C[k]); // на карте проливов кружки стран не нужны
  const mk = g.append('g').selectAll('g').data(micro).join('g').attr('transform', d => `translate(${proj(d[1])})`);
  mk.append('circle').attr('class', d => 'c mk ' + base(d[0])).each(function (d) { reg(d[0], this); });
  mk.append('circle').attr('class', 'hit').style('pointer-events', o.noLandClick ? 'none' : null)
    .on('click', (ev, d) => { if (!o.noLandClick) fire(d[0], ev); });

  const pinData = o.pins || [];
  const pinG = g.append('g');
  const pins = pinG.selectAll('g').data(pinData).join('g').attr('transform', d => `translate(${proj(d.lonlat)})`);
  pins.append('circle').attr('class', 'pin').each(function (d) { reg(d.key, this); });
  pins.append('circle').attr('class', 'hit').on('click', (ev, d) => fire(d.key, ev));
  const lbls = o.labels ? pinG.selectAll('text').data(pinData).join('text').attr('class', 'lbl')
    .attr('x', d => proj(d.lonlat)[0]).attr('y', d => proj(d.lonlat)[1]).text(d => d.label) : null;

  let T = d3.zoomIdentity;
  function rescale() {
    const k = T.k;
    mk.select('.mk').attr('r', 4.5 / k);
    mk.select('.hit').attr('r', 11 / k);
    pins.select('.pin').attr('r', 6.5 / k).attr('stroke-width', 2.5 / k);
    pins.select('.hit').attr('r', 14 / k);
    if (lbls) lbls.attr('font-size', 11.5 / k).attr('stroke-width', 3 / k).attr('dy', -10 / k).style('display', k >= 2.2 ? null : 'none');
  }
  const zoom = d3.zoom().scaleExtent([0.9, 80]).clickDistance(6)
    .translateExtent([[-W, -H], [2 * W, 2 * H]])
    .on('zoom', ev => { T = ev.transform; g.attr('transform', T); rescale(); });
  svg.call(zoom).on('dblclick.zoom', null);
  let resizeT;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!el.isConnected) { ro.disconnect(); return; }
      const W2 = Math.max(el.clientWidth, 200), H2 = Math.max(el.clientHeight, 160);
      if (Math.abs(W2 - W) < 2 && Math.abs(H2 - H) < 2) return;
      const flipped = (W > H) !== (W2 > H2);
      W = W2; H = H2;
      svg.attr('viewBox', `0 0 ${W} ${H}`);
      zoom.extent([[0, 0], [W, H]]).translateExtent([[-W, -H], [2 * W, 2 * H]]);
      if (flipped) fitView(home, false);
    }, 150);
  }) : null;
  if (ro) ro.observe(el);
  rescale();

  function apply(k, cx, cy, animate) {
    const t = d3.zoomIdentity.translate(W / 2 - k * cx, H / 2 - k * cy).scale(k);
    if (animate) svg.transition().duration(650).call(zoom.transform, t); else svg.call(zoom.transform, t);
  }
  function fitView(v, animate) {
    const [w, s, e, n] = v || [o.center - 180, -57, o.center + 180, 80], pts = [];
    for (let i = 0; i <= 12; i++) {
      const lon = w + (e - w) * i / 12, lat = s + (n - s) * i / 12;
      pts.push([lon, s], [lon, n], [w, lat], [e, lat]);
    }
    const P = pts.map(p => proj(p)).filter(Boolean);
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    // «вписать», но на вытянутом экране разрешаем обрезать края (их можно прокрутить)
    const kx = W / (x1 - x0), ky = H / (y1 - y0);
    const k = Math.max(0.9, Math.min(Math.max(kx, ky), Math.min(kx, ky) * 1.5) * 0.97);
    apply(k, (x0 + x1) / 2, (y0 + y1) / 2, animate);
  }
  function keyPoint(k) {
    if (MICRO[k]) return proj(MICRO[k]);
    const pin = pinData.find(p => p.key === k); if (pin) return proj(pin.lonlat);
    const ps = polysOf(k); if (!ps.length) return null;
    return proj(d3.geoCentroid(ps[0]));
  }
  function keyBounds(k) {
    if (MICRO[k] || k[0] === 's') return null;
    const ps = polysOf(k); if (!ps.length) return null;
    let b = null;
    for (const p of ps) {
      const pb = path.bounds(p);
      if (pb[1][0] - pb[0][0] > W * 0.6) continue; // полигон пересекает край карты
      b = b ? [[Math.min(b[0][0], pb[0][0]), Math.min(b[0][1], pb[0][1])], [Math.max(b[1][0], pb[1][0]), Math.max(b[1][1], pb[1][1])]] : pb;
    }
    if (b && b[1][0] - b[0][0] > W * 0.6) b = path.bounds(ps[0]);
    return b;
  }
  function focus(k, animate = true, opt = {}) {
    const b = keyBounds(k);
    if (!b || (b[1][0] - b[0][0] < 3 && b[1][1] - b[0][1] < 3)) {
      const p = keyPoint(k); if (!p) return;
      apply(opt.pointZoom || 7, p[0], p[1], animate); return;
    }
    const bw = Math.max(b[1][0] - b[0][0], 1), bh = Math.max(b[1][1] - b[0][1], 1);
    const frac = opt.frac || 0.4;
    const k2 = Math.max(1.1, Math.min(W * frac / bw, H * frac / bh, 16));
    apply(k2, (b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, animate);
  }
  function visible(k) {
    const p = keyPoint(k); if (!p) return true;
    const [x, y] = T.apply(p);
    return x > 10 && x < W - 10 && y > 10 && y < H - 10;
  }

  // Подсказка-всплывашка
  const tip = document.createElement('div'); tip.className = 'map-tip'; el.appendChild(tip);
  let tipTimer;
  function showTip(text, ev, cls = '', ms = 1700) {
    const r = el.getBoundingClientRect();
    let x, y;
    if (ev && ev.clientX != null) { x = ev.clientX - r.left; y = ev.clientY - r.top; }
    else if (typeof ev === 'string') {
      const p = keyPoint(ev); const s = Math.min(r.width / W, r.height / H);
      if (p) { const q = T.apply(p); x = (r.width - W * s) / 2 + q[0] * s; y = (r.height - H * s) / 2 + q[1] * s; }
    }
    if (x == null) { x = r.width / 2; y = 50; }
    tip.textContent = text; tip.className = 'map-tip show ' + cls;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(tw / 2 + 6, Math.min(r.width - tw / 2 - 6, x)) + 'px';
    tip.style.top = Math.max(th + 16, Math.min(r.height - 4, y)) + 'px';
    clearTimeout(tipTimer); tipTimer = setTimeout(() => tip.classList.remove('show'), ms);
  }

  let home = null;
  el.querySelectorAll('.zoombtns button').forEach(b => {
    b.onclick = () => {
      const z = b.dataset.z;
      if (z === 'in') svg.transition().duration(250).call(zoom.scaleBy, 1.7);
      else if (z === 'out') svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.7);
      else fitView(home, true);
    };
  });

  const each = (k, f) => (nodes.get(k) || []).forEach(f);
  return {
    add: (k, c) => each(k, n => n.classList.add(...c.split(' '))),
    remove: (k, c) => each(k, n => n.classList.remove(...c.split(' '))),
    removeAll: c => nodes.forEach(arr => arr.forEach(n => n.classList.remove(...c.split(' ')))),
    flash(k, c = 'flash', ms = 1250) {
      each(k, n => { n.classList.remove(c); void n.getBoundingClientRect(); n.classList.add(c); });
      setTimeout(() => each(k, n => n.classList.remove(c)), ms);
    },
    tip: showTip,
    setHome(v) { home = v; },
    fitView, focus,
    ensureVisible(k) { if (!visible(k)) focus(k, true, { frac: 0.2, pointZoom: 3 }); },
    home: () => fitView(home, true),
  };
}

// ===================== Общий каркас игры =====================
function gameShell(title, withTimer = true) {
  app.innerHTML = `<div class="screen game">
    ${topbar(title, withTimer ? '<span class="prog"></span><span class="timer">0:00</span>' : '')}
    <div class="progress"><div></div></div>
    <div class="prompt"></div>
    <div class="mapwrap"><div class="zoombtns"><button data-z="in" aria-label="Приблизить">+</button><button data-z="out" aria-label="Отдалить">−</button><button data-z="home" aria-label="Исходный вид">⟲</button></div></div>
    <div class="panel"></div></div>`;
  bindBack();
  return { prompt: $('.prompt'), mapEl: $('.mapwrap'), panel: $('.panel'), prog: $('.prog'), timerEl: $('.timer'), bar: $('.progress>div') };
}
function makeTimer(el) {
  const t0 = Date.now();
  const secs = () => Math.round((Date.now() - t0) / 1000);
  const id = setInterval(() => { if (el) el.textContent = fmtTime(secs()); }, 1000);
  let stopped = null;
  return { secs: () => stopped ?? secs(), stop() { clearInterval(id); if (stopped == null) stopped = secs(); } };
}
function stars(pct) { const n = pct >= 95 ? 3 : pct >= 75 ? 2 : pct >= 50 ? 1 : 0; return '★'.repeat(n) + '☆'.repeat(3 - n); }
function inlineResult(ui, r) {
  ui.bar.style.width = '100%';
  ui.prompt.innerHTML = `Результат: <b>${r.pct}%</b> <span class="sub">${r.line}</span>`;
  const list = r.mistakes && r.mistakes.length
    ? `<details style="margin-bottom:8px"><summary style="cursor:pointer;font-weight:600">${r.mistakesTitle || 'Ошибки'} (${r.mistakes.length})</summary><div class="namechips" style="margin-top:6px">${r.mistakes.map(m => `<button data-k="${esc(m.key)}">${esc(m.name)}${m.note ? ' · ' + esc(m.note) : ''}</button>`).join('')}</div></details>`
    : '';
  ui.panel.innerHTML = `${r.legend || ''}${list}<div class="btnrow">
      <button class="btn ghost" data-a="menu">Меню</button>
      ${r.onRetryWrong ? '<button class="btn ghost" data-a="wrong">Ошибки</button>' : ''}
      <button class="btn" data-a="retry">Ещё раз</button></div>`;
  ui.panel.querySelector('[data-a=menu]').onclick = back;
  ui.panel.querySelector('[data-a=retry]').onclick = r.onRetry;
  if (r.onRetryWrong) ui.panel.querySelector('[data-a=wrong]').onclick = r.onRetryWrong;
  ui.panel.querySelectorAll('.namechips button').forEach(b => { b.onclick = () => r.onChip && r.onChip(b.dataset.k); });
}

// ===================== Режим: найди на карте =====================
// cfg: { id, title, keys, view, center, pins, nameOf, infoOf, verb }
function playFind(cfg) {
  const ui = gameShell(cfg.title);
  const nm = cfg.nameOf || nameOf;
  ui.panel.innerHTML = `<div class="btnrow"><button class="btn ghost" data-a="skip">Не знаю — показать</button></div>`;
  const map = GeoMap(ui.mapEl, { center: cfg.center || 0, pins: cfg.pins, noLandClick: !!cfg.pins, onClick });
  map.setHome(cfg.view); map.fitView(cfg.view, false);
  const queue = shuffle(cfg.keys), res = {};
  let i = 0, tries = 0, busy = false, done = false;
  const timer = makeTimer(ui.timerEl);
  ui.panel.querySelector('[data-a=skip]').onclick = () => { if (!busy && !done) { res[queue[i]] = 3; reveal(); } };

  function ask() {
    if (i >= queue.length) return finish();
    tries = 0; busy = false;
    ui.prompt.innerHTML = `${cfg.verb || 'Найдите'}: <b>${esc(nm(queue[i]))}</b>`;
    ui.prog.textContent = `${i + 1}/${queue.length}`;
    ui.bar.style.width = (i / queue.length * 100) + '%';
  }
  function onClick(k, ev) {
    if (done) { map.tip(nm(k) + (cfg.infoOf ? ' — ' + cfg.infoOf(k) : ''), ev, '', 3000); return; }
    const target = queue[i];
    if (busy) {
      // ответ показан — чтобы продолжить, нужно нажать на подсвеченный объект
      if (k === target) { map.remove(target, 'hl'); map.add(target, 'fail'); map.tip(nm(k), ev, 'bad', 900); i++; ask(); }
      else map.tip('Нажмите на подсвеченный: ' + nm(target), ev, 'bad');
      return;
    }
    if (k === target) {
      res[target] = tries; map.add(target, 'ok' + (tries + 1)); map.tip(nm(k), ev, 'good', 900);
      i++; ask();
    } else {
      tries++; buzz(); map.flash(k); map.tip('Это: ' + nm(k), ev, 'bad');
      if (tries >= 3) { res[target] = 3; reveal(); }
    }
  }
  function reveal() {
    busy = true;
    const t = queue[i];
    map.add(t, 'hl'); map.ensureVisible(t);
    ui.prompt.innerHTML = `Правильный ответ: <b>${esc(nm(t))}</b> <span class="sub">подсвечен на карте — нажмите на него, чтобы продолжить</span>`;
  }
  function finish() {
    done = true; timer.stop();
    const n = queue.length;
    const pts = queue.reduce((s, k) => s + [1, 0.5, 0.25, 0][res[k]], 0);
    const pct = Math.round(pts / n * 100);
    const first = queue.filter(k => res[k] === 0).length;
    saveBest(cfg.id, pct, timer.secs(), cfg.title + ' — найди на карте');
    map.home();
    const wrong = queue.filter(k => res[k] > 0);
    inlineResult(ui, {
      pct, line: `С первой попытки: ${first} из ${n} · время ${fmtTime(timer.secs())} · ${stars(pct)}`,
      mistakes: wrong.map(k => ({ key: k, name: nm(k), note: res[k] === 3 ? 'не найдено' : `${res[k] + 1}-я попытка` })),
      legend: `<div class="legend"><span><i style="background:var(--c-ok1)"></i>1-я попытка</span><span><i style="background:var(--c-ok2)"></i>2-я</span><span><i style="background:var(--c-ok3)"></i>3-я</span><span><i style="background:var(--c-fail)"></i>не найдено</span></div>`,
      onRetry: () => replace(playFind, cfg),
      onRetryWrong: wrong.length ? () => replace(playFind, Object.assign({}, cfg, { keys: wrong, id: null, title: cfg.title + ' — ошибки' })) : null,
      onChip: k => { map.focus(k, true, { frac: 0.25, pointZoom: 4 }); map.flash(k, 'blink', 2000); },
    });
  }
  ask();
  return () => timer.stop();
}

// ===================== Режим: отметь все =====================
// cfg: { id, title, keys, what, view, center, infoOf }
function playSelect(cfg) {
  const ui = gameShell(cfg.title);
  const target = new Set(cfg.keys), sel = new Set(), n = target.size;
  let checked = false;
  ui.prompt.innerHTML = `Отметьте все ${esc(cfg.what)} <span class="sub">Всего нужно найти: ${countries(n)}. Повторное нажатие снимает отметку.</span>`;
  ui.panel.innerHTML = `<div class="btnrow"><button class="btn ghost" data-a="clear">Сбросить</button><button class="btn" data-a="check">Проверить</button></div>`;
  const map = GeoMap(ui.mapEl, { center: cfg.center || 0, onClick });
  map.setHome(cfg.view); map.fitView(cfg.view, false);
  const timer = makeTimer(ui.timerEl);
  const upd = () => { ui.prog.textContent = `${sel.size}/${n}`; ui.bar.style.width = Math.min(100, sel.size / n * 100) + '%'; };
  upd();
  ui.panel.querySelector('[data-a=clear]').onclick = () => { sel.forEach(k => map.remove(k, 'sel')); sel.clear(); upd(); };
  ui.panel.querySelector('[data-a=check]').onclick = check;

  function onClick(k, ev) {
    if (checked) {
      map.tip(nameOf(k) + (target.has(k) ? ' — входит' : ' — не входит') + (cfg.infoOf ? '. ' + cfg.infoOf(k) : ''), ev, target.has(k) ? 'good' : '', 2600);
      return;
    }
    if (sel.has(k)) { sel.delete(k); map.remove(k, 'sel'); }
    else { sel.add(k); map.add(k, 'sel'); map.tip(nameOf(k), ev, '', 900); }
    upd();
  }
  function check() {
    checked = true; timer.stop();
    const hits = [...target].filter(k => sel.has(k));
    const missed = [...target].filter(k => !sel.has(k));
    const extra = [...sel].filter(k => !target.has(k));
    sel.forEach(k => map.remove(k, 'sel'));
    hits.forEach(k => map.add(k, 'ok1'));
    missed.forEach(k => { map.add(k, 'miss'); map.flash(k, 'blink', 2000); });
    extra.forEach(k => map.add(k, 'fail'));
    const pct = Math.round(hits.length / (n + extra.length) * 100);
    saveBest(cfg.id, pct, timer.secs(), cfg.title + ' — отметь все');
    map.home();
    const mistakes = missed.map(k => ({ key: k, name: nameOf(k), note: 'пропущено' }))
      .concat(extra.map(k => ({ key: k, name: nameOf(k), note: 'лишнее' })));
    inlineResult(ui, {
      pct, line: `Верно: ${hits.length} из ${n} · пропущено: ${missed.length} · лишних: ${extra.length} · ${fmtTime(timer.secs())} · ${stars(pct)}`,
      mistakes,
      legend: `<div class="legend"><span><i style="background:var(--c-ok1)"></i>верно</span><span><i style="background:var(--c-ok3)"></i>пропущено</span><span><i style="background:var(--c-fail)"></i>лишнее</span></div>`,
      onRetry: () => replace(playSelect, cfg),
      onChip: k => { map.focus(k, true, { frac: 0.25, pointZoom: 4 }); map.flash(k, 'blink', 2000); },
    });
  }
  return () => timer.stop();
}

// ===================== Режим: выбери ответ =====================
// cfg: { id, title, items:[{key, q, options, correct, info}], fixedOptions, view, center, pins }
function playChoose(cfg) {
  const ui = gameShell(cfg.title);
  const items = cfg.items;
  const map = GeoMap(ui.mapEl, { center: cfg.center || 0, pins: cfg.pins, noLandClick: true, onClick: (k, ev) => { if (done && cfg.nameOf) map.tip(cfg.nameOf(k), ev); } });
  map.setHome(cfg.view); map.fitView(cfg.view, false);
  const timer = makeTimer(ui.timerEl);
  let i = 0, right = 0, answered = false, done = false, advanceT = null;
  const wrong = [];

  function ask() {
    clearTimeout(advanceT);
    if (i >= items.length) return finish();
    answered = false;
    const it = items[i];
    ui.prog.textContent = `${i + 1}/${items.length}`;
    ui.bar.style.width = (i / items.length * 100) + '%';
    ui.prompt.innerHTML = it.q;
    map.removeAll('hl');
    map.add(it.key, 'hl');
    map.focus(it.key, true, { frac: 0.35, pointZoom: cfg.pins ? 4 : 7 });
    const opts = cfg.fixedOptions || it.options;
    ui.panel.innerHTML = `<div class="opts">${opts.map(o => `<button class="opt">${esc(o)}</button>`).join('')}</div><div class="feedback">&nbsp;</div><div class="btnrow" hidden><button class="btn">Далее</button></div>`;
    ui.panel.querySelectorAll('.opt').forEach(b => { b.onclick = () => answer(b); });
    ui.panel.querySelector('.btnrow .btn').onclick = () => { i++; ask(); };
  }
  function answer(btn) {
    if (answered) return; answered = true;
    const it = items[i], ok = btn.textContent === it.correct;
    ui.panel.querySelectorAll('.opt').forEach(b => {
      b.disabled = true;
      if (b.textContent === it.correct) b.classList.add('right');
    });
    if (!ok) btn.classList.add('wrong');
    map.remove(it.key, 'hl'); map.add(it.key, ok ? 'ok1' : 'fail');
    if (ok) right++; else { wrong.push(it); buzz(); }
    const fb = ui.panel.querySelector('.feedback');
    const extra = it.info && it.info !== it.correct ? esc(it.info) : '';
    fb.innerHTML = (ok ? '<b class="good">Верно!</b> ' : `<b class="bad">Неверно.</b> Правильно: <b>${esc(it.correct)}</b>. `) + extra;
    ui.panel.querySelector('.btnrow').hidden = false;
    if (ok) advanceT = setTimeout(() => { if (answered && items[i] === it) { i++; ask(); } }, 1600);
  }
  function finish() {
    done = true; timer.stop(); map.removeAll('hl');
    const pct = Math.round(right / items.length * 100);
    saveBest(cfg.id, pct, timer.secs(), cfg.title + ' — ' + (cfg.modeLabel || 'выбери ответ'));
    map.home();
    inlineResult(ui, {
      pct, line: `Верно: ${right} из ${items.length} · ${fmtTime(timer.secs())} · ${stars(pct)}`,
      mistakes: wrong.map(it => ({ key: it.key, name: cfg.nameOf ? cfg.nameOf(it.key) : nameOf(it.key), note: it.correct })),
      onRetry: () => replace(playChoose, Object.assign({}, cfg, { items: cfg.regen ? cfg.regen() : shuffle(items) })),
      onRetryWrong: wrong.length ? () => replace(playChoose, Object.assign({}, cfg, { items: shuffle(wrong), id: null, regen: null, title: cfg.title + ' — ошибки' })) : null,
      onChip: k => { map.focus(k, true, { frac: 0.25, pointZoom: 4 }); map.flash(k, 'blink', 2000); },
    });
  }
  ask();
  return () => { timer.stop(); clearTimeout(advanceT); };
}

// ===================== Режим: изучение =====================
// cfg: { title, view, center, groups:[{cls,label,color,keys}], chips:[keys], infoOf, nameOf, pins, labels, scope }
function playStudy(cfg) {
  const ui = gameShell(cfg.title, false);
  const nm = cfg.nameOf || nameOf;
  const hint = cfg.pins ? 'Нажмите на точку пролива или приблизьте карту, чтобы увидеть подписи' : 'Нажмите на страну, чтобы узнать подробности';
  ui.prompt.innerHTML = `<span class="sub">${hint}</span>`;
  const legend = cfg.groups && cfg.groups.length > 1 ? `<div class="legend">${cfg.groups.map(g => `<span><i style="background:${g.color}"></i>${esc(g.label)} (${g.keys.length})</span>`).join('')}</div>` : '';
  const chips = cfg.chips || [];
  ui.panel.innerHTML = `${legend}${chips.length ? `<div class="namechips">${chips.map(k => `<button data-k="${esc(k)}">${esc(nm(k))}</button>`).join('')}</div>` : ''}`;
  const map = GeoMap(ui.mapEl, { center: cfg.center || 0, pins: cfg.pins, labels: cfg.labels, scope: cfg.scope, noLandClick: !!cfg.pins, onClick: (k, ev) => info(k, ev) });
  map.setHome(cfg.view); map.fitView(cfg.view, false);
  (cfg.groups || []).forEach(g => g.keys.forEach(k => map.add(k, g.cls)));
  function info(k, ev) {
    const inf = cfg.infoOf ? cfg.infoOf(k) : '';
    ui.prompt.innerHTML = `<b>${esc(nm(k))}</b>${inf ? `<span class="sub">${esc(inf)}</span>` : ''}`;
    map.tip(nm(k), ev || k, '', 2000);
  }
  ui.panel.querySelectorAll('.namechips button').forEach(b => {
    b.onclick = () => { const k = b.dataset.k; map.focus(k, true, { frac: 0.3, pointZoom: cfg.pins ? 4 : 6 }); setTimeout(() => { map.flash(k, 'blink', 2000); info(k, k); }, 700); };
  });
}

// ===================== Главный экран =====================
function Home() {
  app.innerHTML = `<header class="topbar"><div class="title" style="text-align:center">🌍 ГеоТренажёр</div></header>
  <div class="page"><div class="wrap">
    <div class="hero"><h1>Политическая карта мира</h1><p>Тренажёр к зачёту и экзамену по экономической и политической географии</p></div>
    <div class="grid">
      <button class="tile" data-go="orgs"><span class="ico">🤝</span><b>Международные организации</b><small>ЕС, НАТО, АСЕАН, БРИКС, ОПЕК, ШОС и др. — найди страны-участницы</small></button>
      <button class="tile" data-go="gov"><span class="ico">👑</span><b>Формы правления</b><small>Монархия или республика — выучи по карте</small></button>
      <button class="tile" data-go="fed"><span class="ico">🏛️</span><b>Федерации</b><small>Федеративное или унитарное устройство</small></button>
      <button class="tile" data-go="straits"><span class="ico">🌊</span><b>Проливы</b><small>${STRAITS.length} проливов мира: найди на карте</small></button>
      <button class="tile" data-go="regions"><span class="ico">🗺️</span><b>Регионы и страны</b><small>Регионы из билетов и части света</small></button>
      <button class="tile" data-go="quiz"><span class="ico">📝</span><b>Викторина по билетам</b><small>${QUIZ.length} вопросов с вариантами ответов по 25 темам</small></button>
      <button class="tile" data-go="guess"><span class="ico">🧩</span><b>Угадай организацию</b><small>На карте выделены участники — назовите объединение</small></button>
      <button class="tile" data-go="stats"><span class="ico">🏆</span><b>Мои результаты</b><small>Лучшие результаты во всех режимах</small></button>
    </div>
    <p class="note" style="text-align:center;margin-top:22px">Карта: приближайте колёсиком мыши или двумя пальцами, перемещайте перетаскиванием. Маленькие государства показаны кружками.</p>
  </div></div>`;
  const routes = { guess: GuessMenu, stats: Stats, orgs: OrgList, gov: () => GovMenu('gov'), fed: () => GovMenu('fed'), straits: StraitMenu, regions: RegionList, quiz: QuizMenu };
  app.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => go(routes[b.dataset.go]); });
}

// ===================== Организации и регионы =====================
function setRows(list, kind) {
  return list.map((s, i) => {
    const b = ['find', 'select'].map(m => store.get(`best:${kind}:${s.id}:${m}`)).filter(Boolean).map(x => x.pct);
    return `<button class="row" data-i="${i}"><span class="badge">${esc(s.short)}</span><span class="txt"><div>${esc(s.name || s.short)}</div><small>${countries(s.keys.length)}</small></span>${b.length ? `<span class="best">${Math.max(...b)}%</span>` : ''}<span class="chev">›</span></button>`;
  }).join('');
}
function OrgList() {
  const sets = ORGS.map(o => Object.assign({}, o, { keys: keysOf(o.members) }));
  const main = sets.filter(s => !s.other), other = sets.filter(s => s.other);
  app.innerHTML = `${topbar('Международные организации')}<div class="page"><div class="wrap">
    <div class="section-title">Основные</div><div class="list" id="l1">${setRows(main, 'org')}</div>
    <div class="section-title">Другие объединения</div><div class="list" id="l2">${setRows(other, 'org')}</div>
  </div></div>`;
  bindBack();
  $('#l1').querySelectorAll('.row').forEach(r => { r.onclick = () => go(SetMenu, { kind: 'org', set: main[+r.dataset.i] }); });
  $('#l2').querySelectorAll('.row').forEach(r => { r.onclick = () => go(SetMenu, { kind: 'org', set: other[+r.dataset.i] }); });
}
function RegionList() {
  const regs = REGIONS.map(r => Object.assign({}, r, { keys: keysOf(r.members), name: r.short, short: 'Билет ' + r.ticket }));
  const conts = REGION_FILTERS.map(r => ({ id: 'cont-' + r.id, short: r.label, name: r.id === 'ALL' ? 'Все страны мира' : 'Все страны: ' + r.label.toLowerCase(), keys: regionKeys(r), view: r.view, center: r.center }));
  app.innerHTML = `${topbar('Регионы и страны')}<div class="page"><div class="wrap">
    <div class="section-title">Регионы из экзаменационных билетов</div><div class="list" id="l1">${setRows(regs, 'reg')}</div>
    <div class="section-title">Части света (члены ООН)</div><div class="list" id="l2">${setRows(conts, 'reg')}</div>
  </div></div>`;
  bindBack();
  $('#l1').querySelectorAll('.row').forEach(r => { r.onclick = () => go(SetMenu, { kind: 'reg', set: regs[+r.dataset.i] }); });
  $('#l2').querySelectorAll('.row').forEach(r => { r.onclick = () => go(SetMenu, { kind: 'reg', set: conts[+r.dataset.i] }); });
}
function SetMenu({ kind, set }) {
  const title = kind === 'org' ? set.short : set.name;
  const idb = `${kind}:${set.id}`;
  const names = set.keys.map(nameOf).sort((a, b) => a.localeCompare(b, 'ru'));
  app.innerHTML = `${topbar(title)}<div class="page"><div class="wrap">
    <div class="info-card">
      <p><b>${esc(set.name || set.short)}</b></p>
      ${set.info ? `<p>${esc(set.info)}</p>` : ''}
      <p class="members"><b>${countries(set.keys.length)}:</b> ${esc(names.join(', '))}</p>
    </div>
    <div class="modes">
      <button class="mode" data-m="study"><span class="ico">🔍</span><span class="txt"><div>Изучить на карте</div><small>Страны выделены цветом, нажмите для подписи</small></span></button>
      <button class="mode" data-m="find"><span class="ico">📍</span><span class="txt"><div>Найди страну</div><small>Называется страна — нажмите на неё на карте</small></span><span class="best">${best(idb + ':find')}</span></button>
      <button class="mode" data-m="select"><span class="ico">✅</span><span class="txt"><div>Отметь всех участников</div><small>Отметьте все страны сами, затем проверьте</small></span><span class="best">${best(idb + ':select')}</span></button>
    </div>
  </div></div>`;
  bindBack();
  const scope = new Set(set.keys);
  const base = { view: set.view, center: set.center || 0 };
  const acts = {
    study: () => go(playStudy, Object.assign({ title, scope, infoOf: countryInfo, chips: set.keys.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ru')), groups: [{ cls: 'sel', keys: set.keys, label: title, color: 'var(--c-sel)' }] }, base)),
    find: () => go(playFind, Object.assign({ id: idb + ':find', title, keys: set.keys, infoOf: countryInfo }, base)),
    select: () => go(playSelect, Object.assign({ id: idb + ':select', title, keys: set.keys, what: kind === 'org' ? `страны — участницы «${set.short}»` : `страны региона «${set.name}»`, infoOf: countryInfo }, base)),
  };
  app.querySelectorAll('[data-m]').forEach(b => { b.onclick = acts[b.dataset.m]; });
}

// ===================== Формы правления / устройство =====================
const govState = { region: 'ALL', count: 20 };
function GovMenu(kind) {
  const isGov = kind === 'gov';
  const title = isGov ? 'Формы правления' : 'Федерации';
  const render = () => {
    const reg = REGION_FILTERS.find(r => r.id === govState.region);
    const keys = regionKeys(reg);
    const special = keys.filter(k => isGov ? govOf(k) !== 'rep' : isFed(k));
    const idb = `${kind}:${reg.id}`;
    app.innerHTML = `${topbar(title)}<div class="page"><div class="wrap">
      <div class="info-card">${isGov
        ? `<p><b>Монархия</b> — власть главы государства передаётся по наследству (абсолютная, конституционная, теократическая). <b>Республика</b> — органы власти избираются.</p><p class="members">В мире 43 монархии; из них 15 — королевства Содружества, где глава государства — британский монарх.</p>`
        : `<p><b>Федерация</b> — государство, состоящее из субъектов с собственными органами власти и законодательством. <b>Унитарное государство</b> — единое государство, делящееся на административные единицы.</p><p class="members">В мире около 28 федераций.</p>`}
      </div>
      <div class="section-title">Регион</div>
      <div class="chips" id="reg">${REGION_FILTERS.map(r => `<button class="chip ${r.id === govState.region ? 'on' : ''}" data-r="${r.id}">${r.label}</button>`).join('')}</div>
      <p class="note">${countries(keys.length)}, из них ${isGov ? 'монархий' : 'федераций'}: ${special.length}</p>
      <div class="section-title">Количество вопросов (режим «Определи»)</div>
      <div class="chips" id="cnt">${[10, 20, 40, 0].map(c => `<button class="chip ${c === govState.count ? 'on' : ''}" data-c="${c}">${c || 'Все'}</button>`).join('')}</div>
      <div class="modes">
        <button class="mode" data-m="study"><span class="ico">🔍</span><span class="txt"><div>Изучить карту</div><small>${isGov ? 'Цвет страны = форма правления' : 'Федерации выделены цветом'}</small></span></button>
        <button class="mode" data-m="choose"><span class="ico">❓</span><span class="txt"><div>${isGov ? 'Определи форму правления' : 'Федерация или унитарное?'}</div><small>Страна подсвечена на карте — выберите ответ</small></span><span class="best">${best(idb + ':choose:' + govState.count)}</span></button>
        <button class="mode" data-m="select"><span class="ico">✅</span><span class="txt"><div>Отметь все ${isGov ? 'монархии' : 'федерации'}</div><small>Найдите их на карте сами, затем проверьте</small></span><span class="best">${best(idb + ':select')}</span></button>
        <button class="mode" data-m="find"><span class="ico">📍</span><span class="txt"><div>Найди ${isGov ? 'монархию' : 'федерацию'}</div><small>Называется страна — нажмите на неё на карте</small></span><span class="best">${best(idb + ':find')}</span></button>
      </div>
    </div></div>`;
    bindBack();
    app.querySelectorAll('[data-r]').forEach(b => { b.onclick = () => { govState.region = b.dataset.r; render(); }; });
    app.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { govState.count = +b.dataset.c; render(); }; });
    const base = { view: reg.view, center: reg.center || 0 };
    const scope = new Set(keys);
    const infoOf = isGov ? govInfo : fedInfo;
    const makeItems = () => {
      let chosen;
      if (!govState.count || govState.count >= keys.length) chosen = shuffle(keys);
      else {
        const others = keys.filter(k => !special.includes(k));
        const m = Math.min(special.length, Math.round(govState.count * 0.45));
        chosen = shuffle(sample(special, m).concat(sample(others, govState.count - m)));
      }
      return chosen.map(k => ({
        key: k,
        q: `${isGov ? 'Форма правления' : 'Государственное устройство'}: <b>${esc(nameOf(k))}</b>`,
        correct: isGov ? GOV_TYPES[govOf(k)].label : (isFed(k) ? 'Федерация' : 'Унитарное государство'),
        info: infoOf(k),
      }));
    };
    const acts = {
      study: () => {
        const groups = isGov
          ? Object.entries(GOV_TYPES).map(([t, g]) => ({ cls: 'g-' + t, label: g.label, color: g.color, keys: keys.filter(k => govOf(k) === t) }))
          : [{ cls: 'g-fed', label: 'Федерация', color: '#3aa57a', keys: special }, { cls: 'g-uni', label: 'Унитарное', color: '#cfd8e3', keys: keys.filter(k => !isFed(k)) }];
        go(playStudy, Object.assign({ title, scope, groups, infoOf, chips: special.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'ru')) }, base));
      },
      choose: () => go(playChoose, Object.assign({
        id: idb + ':choose:' + govState.count, title, nameOf, items: makeItems(), regen: makeItems,
        fixedOptions: isGov ? Object.values(GOV_TYPES).map(g => g.label) : ['Федерация', 'Унитарное государство'],
      }, base)),
      select: () => go(playSelect, Object.assign({ id: idb + ':select', title, keys: special, what: isGov ? 'монархии' : 'федерации', infoOf }, base)),
      find: () => go(playFind, Object.assign({ id: idb + ':find', title, keys: special, verb: isGov ? 'Найдите монархию' : 'Найдите федерацию', infoOf }, base)),
    };
    app.querySelectorAll('[data-m]').forEach(b => { b.onclick = acts[b.dataset.m]; });
  };
  render();
}

// ===================== Проливы =====================
const straitState = { count: 15 };
function StraitMenu() {
  const render = () => {
    app.innerHTML = `${topbar('Проливы')}<div class="page"><div class="wrap">
      <div class="info-card"><p>${STRAITS.length} важнейших проливов мира. После каждого ответа показывается, какие моря (океаны) пролив соединяет и какие территории разделяет.</p></div>
      <div class="section-title">Количество вопросов</div>
      <div class="chips">${[10, 15, 30, 0].map(c => `<button class="chip ${c === straitState.count ? 'on' : ''}" data-c="${c}">${c || 'Все'}</button>`).join('')}</div>
      <div class="modes">
        <button class="mode" data-m="study"><span class="ico">🔍</span><span class="txt"><div>Изучить карту</div><small>Все проливы с подписями</small></span></button>
        <button class="mode" data-m="find"><span class="ico">📍</span><span class="txt"><div>Найди пролив</div><small>Называется пролив — нажмите на нужную точку</small></span><span class="best">${best('str:find:' + straitState.count)}</span></button>
        <button class="mode" data-m="choose"><span class="ico">❓</span><span class="txt"><div>Как называется пролив?</div><small>Точка подсвечена — выберите название из 4 вариантов</small></span><span class="best">${best('str:choose:' + straitState.count)}</span></button>
      </div>
    </div></div>`;
    bindBack();
    app.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { straitState.count = +b.dataset.c; render(); }; });
    const pick = () => { const all = STRAIT_PINS.map(p => p.key); return straitState.count ? sample(all, straitState.count) : shuffle(all); };
    const makeItems = () => pick().map(k => {
      const wrong = sample(STRAIT_PINS.filter(p => p.key !== k).map(p => p.label), 3);
      return { key: k, q: 'Как называется этот пролив?', correct: straitName(k), options: shuffle([straitName(k), ...wrong]), info: straitInfo(k) };
    });
    const acts = {
      study: () => go(playStudy, { title: 'Проливы', pins: STRAIT_PINS, labels: true, nameOf: straitName, infoOf: straitInfo, chips: STRAIT_PINS.map(p => p.key) }),
      find: () => go(playFind, { id: 'str:find:' + straitState.count, title: 'Проливы', keys: pick(), pins: STRAIT_PINS, nameOf: straitName, infoOf: straitInfo, verb: 'Найдите пролив' }),
      choose: () => go(playChoose, { id: 'str:choose:' + straitState.count, title: 'Проливы', pins: STRAIT_PINS, nameOf: straitName, items: makeItems(), regen: makeItems }),
    };
    app.querySelectorAll('[data-m]').forEach(b => { b.onclick = acts[b.dataset.m]; });
  };
  render();
}

// ===================== Викторина по билетам =====================
const quizState = store.get('quizState') || { topics: Object.keys(TOPICS).map(Number), count: 20 };
function QuizMenu() {
  const byTopic = {};
  QUIZ.forEach(q => { byTopic[q.t] = (byTopic[q.t] || 0) + 1; });
  const render = () => {
    const sel = new Set(quizState.topics);
    const avail = QUIZ.filter(q => sel.has(q.t)).length;
    app.innerHTML = `${topbar('Викторина по билетам')}<div class="page"><div class="wrap">
      <div class="info-card"><p>Вопросы с вариантами ответов по теоретическим темам экзаменационных билетов. После каждого ответа — пояснение.</p></div>
      <div class="section-title">Количество вопросов</div>
      <div class="chips">${[10, 20, 40, 0].map(c => `<button class="chip ${c === quizState.count ? 'on' : ''}" data-c="${c}">${c || 'Все'}</button>`).join('')}</div>
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">Темы
        <span><button class="chip" data-all="1">Все</button> <button class="chip" data-all="0">Ни одной</button></span></div>
      <div class="list topic-list">${Object.entries(TOPICS).map(([n, t]) => `<label><input type="checkbox" data-t="${n}" ${sel.has(+n) ? 'checked' : ''}><span class="num">${n}.</span><span>${esc(t)}</span><small>${byTopic[n] || 0}</small></label>`).join('')}</div>
      <div class="sticky-bottom"><button class="btn" id="start" style="width:100%" ${avail ? '' : 'disabled'}>Начать (${quizState.count ? Math.min(quizState.count, avail) : avail} из ${avail})</button></div>
    </div></div>`;
    bindBack();
    const save = () => store.set('quizState', quizState);
    app.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { quizState.count = +b.dataset.c; save(); render(); }; });
    app.querySelectorAll('[data-all]').forEach(b => { b.onclick = () => { quizState.topics = b.dataset.all === '1' ? Object.keys(TOPICS).map(Number) : []; save(); render(); }; });
    app.querySelectorAll('[data-t]').forEach(c => {
      c.onchange = () => {
        const t = +c.dataset.t;
        quizState.topics = c.checked ? [...new Set(quizState.topics.concat(t))] : quizState.topics.filter(x => x !== t);
        save();
        const scroll = $('.page').scrollTop; render(); $('.page').scrollTop = scroll;
      };
    });
    $('#start').onclick = () => {
      const pool = shuffle(QUIZ.filter(q => sel.has(q.t)));
      go(playQuiz, { qs: quizState.count ? pool.slice(0, quizState.count) : pool });
    };
  };
  render();
}
function playQuiz({ qs, title }) {
  let i = 0, right = 0;
  const log = [];
  const t0 = Date.now();
  app.innerHTML = `${topbar(title || 'Викторина', '<span class="prog"></span><span class="score"></span>')}<div class="progress"><div></div></div><div class="page"><div class="wrap" id="qw"></div></div>`;
  bindBack();
  const qw = $('#qw');
  function ask() {
    if (i >= qs.length) return finish();
    const q = qs[i];
    const opts = shuffle([q.a, ...q.w]);
    $('.prog').textContent = `${i + 1}/${qs.length}`;
    $('.score').textContent = `✓ ${right}`;
    $('.progress>div').style.width = (i / qs.length * 100) + '%';
    qw.innerHTML = `<div class="qcard"><div class="topic">Билет ${q.t} · ${esc(TOPICS[q.t])}</div><h2>${esc(q.q)}</h2>
      <div class="qopts">${opts.map(o => `<button class="opt">${esc(o)}</button>`).join('')}</div><div id="after"></div></div>`;
    qw.querySelectorAll('.opt').forEach(b => { b.onclick = () => answer(b, q); });
    $('.page').scrollTop = 0;
  }
  function answer(btn, q) {
    const ok = btn.textContent === q.a;
    qw.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.textContent === q.a) b.classList.add('right'); });
    if (!ok) { btn.classList.add('wrong'); buzz(); } else right++;
    log.push({ q, ok, given: btn.textContent });
    $('.score').textContent = `✓ ${right}`;
    $('#after').innerHTML = `<div class="explain">${ok ? '<b style="color:var(--ok)">Верно!</b>' : `<b style="color:var(--bad)">Неверно.</b> Правильный ответ: <b>${esc(q.a)}</b>.`} ${esc(q.e || '')}</div>
      <div style="margin-top:12px"><button class="btn" style="width:100%" id="next">${i + 1 < qs.length ? 'Далее' : 'Результаты'}</button></div>`;
    $('#next').onclick = () => { i++; ask(); };
    $('#next').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function finish() {
    const pct = Math.round(right / qs.length * 100);
    const secs = Math.round((Date.now() - t0) / 1000);
    const wrong = log.filter(l => !l.ok);
    $('.progress>div').style.width = '100%';
    qw.innerHTML = `<div class="result"><div class="score">${pct}%</div><div class="stars">${stars(pct)}</div><div class="sub">Верно ${right} из ${qs.length} · ${fmtTime(secs)}</div></div>
      <div class="btnrow" style="display:flex;gap:8px;margin:14px 0">
        <button class="btn ghost" id="menu">Меню</button>
        ${wrong.length ? '<button class="btn ghost" id="rw">Только ошибки</button>' : ''}
        <button class="btn" id="again">Ещё раз</button></div>
      ${wrong.length ? `<div class="section-title">Разбор ошибок</div>${wrong.map(l => `<div class="qcard" style="margin-bottom:10px"><div class="topic">Билет ${l.q.t}</div><p style="margin:0 0 6px;font-weight:600">${esc(l.q.q)}</p><p style="margin:0;color:var(--bad)">Ваш ответ: ${esc(l.given)}</p><p style="margin:0 0 6px;color:var(--ok)">Верно: ${esc(l.q.a)}</p><p style="margin:0;color:var(--muted);font-size:14px">${esc(l.q.e || '')}</p></div>`).join('')}` : '<p class="note" style="text-align:center">Без ошибок — отлично!</p>'}`;
    $('#menu').onclick = back;
    $('#again').onclick = () => replace(playQuiz, { qs: shuffle(qs), title });
    if (wrong.length) $('#rw').onclick = () => replace(playQuiz, { qs: shuffle(wrong.map(l => l.q)), title: 'Работа над ошибками' });
    $('.page').scrollTop = 0;
  }
  const onKey = e => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const n = parseInt(e.key, 10);
    const opts = qw.querySelectorAll('.qopts .opt');
    if (n >= 1 && n <= opts.length && !opts[0].disabled) { e.preventDefault(); opts[n - 1].click(); }
    else if (e.key === 'Enter' && $('#next')) { e.preventDefault(); $('#next').click(); }
  };
  document.addEventListener('keydown', onKey);
  ask();
  return () => document.removeEventListener('keydown', onKey);
}

// ===================== Угадай организацию =====================
const guessState = { count: 10, other: true };
function GuessMenu() {
  const render = () => {
    const pool = ORGS.filter(o => guessState.other || !o.other);
    const id = 'guess:' + (guessState.other ? 'all' : 'main') + ':' + guessState.count;
    app.innerHTML = `${topbar('Угадай организацию')}<div class="page"><div class="wrap">
      <div class="info-card"><p>На карте выделены страны-участницы. Выберите, какое это объединение. Будьте внимательны: составы ЕАЭС, ОДКБ и СНГ похожи.</p></div>
      <div class="section-title">Количество вопросов</div>
      <div class="chips">${[10, 20, 0].map(c => `<button class="chip ${c === guessState.count ? 'on' : ''}" data-c="${c}">${c || 'Все (' + pool.length + ')'}</button>`).join('')}</div>
      <div class="section-title">Какие организации</div>
      <div class="chips"><button class="chip ${guessState.other ? '' : 'on'}" data-o="0">Только основные (${ORGS.filter(o => !o.other).length})</button><button class="chip ${guessState.other ? 'on' : ''}" data-o="1">Все (${ORGS.length})</button></div>
      <div class="modes"><button class="mode" id="start"><span class="ico">🧩</span><span class="txt"><div>Начать</div><small>4 варианта ответа, после ответа — справка об организации</small></span><span class="best">${best(id)}</span></button></div>
    </div></div>`;
    bindBack();
    app.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { guessState.count = +b.dataset.c; render(); }; });
    app.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => { guessState.other = b.dataset.o === '1'; render(); }; });
    $('#start').onclick = () => go(playGuess, { pool, count: guessState.count, id });
  };
  render();
}
function playGuess(cfg) {
  const ui = gameShell('Угадай организацию');
  const rounds = (cfg.count ? sample(cfg.pool, cfg.count) : shuffle(cfg.pool)).map(o => {
    const others = sample(ORGS.filter(x => x !== o), 3).map(x => x.short);
    return { org: o, keys: keysOf(o.members), options: shuffle([o.short, ...others]) };
  });
  const timer = makeTimer(ui.timerEl);
  let i = 0, right = 0, answered = false, done = false, map = null;
  const wrong = [];
  const resetMap = () => ui.mapEl.querySelectorAll('svg, .map-tip').forEach(n => n.remove());
  function ask() {
    if (i >= rounds.length) return finish();
    answered = false;
    const r = rounds[i];
    ui.prog.textContent = `${i + 1}/${rounds.length}`;
    ui.bar.style.width = (i / rounds.length * 100) + '%';
    ui.prompt.innerHTML = `Какая это организация? <span class="sub">Выделено: ${countries(r.keys.length)}</span>`;
    ui.panel.innerHTML = `<div class="opts">${r.options.map(o => `<button class="opt">${esc(o)}</button>`).join('')}</div><div class="feedback">&nbsp;</div><div class="btnrow" hidden><button class="btn">Далее</button></div>`;
    ui.panel.querySelectorAll('.opt').forEach(b => { b.onclick = () => answer(b); });
    ui.panel.querySelector('.btnrow .btn').onclick = () => { i++; ask(); };
    resetMap();
    map = GeoMap(ui.mapEl, { center: r.org.center || 0, scope: new Set(r.keys), onClick: (k, ev) => map.tip(nameOf(k) + (answered ? ' — ' + countryInfo(k) : ''), ev, '', 2600) });
    map.setHome(r.org.view); map.fitView(r.org.view, false);
    r.keys.forEach(k => map.add(k, 'sel'));
  }
  function answer(btn) {
    if (answered) return; answered = true;
    const r = rounds[i], ok = btn.textContent === r.org.short;
    ui.panel.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.textContent === r.org.short) b.classList.add('right'); });
    if (ok) { right++; r.keys.forEach(k => { map.remove(k, 'sel'); map.add(k, 'ok1'); }); }
    else { btn.classList.add('wrong'); wrong.push(r); buzz(); }
    ui.panel.querySelector('.feedback').innerHTML = (ok ? '<b class="good">Верно!</b> ' : `<b class="bad">Неверно.</b> Это <b>${esc(r.org.short)}</b>. `) + esc(r.org.name) + '. ' + esc(r.org.info || '');
    ui.panel.querySelector('.btnrow').hidden = false;
  }
  function finish() {
    done = true; timer.stop();
    const pct = Math.round(right / rounds.length * 100);
    saveBest(cfg.id, pct, timer.secs(), 'Угадай организацию — ' + (cfg.count ? cfg.count + ' вопросов' : 'все'));
    resetMap();
    map = GeoMap(ui.mapEl, { center: 10, onClick: (k, ev) => map.tip(nameOf(k) + ' — ' + countryInfo(k), ev, '', 3200) });
    map.setHome(null); map.fitView(null, false);
    inlineResult(ui, {
      pct, line: `Верно: ${right} из ${rounds.length} · ${fmtTime(timer.secs())} · ${stars(pct)} · нажмите на страну, чтобы увидеть её организации`,
      mistakes: wrong.map(r => ({ key: r.org.id, name: r.org.short, note: r.org.name })),
      mistakesTitle: 'Не угаданы',
      onRetry: () => replace(playGuess, cfg),
      onRetryWrong: wrong.length ? () => replace(playGuess, Object.assign({}, cfg, { pool: wrong.map(r => r.org), count: 0, id: null })) : null,
      onChip: id => {
        const o = ORGS.find(x => x.id === id); if (!o) return;
        map.removeAll('sel'); keysOf(o.members).forEach(k => map.add(k, 'sel'));
        ui.prompt.innerHTML = `<b>${esc(o.short)}</b> <span class="sub">${esc(o.name)} — участники выделены на карте</span>`;
      },
    });
  }
  ask();
  return () => timer.stop();
}

// ===================== Мои результаты =====================
function Stats() {
  let confirmReset = false;
  const render = () => {
    const list = allBest().sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id, 'ru'));
    const avg = list.length ? Math.round(list.reduce((s, x) => s + x.pct, 0) / list.length) : 0;
    app.innerHTML = `${topbar('Мои результаты')}<div class="page"><div class="wrap">
      ${list.length ? `<div class="result"><div class="score">${avg}%</div><div class="sub">средний лучший результат · пройдено режимов: ${list.length}</div></div>
      <div class="list">${list.map(x => `<div class="row"><span class="txt"><div>${esc(x.label || x.id)}</div><small>лучшее время ${fmtTime(x.secs || 0)}</small></span><span class="pill ${x.pct >= 90 ? 'good' : x.pct >= 60 ? 'mid' : 'low'}">${x.pct}%</span></div>`).join('')}</div>
      <div style="margin-top:16px">${confirmReset
        ? `<p class="note">Удалить все результаты на этом устройстве?</p><div class="btnrow"><button class="btn ghost" id="no">Отмена</button><button class="btn danger" id="yes">Удалить</button></div>`
        : '<button class="btn ghost" id="reset" style="width:100%">Сбросить результаты</button>'}</div>`
      : '<div class="info-card" style="margin-top:16px"><p>Пока пусто. Пройдите любой режим — лучший результат появится здесь.</p><p class="members">Результаты хранятся только в этом браузере.</p></div>'}
    </div></div>`;
    bindBack();
    const on = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
    on('reset', () => { confirmReset = true; render(); });
    on('no', () => { confirmReset = false; render(); });
    on('yes', () => {
      try { Object.keys(localStorage).filter(k => k.startsWith('geo:best:')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* хранилище недоступно */ }
      confirmReset = false; render();
    });
  };
  render();
}

// ===================== Старт =====================
stack = [[Home, undefined]];
try { history.replaceState({ d: 1 }, ''); } catch (e) { histOK = false; }
show(Home);
})();
