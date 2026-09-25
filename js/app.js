(function () {
'use strict';

// ===================== Утилиты =====================
const app = document.getElementById('app');
const $ = (s, r = app) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('geo:' + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('geo:' + k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } },
};

// ===================== Язык / Language =====================
let LANG = store.get('lang') || ((navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en');
if (LANG !== 'ru' && LANG !== 'en') LANG = 'ru';
const L = (ru, en) => (LANG === 'en' ? en : ru);
const cmp = (a, b) => a.localeCompare(b, LANG);
const pluralRu = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many); };
const countries = n => L(`${n} ${pluralRu(n, 'страна', 'страны', 'стран')}`, `${n} ${n === 1 ? 'country' : 'countries'}`);
function applyLang() {
  document.documentElement.lang = LANG;
  document.title = L('ГеоТренажёр', 'GeoTrainer');
}
applyLang();

function saveBest(id, pct, secs, label) {
  if (!id) return;
  const b = store.get('best:' + id);
  const labels = Object.assign({}, b && b.labels, label ? { [LANG]: label } : {});
  if (!b || pct > b.pct || (pct === b.pct && secs < b.secs)) store.set('best:' + id, { pct, secs, labels, at: Date.now() });
  else store.set('best:' + id, Object.assign(b, { labels }));
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
const bestLabel = x => (x.labels && (x.labels[LANG] || x.labels.ru || x.labels.en)) || x.label || x.id;
const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(35); } catch (e) { /* нет вибрации */ } };
const best = id => { const b = store.get('best:' + id); return b ? `${b.pct}%` : ''; };

// ===================== Данные =====================
const C = {}, BYNAME = {};
COUNTRIES.forEach(([key, name, cont, sp]) => { C[key] = { key, name, cont, special: !!sp }; BYNAME[name] = key; });
const ruName = k => (C[k] ? C[k].name : k);             // русское имя — ключ во всех справочниках
const nameOf = k => (C[k] ? L(C[k].name, COUNTRY_EN[k] || C[k].name) : k);
const keysOf = names => names.map(n => { const k = BYNAME[n]; if (!k) console.warn('Unknown country:', n); return k; }).filter(Boolean);
const UN_KEYS = Object.keys(C).filter(k => !C[k].special); // члены ООН + Ватикан
const byName = (a, b) => cmp(nameOf(a), nameOf(b));

const govOf = k => (MONARCHIES[ruName(k)] ? MONARCHIES[ruName(k)][0] : 'rep');
const govLabel = t => L(GOV_TYPES[t].label, GOV_LABELS_EN[t]);
const govInfo = k => {
  const n = ruName(k), m = MONARCHIES[n];
  if (m) return L(`${GOV_TYPES[m[0]].label}. Глава государства: ${m[1]}`, `${GOV_LABELS_EN[m[0]]}. Head of state: ${MONARCHY_EN[n]}`);
  const note = L(REPUBLIC_NOTES[n], REPUBLIC_NOTES_EN[n]);
  return note ? L(`Республика: ${note}`, `Republic: ${note}`) : L('Республика', 'Republic');
};
const isFed = k => !!FEDERATIONS[ruName(k)];
const fedLabel = () => L('Федерация', 'Federation');
const uniLabel = () => L('Унитарное государство', 'Unitary state');
const fedInfo = k => {
  const n = ruName(k);
  if (FEDERATIONS[n]) return `${fedLabel()}: ${L(FEDERATIONS[n], FEDERATIONS_EN[n])}`;
  const note = L(UNITARY_NOTES[n], UNITARY_NOTES_EN[n]);
  return note ? cap(note) : uniLabel();
};

const orgT = o => (LANG === 'en' && ORGS_EN[o.id]) ? ORGS_EN[o.id] : o;
const orgShort = o => orgT(o).short;
const orgName = o => orgT(o).name;
const orgInfo = o => orgT(o).info;
const ORG_SETS = ORGS.map(o => ({ o, set: new Set(keysOf(o.members)) }));
const orgsOf = k => ORG_SETS.filter(x => x.set.has(k)).map(x => orgShort(x.o));
const countryInfo = k => {
  const orgs = orgsOf(k), parts = [];
  if (C[k] && !C[k].special) parts.push(govLabel(govOf(k)) + (isFed(k) ? L(', федерация', ', federation') : ''));
  parts.push(orgs.length ? L('Входит в: ', 'Member of: ') + orgs.join(', ') : L('Не входит в организации из списка', 'Not a member of any listed organization'));
  return parts.join('. ');
};

const REGION_FILTERS = [
  { id: 'ALL', ru: 'Весь мир', en: 'Whole world', conts: null, view: null, center: 10 },
  { id: 'EU', ru: 'Европа', en: 'Europe', conts: ['EU'], view: [-25, 34, 45, 71] },
  { id: 'AS', ru: 'Азия', en: 'Asia', conts: ['AS'], view: [25, -11, 150, 56], center: 90 },
  { id: 'AF', ru: 'Африка', en: 'Africa', conts: ['AF'], view: [-26, -36, 60, 38] },
  { id: 'AM', ru: 'Америка', en: 'Americas', conts: ['NA', 'SA'], view: [-170, -56, -30, 72] },
  { id: 'OC', ru: 'Океания', en: 'Oceania', conts: ['OC'], view: [110, -48, 200, 20], center: 160 },
];
const rLabel = r => L(r.ru, r.en);
const regionKeys = r => UN_KEYS.filter(k => !r.conts || r.conts.includes(C[k].cont));

const straitName = k => { const i = +k.slice(1); return L(STRAITS[i][0], STRAITS_EN[i][0]); };
const straitInfo = k => {
  const i = +k.slice(1), s = STRAITS[i], e = STRAITS_EN[i];
  return L(`Соединяет ${s[2]}; разделяет ${s[3]}.`, `Connects ${e[1]}; separates ${e[2]}.`);
};
const straitPins = () => STRAITS.map((s, i) => ({ key: 's' + i, lonlat: s[1], label: straitName('s' + i) }));

const dispT = i => DISPUTES[i][LANG] || DISPUTES[i].ru;
const disputeName = k => dispT(+k.slice(1)).name;
const disputeInfo = k => dispT(+k.slice(1)).status;
const disputePins = () => DISPUTES.map((d, i) => ({ key: 'd' + i, lonlat: d.ll, label: dispT(i).name }));

const resT = i => DEPOSITS[i][LANG] || DEPOSITS[i].ru;
const resLabel = code => L(RES_TYPES[code].ru, RES_TYPES[code].en);
const resGroupOf = i => RES_TYPES[DEPOSITS[i].res[0]].group;
const depositName = k => resT(+k.slice(1)).name;
const depositInfo = k => {
  const i = +k.slice(1), t = resT(i);
  return `${t.where}. ${L('Добывают', 'Resources')}: ${DEPOSITS[i].res.map(resLabel).join(', ')}. ${t.info}`;
};

const topicName = n => L(TOPICS[n], TOPICS_EN[n]);
const quizQ = i => {
  const q = QUIZ[i];
  if (LANG !== 'en') return { t: q.t, q: q.q, a: q.a, w: q.w, e: q.e };
  const e = QUIZ_EN[i];
  return { t: e[0], q: e[1], a: e[2], w: e[3], e: e[4] };
};

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
  return `<header class="topbar"><button class="back" aria-label="${L('Назад', 'Back')}">‹</button><div class="title">${esc(title)}</div><div class="stats">${stats}</div></header>`;
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
  const winLandscape = () => window.innerWidth > window.innerHeight;
  let wasLandscape = winLandscape();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!el.isConnected) { ro.disconnect(); return; }
      const W2 = Math.max(el.clientWidth, 200), H2 = Math.max(el.clientHeight, 160);
      if (Math.abs(W2 - W) < 2 && Math.abs(H2 - H) < 2) return;
      const dx = (W2 - W) / 2, dy = (H2 - H) / 2;
      W = W2; H = H2;
      svg.attr('viewBox', `0 0 ${W} ${H}`);
      zoom.extent([[0, 0], [W, H]]).translateExtent([[-W, -H], [2 * W, 2 * H]]);
      const rotated = winLandscape() !== wasLandscape;
      wasLandscape = winLandscape();
      if (rotated) fitView(home, false); // телефон повернули — показываем исходный вид
      else if (anim && Date.now() < anim.until) apply(anim.k, anim.cx, anim.cy, false); // идёт приближение — сразу к цели
      else svg.call(zoom.transform, d3.zoomIdentity.translate(T.x + dx, T.y + dy).scale(T.k)); // центр карты остаётся на месте
    }, 150);
  }) : null;
  if (ro) ro.observe(el);
  rescale();

  let anim = null; // цель текущей анимации масштаба
  function apply(k, cx, cy, animate) {
    anim = animate ? { k, cx, cy, until: Date.now() + 700 } : null;
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
    if (MICRO[k] || pinData.some(p => p.key === k)) return null;
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
    <div class="mapwrap"><div class="zoombtns"><button data-z="in" aria-label="${L('Приблизить', 'Zoom in')}">+</button><button data-z="out" aria-label="${L('Отдалить', 'Zoom out')}">−</button><button data-z="home" aria-label="${L('Исходный вид', 'Reset view')}">⟲</button></div></div>
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
  ui.prompt.innerHTML = `${L('Результат', 'Score')}: <b>${r.pct}%</b> <span class="sub">${r.line}</span>`;
  const list = r.mistakes && r.mistakes.length
    ? `<details style="margin-bottom:8px"><summary style="cursor:pointer;font-weight:600">${r.mistakesTitle || L('Ошибки', 'Mistakes')} (${r.mistakes.length})</summary><div class="namechips" style="margin-top:6px">${r.mistakes.map(m => `<button data-k="${esc(m.key)}">${esc(m.name)}${m.note ? ' · ' + esc(m.note) : ''}</button>`).join('')}</div></details>`
    : '';
  ui.panel.innerHTML = `${r.legend || ''}${list}<div class="btnrow">
      <button class="btn ghost" data-a="menu">${L('Меню', 'Menu')}</button>
      ${r.onRetryWrong ? `<button class="btn ghost" data-a="wrong">${L('Ошибки', 'Mistakes')}</button>` : ''}
      <button class="btn" data-a="retry">${L('Ещё раз', 'Play again')}</button></div>`;
  ui.panel.querySelector('[data-a=menu]').onclick = back;
  ui.panel.querySelector('[data-a=retry]').onclick = r.onRetry;
  if (r.onRetryWrong) ui.panel.querySelector('[data-a=wrong]').onclick = r.onRetryWrong;
  ui.panel.querySelectorAll('.namechips button').forEach(b => { b.onclick = () => r.onChip && r.onChip(b.dataset.k); });
}
const ordinalTry = n => L(`${n}-я попытка`, ['1st', '2nd', '3rd'][n - 1] + ' try');

// ===================== Режим: найди на карте =====================
// cfg: { id, title, keys, view, center, pins, nameOf, infoOf, verb }
function playFind(cfg) {
  const ui = gameShell(cfg.title);
  const nm = cfg.nameOf || nameOf;
  ui.panel.innerHTML = `<div class="btnrow"><button class="btn ghost" data-a="skip">${L('Не знаю — показать', 'Don’t know — show me')}</button></div>`;
  const map = GeoMap(ui.mapEl, { center: cfg.center || 0, pins: cfg.pins, noLandClick: !!cfg.pins, onClick });
  map.setHome(cfg.view); map.fitView(cfg.view, false);
  const queue = shuffle(cfg.keys), res = {};
  let i = 0, tries = 0, busy = false, done = false;
  const timer = makeTimer(ui.timerEl);
  ui.panel.querySelector('[data-a=skip]').onclick = () => { if (!busy && !done) { res[queue[i]] = 3; reveal(); } };

  function ask() {
    if (i >= queue.length) return finish();
    tries = 0; busy = false;
    ui.prompt.innerHTML = `${cfg.verb || L('Найдите', 'Find')}: <b>${esc(nm(queue[i]))}</b>`;
    ui.prog.textContent = `${i + 1}/${queue.length}`;
    ui.bar.style.width = (i / queue.length * 100) + '%';
  }
  function onClick(k, ev) {
    if (done) { map.tip(nm(k) + (cfg.infoOf ? ' — ' + cfg.infoOf(k) : ''), ev, '', 3000); return; }
    const target = queue[i];
    if (busy) {
      // ответ показан — чтобы продолжить, нужно нажать на подсвеченный объект
      if (k === target) { map.remove(target, 'hl'); map.add(target, 'fail'); map.tip(nm(k), ev, 'bad', 900); i++; ask(); }
      else map.tip(L('Нажмите на подсвеченный: ', 'Tap the highlighted one: ') + nm(target), ev, 'bad');
      return;
    }
    if (k !== target && res[k] !== undefined) { map.tip(nm(k), ev, '', 1200); return; } // уже отгадана — просто подпись
    if (k === target) {
      res[target] = tries; map.add(target, 'ok' + (tries + 1)); map.tip(nm(k), ev, 'good', 900);
      i++; ask();
    } else {
      tries++; buzz(); map.flash(k); map.tip(L('Это: ', 'That’s ') + nm(k), ev, 'bad');
      if (tries >= 3) { res[target] = 3; reveal(); }
    }
  }
  function reveal() {
    busy = true;
    const t = queue[i];
    map.add(t, 'hl'); map.ensureVisible(t);
    ui.prompt.innerHTML = `${L('Правильный ответ', 'Correct answer')}: <b>${esc(nm(t))}</b> <span class="sub">${L('подсвечен на карте — нажмите на него, чтобы продолжить', 'highlighted on the map — tap it to continue')}</span>`;
  }
  function finish() {
    done = true; timer.stop();
    const n = queue.length;
    const pts = queue.reduce((s, k) => s + [1, 0.5, 0.25, 0][res[k]], 0);
    const pct = Math.round(pts / n * 100);
    const first = queue.filter(k => res[k] === 0).length;
    saveBest(cfg.id, pct, timer.secs(), cfg.title + L(' — найди на карте', ' — find on the map'));
    map.home();
    const wrong = queue.filter(k => res[k] > 0);
    inlineResult(ui, {
      pct, line: L(`С первой попытки: ${first} из ${n}`, `First try: ${first} of ${n}`) + ` · ${L('время', 'time')} ${fmtTime(timer.secs())} · ${stars(pct)}`,
      mistakes: wrong.map(k => ({ key: k, name: nm(k), note: res[k] === 3 ? L('не найдено', 'not found') : ordinalTry(res[k] + 1) })),
      legend: `<div class="legend"><span><i style="background:var(--c-ok1)"></i>${ordinalTry(1)}</span><span><i style="background:var(--c-ok2)"></i>${L('2-я', '2nd')}</span><span><i style="background:var(--c-ok3)"></i>${L('3-я', '3rd')}</span><span><i style="background:var(--c-fail)"></i>${L('не найдено', 'not found')}</span></div>`,
      onRetry: () => replace(playFind, cfg),
      onRetryWrong: wrong.length ? () => replace(playFind, Object.assign({}, cfg, { keys: wrong, id: null, title: cfg.title + L(' — ошибки', ' — mistakes') })) : null,
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
  ui.prompt.innerHTML = `${L('Отметьте все', 'Select all')} ${esc(cfg.what)} <span class="sub">${L(`Всего нужно найти: ${countries(n)}. Повторное нажатие снимает отметку.`, `Find ${countries(n)} in total. Tap again to deselect.`)}</span>`;
  ui.panel.innerHTML = `<div class="btnrow"><button class="btn ghost" data-a="clear">${L('Сбросить', 'Clear')}</button><button class="btn" data-a="check">${L('Проверить', 'Check')}</button></div>`;
  const map = GeoMap(ui.mapEl, { center: cfg.center || 0, onClick });
  map.setHome(cfg.view); map.fitView(cfg.view, false);
  const timer = makeTimer(ui.timerEl);
  const upd = () => { ui.prog.textContent = `${sel.size}/${n}`; ui.bar.style.width = Math.min(100, sel.size / n * 100) + '%'; };
  upd();
  ui.panel.querySelector('[data-a=clear]').onclick = () => { sel.forEach(k => map.remove(k, 'sel')); sel.clear(); upd(); };
  ui.panel.querySelector('[data-a=check]').onclick = check;

  function onClick(k, ev) {
    if (checked) {
      map.tip(nameOf(k) + (target.has(k) ? L(' — входит', ' — included') : L(' — не входит', ' — not included')) + (cfg.infoOf ? '. ' + cfg.infoOf(k) : ''), ev, target.has(k) ? 'good' : '', 2600);
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
    saveBest(cfg.id, pct, timer.secs(), cfg.title + L(' — отметь все', ' — select all'));
    map.home();
    const mistakes = missed.map(k => ({ key: k, name: nameOf(k), note: L('пропущено', 'missed') }))
      .concat(extra.map(k => ({ key: k, name: nameOf(k), note: L('лишнее', 'wrong pick') })));
    inlineResult(ui, {
      pct, line: L(`Верно: ${hits.length} из ${n} · пропущено: ${missed.length} · лишних: ${extra.length}`, `Correct: ${hits.length} of ${n} · missed: ${missed.length} · wrong picks: ${extra.length}`) + ` · ${fmtTime(timer.secs())} · ${stars(pct)}`,
      mistakes,
      legend: `<div class="legend"><span><i style="background:var(--c-ok1)"></i>${L('верно', 'correct')}</span><span><i style="background:var(--c-ok3)"></i>${L('пропущено', 'missed')}</span><span><i style="background:var(--c-fail)"></i>${L('лишнее', 'wrong pick')}</span></div>`,
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
    ui.panel.innerHTML = `<div class="opts">${opts.map(o => `<button class="opt">${esc(o)}</button>`).join('')}</div><div class="feedback">&nbsp;</div><div class="btnrow" hidden><button class="btn">${L('Далее', 'Next')}</button></div>`;
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
    fb.innerHTML = (ok ? `<b class="good">${L('Верно!', 'Correct!')}</b> ` : `<b class="bad">${L('Неверно.', 'Wrong.')}</b> ${L('Правильно', 'Correct answer')}: <b>${esc(it.correct)}</b>. `) + extra;
    ui.panel.querySelector('.btnrow').hidden = false;
    if (ok) advanceT = setTimeout(() => { if (answered && items[i] === it) { i++; ask(); } }, 1600);
  }
  function finish() {
    done = true; timer.stop(); map.removeAll('hl');
    const pct = Math.round(right / items.length * 100);
    saveBest(cfg.id, pct, timer.secs(), cfg.title + ' — ' + (cfg.modeLabel || L('выбери ответ', 'multiple choice')));
    map.home();
    inlineResult(ui, {
      pct, line: `${L('Верно', 'Correct')}: ${right} ${L('из', 'of')} ${items.length} · ${fmtTime(timer.secs())} · ${stars(pct)}`,
      mistakes: wrong.map(it => ({ key: it.key, name: cfg.nameOf ? cfg.nameOf(it.key) : nameOf(it.key), note: it.correct })),
      onRetry: () => replace(playChoose, Object.assign({}, cfg, { items: cfg.regen ? cfg.regen() : shuffle(items) })),
      onRetryWrong: wrong.length ? () => replace(playChoose, Object.assign({}, cfg, { items: shuffle(wrong), id: null, regen: null, title: cfg.title + L(' — ошибки', ' — mistakes') })) : null,
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
  const hint = cfg.pins
    ? L('Нажмите на точку пролива или приблизьте карту, чтобы увидеть подписи', 'Tap a strait marker, or zoom in to see the labels')
    : L('Нажмите на страну, чтобы узнать подробности', 'Tap a country to see details');
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
  app.innerHTML = `<header class="topbar home-bar"><div class="title">🌍 ${L('ГеоТренажёр', 'GeoTrainer')}</div>
    <div class="lang-switch" role="group" aria-label="${L('Язык', 'Language')}">
      <button data-lang="ru" aria-pressed="${LANG === 'ru'}">RU</button><button data-lang="en" aria-pressed="${LANG === 'en'}">EN</button>
    </div></header>
  <div class="page"><div class="wrap">
    <div class="hero"><h1>${L('Политическая карта мира', 'Political Map of the World')}</h1><p>${L('Тренажёр к зачёту и экзамену по экономической и политической географии', 'Practice for your economic and political geography exam')}</p></div>
    <div class="grid">
      <button class="tile" data-go="orgs"><span class="ico">🤝</span><b>${L('Международные организации', 'International organizations')}</b><small>${L('ЕС, НАТО, АСЕАН, БРИКС, ОПЕК, ШОС и др. — найди страны-участницы', 'EU, NATO, ASEAN, BRICS, OPEC, SCO and more — find the member states')}</small></button>
      <button class="tile" data-go="gov"><span class="ico">👑</span><b>${L('Формы правления', 'Forms of government')}</b><small>${L('Монархия или республика — выучи по карте', 'Monarchy or republic — learn them on the map')}</small></button>
      <button class="tile" data-go="fed"><span class="ico">🏛️</span><b>${L('Федерации', 'Federations')}</b><small>${L('Федеративное или унитарное устройство', 'Federal or unitary state')}</small></button>
      <button class="tile" data-go="straits"><span class="ico">🌊</span><b>${L('Проливы', 'Straits')}</b><small>${L(`${STRAITS.length} проливов мира: найди на карте`, `${STRAITS.length} of the world’s straits: find them on the map`)}</small></button>
      <button class="tile" data-go="regions"><span class="ico">🗺️</span><b>${L('Регионы и страны', 'Regions and countries')}</b><small>${L('Регионы из билетов и части света', 'Exam regions and continents')}</small></button>
      <button class="tile" data-go="guess"><span class="ico">🧩</span><b>${L('Угадай организацию', 'Guess the organization')}</b><small>${L('На карте выделены участники — назовите объединение', 'Members are highlighted on the map — name the group')}</small></button>
      <button class="tile" data-go="resources"><span class="ico">⛏️</span><b>${L('Природные ресурсы', 'Natural resources')}</b><small>${L('Бассейны и месторождения, страны-лидеры', 'Basins, deposits and leading countries')}</small></button>
      <button class="tile" data-go="disputes"><span class="ico">⚖️</span><b>${L('Спорные территории', 'Disputed territories')}</b><small>${L('Частично признанные государства и территориальные споры', 'Partially recognized states and territorial disputes')}</small></button>
      <button class="tile wide" data-go="quiz"><span class="ico">📝</span><span><b>${L('Викторина по билетам', 'Exam quiz')}</b><small>${L(`${QUIZ.length} вопросов с вариантами ответов по 25 темам`, `${QUIZ.length} multiple-choice questions on 25 topics`)}</small></span></button>
      <button class="tile wide" data-go="stats"><span class="ico">🏆</span><span><b>${L('Мои результаты', 'My results')}</b><small>${L('Лучшие результаты во всех режимах', 'Your best scores in every mode')}</small></span></button>
    </div>
    <p class="note" style="text-align:center;margin-top:22px">${L('Карта: приближайте колёсиком мыши или двумя пальцами, перемещайте перетаскиванием. Маленькие государства показаны кружками.', 'Map: zoom with the mouse wheel or two fingers, drag to pan. Very small states are shown as circles.')}</p>
  </div></div>`;
  const routes = { resources: ResourceMenu, disputes: DisputeMenu, guess: GuessMenu, stats: Stats, orgs: OrgList, gov: () => GovMenu('gov'), fed: () => GovMenu('fed'), straits: StraitMenu, regions: RegionList, quiz: QuizMenu };
  app.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => go(routes[b.dataset.go]); });
  app.querySelectorAll('[data-lang]').forEach(b => {
    b.onclick = () => {
      if (LANG === b.dataset.lang) return;
      LANG = b.dataset.lang; store.set('lang', LANG); applyLang();
      show(Home);
    };
  });
}

// ===================== Организации и регионы =====================
function setRows(list, kind) {
  return list.map((s, i) => {
    const b = ['find', 'select'].map(m => store.get(`best:${kind}:${s.id}:${m}`)).filter(Boolean).map(x => x.pct);
    return `<button class="row" data-i="${i}"><span class="badge">${esc(s.short)}</span><span class="txt"><div>${esc(s.name || s.short)}</div><small>${countries(s.keys.length)}</small></span>${b.length ? `<span class="best">${Math.max(...b)}%</span>` : ''}<span class="chev">›</span></button>`;
  }).join('');
}
function OrgList() {
  const sets = ORGS.map(o => Object.assign({}, o, { short: orgShort(o), name: orgName(o), info: orgInfo(o), keys: keysOf(o.members) }));
  const main = sets.filter(s => !s.other), other = sets.filter(s => s.other);
  app.innerHTML = `${topbar(L('Международные организации', 'International organizations'))}<div class="page"><div class="wrap">
    <div class="section-title">${L('Основные', 'Main')}</div><div class="list" id="l1">${setRows(main, 'org')}</div>
    <div class="section-title">${L('Другие объединения', 'Other groupings')}</div><div class="list" id="l2">${setRows(other, 'org')}</div>
  </div></div>`;
  bindBack();
  $('#l1').querySelectorAll('.row').forEach(r => { r.onclick = () => go(SetMenu, { kind: 'org', set: main[+r.dataset.i] }); });
  $('#l2').querySelectorAll('.row').forEach(r => { r.onclick = () => go(SetMenu, { kind: 'org', set: other[+r.dataset.i] }); });
}
function RegionList() {
  const regs = REGIONS.map(r => Object.assign({}, r, { keys: keysOf(r.members), name: L(r.short, REGIONS_EN[r.id]), short: L('Билет ', 'Topic ') + r.ticket }));
  const conts = REGION_FILTERS.map(r => ({ id: 'cont-' + r.id, short: rLabel(r), name: r.id === 'ALL' ? L('Все страны мира', 'All countries of the world') : L('Все страны: ' + r.ru.toLowerCase(), 'All countries: ' + r.en), keys: regionKeys(r), view: r.view, center: r.center }));
  app.innerHTML = `${topbar(L('Регионы и страны', 'Regions and countries'))}<div class="page"><div class="wrap">
    <div class="section-title">${L('Регионы из экзаменационных билетов', 'Regions from the exam topics')}</div><div class="list" id="l1">${setRows(regs, 'reg')}</div>
    <div class="section-title">${L('Части света (члены ООН)', 'Continents (UN members)')}</div><div class="list" id="l2">${setRows(conts, 'reg')}</div>
  </div></div>`;
  bindBack();
  $('#l1').querySelectorAll('.row').forEach(r => { r.onclick = () => go(SetMenu, { kind: 'reg', set: regs[+r.dataset.i] }); });
  $('#l2').querySelectorAll('.row').forEach(r => { r.onclick = () => go(SetMenu, { kind: 'reg', set: conts[+r.dataset.i] }); });
}
function SetMenu({ kind, set }) {
  const title = kind === 'org' ? set.short : set.name;
  const idb = `${kind}:${set.id}`;
  const names = set.keys.map(nameOf).sort(cmp);
  app.innerHTML = `${topbar(title)}<div class="page"><div class="wrap">
    <div class="info-card">
      <p><b>${esc(set.name || set.short)}</b></p>
      ${set.info ? `<p>${esc(set.info)}</p>` : ''}
      <p class="members"><b>${countries(set.keys.length)}:</b> ${esc(names.join(', '))}</p>
    </div>
    <div class="modes">
      <button class="mode" data-m="study"><span class="ico">🔍</span><span class="txt"><div>${L('Изучить на карте', 'Study the map')}</div><small>${L('Страны выделены цветом, нажмите для подписи', 'Countries are highlighted; tap one to see its name')}</small></span></button>
      <button class="mode" data-m="find"><span class="ico">📍</span><span class="txt"><div>${L('Найди страну', 'Find the country')}</div><small>${L('Называется страна — нажмите на неё на карте', 'A country is named — tap it on the map')}</small></span><span class="best">${best(idb + ':find')}</span></button>
      <button class="mode" data-m="select"><span class="ico">✅</span><span class="txt"><div>${L('Отметь всех участников', 'Select all members')}</div><small>${L('Отметьте все страны сами, затем проверьте', 'Mark every country yourself, then check')}</small></span><span class="best">${best(idb + ':select')}</span></button>
    </div>
  </div></div>`;
  bindBack();
  const scope = new Set(set.keys);
  const base = { view: set.view, center: set.center || 0 };
  const acts = {
    study: () => go(playStudy, Object.assign({ title, scope, infoOf: countryInfo, chips: set.keys.slice().sort(byName), groups: [{ cls: 'sel', keys: set.keys, label: title, color: 'var(--c-sel)' }] }, base)),
    find: () => go(playFind, Object.assign({ id: idb + ':find', title, keys: set.keys, infoOf: countryInfo }, base)),
    select: () => go(playSelect, Object.assign({ id: idb + ':select', title, keys: set.keys,
      what: kind === 'org' ? L(`страны — участницы «${set.short}»`, `member states of ${set.short}`) : L(`страны региона «${set.name}»`, `countries of ${set.name}`), infoOf: countryInfo }, base)),
  };
  app.querySelectorAll('[data-m]').forEach(b => { b.onclick = acts[b.dataset.m]; });
}

// ===================== Формы правления / устройство =====================
const govState = { region: 'ALL', count: 20 };
function GovMenu(kind) {
  const isGov = kind === 'gov';
  const render = () => {
    const title = isGov ? L('Формы правления', 'Forms of government') : L('Федерации', 'Federations');
    const reg = REGION_FILTERS.find(r => r.id === govState.region);
    const keys = regionKeys(reg);
    const special = keys.filter(k => isGov ? govOf(k) !== 'rep' : isFed(k));
    const idb = `${kind}:${reg.id}`;
    app.innerHTML = `${topbar(title)}<div class="page"><div class="wrap">
      <div class="info-card">${isGov
        ? L(`<p><b>Монархия</b> — власть главы государства передаётся по наследству (абсолютная, конституционная, теократическая). <b>Республика</b> — органы власти избираются.</p><p class="members">В мире 43 монархии; из них 15 — королевства Содружества, где глава государства — британский монарх.</p>`,
            `<p>In a <b>monarchy</b> the head of state inherits power (absolute, constitutional or theocratic monarchy). In a <b>republic</b> the organs of power are elected.</p><p class="members">There are 43 monarchies in the world; 15 of them are Commonwealth realms whose head of state is the British monarch.</p>`)
        : L(`<p><b>Федерация</b> — государство, состоящее из субъектов с собственными органами власти и законодательством. <b>Унитарное государство</b> — единое государство, делящееся на административные единицы.</p><p class="members">В мире около 28 федераций.</p>`,
            `<p>A <b>federation</b> is a state made up of constituent units with their own government and laws. A <b>unitary state</b> is a single state divided into administrative units.</p><p class="members">There are about 28 federations in the world.</p>`)}
      </div>
      <div class="section-title">${L('Регион', 'Region')}</div>
      <div class="chips" id="reg">${REGION_FILTERS.map(r => `<button class="chip ${r.id === govState.region ? 'on' : ''}" data-r="${r.id}">${rLabel(r)}</button>`).join('')}</div>
      <p class="note">${countries(keys.length)}${L(', из них ', '; ')}${isGov ? L('монархий', 'monarchies') : L('федераций', 'federations')}: ${special.length}</p>
      <div class="section-title">${L('Количество вопросов (режим «Определи»)', 'Number of questions (“Identify” mode)')}</div>
      <div class="chips" id="cnt">${[10, 20, 40, 0].map(c => `<button class="chip ${c === govState.count ? 'on' : ''}" data-c="${c}">${c || L('Все', 'All')}</button>`).join('')}</div>
      <div class="modes">
        <button class="mode" data-m="study"><span class="ico">🔍</span><span class="txt"><div>${L('Изучить карту', 'Study the map')}</div><small>${isGov ? L('Цвет страны = форма правления', 'Colour = form of government') : L('Федерации выделены цветом', 'Federations are highlighted')}</small></span></button>
        <button class="mode" data-m="choose"><span class="ico">❓</span><span class="txt"><div>${isGov ? L('Определи форму правления', 'Identify the form of government') : L('Федерация или унитарное?', 'Federal or unitary?')}</div><small>${L('Страна подсвечена на карте — выберите ответ', 'A country is highlighted — pick the answer')}</small></span><span class="best">${best(idb + ':choose:' + govState.count)}</span></button>
        <button class="mode" data-m="select"><span class="ico">✅</span><span class="txt"><div>${isGov ? L('Отметь все монархии', 'Select all monarchies') : L('Отметь все федерации', 'Select all federations')}</div><small>${L('Найдите их на карте сами, затем проверьте', 'Find them on the map yourself, then check')}</small></span><span class="best">${best(idb + ':select')}</span></button>
        <button class="mode" data-m="find"><span class="ico">📍</span><span class="txt"><div>${isGov ? L('Найди монархию', 'Find the monarchy') : L('Найди федерацию', 'Find the federation')}</div><small>${L('Называется страна — нажмите на неё на карте', 'A country is named — tap it on the map')}</small></span><span class="best">${best(idb + ':find')}</span></button>
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
        q: `${isGov ? L('Форма правления', 'Form of government') : L('Государственное устройство', 'Territorial structure')}: <b>${esc(nameOf(k))}</b>`,
        correct: isGov ? govLabel(govOf(k)) : (isFed(k) ? fedLabel() : uniLabel()),
        info: infoOf(k),
      }));
    };
    const acts = {
      study: () => {
        const groups = isGov
          ? Object.entries(GOV_TYPES).map(([t, g]) => ({ cls: 'g-' + t, label: govLabel(t), color: g.color, keys: keys.filter(k => govOf(k) === t) }))
          : [{ cls: 'g-fed', label: fedLabel(), color: '#3aa57a', keys: special }, { cls: 'g-uni', label: L('Унитарное', 'Unitary'), color: '#cfd8e3', keys: keys.filter(k => !isFed(k)) }];
        go(playStudy, Object.assign({ title, scope, groups, infoOf, chips: special.slice().sort(byName) }, base));
      },
      choose: () => go(playChoose, Object.assign({
        id: idb + ':choose:' + govState.count, title, nameOf, items: makeItems(), regen: makeItems,
        fixedOptions: isGov ? Object.keys(GOV_TYPES).map(govLabel) : [fedLabel(), uniLabel()],
      }, base)),
      select: () => go(playSelect, Object.assign({ id: idb + ':select', title, keys: special, what: isGov ? L('монархии', 'monarchies') : L('федерации', 'federations'), infoOf }, base)),
      find: () => go(playFind, Object.assign({ id: idb + ':find', title, keys: special, verb: isGov ? L('Найдите монархию', 'Find the monarchy') : L('Найдите федерацию', 'Find the federation'), infoOf }, base)),
    };
    app.querySelectorAll('[data-m]').forEach(b => { b.onclick = acts[b.dataset.m]; });
  };
  render();
}

// ===================== Проливы =====================
const straitState = { count: 15 };
function StraitMenu() {
  const render = () => {
    const title = L('Проливы', 'Straits');
    const pins = straitPins();
    app.innerHTML = `${topbar(title)}<div class="page"><div class="wrap">
      <div class="info-card"><p>${L(`${STRAITS.length} важнейших проливов мира. После каждого ответа показывается, какие моря (океаны) пролив соединяет и какие территории разделяет.`, `The world’s ${STRAITS.length} most important straits. After each answer you’ll see which seas (oceans) the strait connects and which lands it separates.`)}</p></div>
      <div class="section-title">${L('Количество вопросов', 'Number of questions')}</div>
      <div class="chips">${[10, 15, 30, 0].map(c => `<button class="chip ${c === straitState.count ? 'on' : ''}" data-c="${c}">${c || L('Все', 'All')}</button>`).join('')}</div>
      <div class="modes">
        <button class="mode" data-m="study"><span class="ico">🔍</span><span class="txt"><div>${L('Изучить карту', 'Study the map')}</div><small>${L('Все проливы с подписями', 'All straits with labels')}</small></span></button>
        <button class="mode" data-m="find"><span class="ico">📍</span><span class="txt"><div>${L('Найди пролив', 'Find the strait')}</div><small>${L('Называется пролив — нажмите на нужную точку', 'A strait is named — tap its marker')}</small></span><span class="best">${best('str:find:' + straitState.count)}</span></button>
        <button class="mode" data-m="choose"><span class="ico">❓</span><span class="txt"><div>${L('Как называется пролив?', 'Name the strait')}</div><small>${L('Точка подсвечена — выберите название из 4 вариантов', 'A marker is highlighted — pick its name from 4 options')}</small></span><span class="best">${best('str:choose:' + straitState.count)}</span></button>
      </div>
    </div></div>`;
    bindBack();
    app.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { straitState.count = +b.dataset.c; render(); }; });
    const pick = () => { const all = pins.map(p => p.key); return straitState.count ? sample(all, straitState.count) : shuffle(all); };
    const makeItems = () => pick().map(k => {
      const wrong = sample(pins.filter(p => p.key !== k).map(p => p.label), 3);
      return { key: k, q: L('Как называется этот пролив?', 'What is this strait called?'), correct: straitName(k), options: shuffle([straitName(k), ...wrong]), info: straitInfo(k) };
    });
    const acts = {
      study: () => go(playStudy, { title, pins, labels: true, nameOf: straitName, infoOf: straitInfo, chips: pins.map(p => p.key) }),
      find: () => go(playFind, { id: 'str:find:' + straitState.count, title, keys: pick(), pins, nameOf: straitName, infoOf: straitInfo, verb: L('Найдите пролив', 'Find the strait') }),
      choose: () => go(playChoose, { id: 'str:choose:' + straitState.count, title, pins, nameOf: straitName, items: makeItems(), regen: makeItems }),
    };
    app.querySelectorAll('[data-m]').forEach(b => { b.onclick = acts[b.dataset.m]; });
  };
  render();
}

// ===================== Спорные территории =====================
const disputeState = { count: 10 };
function DisputeMenu() {
  const render = () => {
    const title = L('Спорные территории', 'Disputed territories');
    const pins = disputePins();
    const stateKeys = pins.filter((p, i) => DISPUTES[i].group === 'state').map(p => p.key);
    const terrKeys = pins.filter((p, i) => DISPUTES[i].group === 'terr').map(p => p.key);
    app.innerHTML = `${topbar(title)}<div class="page"><div class="wrap">
      <div class="info-card">
        <p>${L('Территории, статус которых признают не все государства: частично признанные и непризнанные государства, а также земли, на которые претендуют сразу несколько стран.', 'Places whose status not every state accepts: partially recognized and unrecognized states, and lands claimed by more than one country.')}</p>
        <p class="members">${L(`${stateKeys.length} государств и ${terrKeys.length} территорий. Для каждой указано, кто фактически её контролирует и кто на неё претендует. Данные — на 2025 г.`, `${stateKeys.length} states and ${terrKeys.length} territories. Each entry says who actually controls it and who claims it. Data as of 2025.`)}</p>
      </div>
      <div class="section-title">${L('Количество вопросов', 'Number of questions')}</div>
      <div class="chips">${[10, 20, 0].map(c => `<button class="chip ${c === disputeState.count ? 'on' : ''}" data-c="${c}">${c || L('Все', 'All') + ' (' + pins.length + ')'}</button>`).join('')}</div>
      <div class="modes">
        <button class="mode" data-m="study"><span class="ico">🔍</span><span class="txt"><div>${L('Изучить карту', 'Study the map')}</div><small>${L('Все территории с подписями и справкой', 'Every territory with a label and a profile')}</small></span></button>
        <button class="mode" data-m="find"><span class="ico">📍</span><span class="txt"><div>${L('Найди территорию', 'Find the territory')}</div><small>${L('Называется территория — нажмите на нужную точку', 'A territory is named — tap its marker')}</small></span><span class="best">${best('disp:find:' + disputeState.count)}</span></button>
        <button class="mode" data-m="choose"><span class="ico">❓</span><span class="txt"><div>${L('Что это за территория?', 'Name the territory')}</div><small>${L('Точка подсвечена — выберите название из 4 вариантов', 'A marker is highlighted — pick its name from 4 options')}</small></span><span class="best">${best('disp:choose:' + disputeState.count)}</span></button>
        <button class="mode" data-m="ctrl"><span class="ico">🏳️</span><span class="txt"><div>${L('Кто контролирует?', 'Who controls it?')}</div><small>${L('Выберите, кто фактически управляет территорией', 'Pick who actually governs the territory')}</small></span><span class="best">${best('disp:ctrl:' + disputeState.count)}</span></button>
      </div>
    </div></div>`;
    bindBack();
    app.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { disputeState.count = +b.dataset.c; render(); }; });
    const pick = () => { const all = pins.map(p => p.key); return disputeState.count ? sample(all, disputeState.count) : shuffle(all); };
    const nameItems = () => pick().map(k => {
      const wrong = sample(pins.filter(p => p.key !== k).map(p => p.label), 3);
      return { key: k, q: L('Что это за территория?', 'Which territory is this?'), correct: disputeName(k), options: shuffle([disputeName(k), ...wrong]), info: disputeInfo(k) };
    });
    const ctrlOf = k => dispT(+k.slice(1)).ctrl;
    const allCtrl = [...new Set(pins.map(p => ctrlOf(p.key)))];
    const ctrlItems = () => pick().map(k => {
      const right = ctrlOf(k);
      const wrong = sample(allCtrl.filter(c => c !== right), 3);
      return { key: k, q: `${L('Кто фактически контролирует территорию', 'Who actually controls this territory')}: <b>${esc(disputeName(k))}</b>`, correct: right, options: shuffle([right, ...wrong]), info: disputeInfo(k) };
    });
    const acts = {
      study: () => go(playStudy, { title, pins, labels: true, nameOf: disputeName, infoOf: disputeInfo, chips: pins.map(p => p.key),
        groups: [
          { cls: 'g-state', label: L('Частично признанные и непризнанные государства', 'Partially recognized and unrecognized states'), color: '#8e5ec9', keys: stateKeys },
          { cls: 'g-terr', label: L('Территориальные споры', 'Territorial disputes'), color: '#d9534f', keys: terrKeys },
        ] }),
      find: () => go(playFind, { id: 'disp:find:' + disputeState.count, title, keys: pick(), pins, nameOf: disputeName, infoOf: disputeInfo, verb: L('Найдите', 'Find') }),
      choose: () => go(playChoose, { id: 'disp:choose:' + disputeState.count, title, pins, nameOf: disputeName, items: nameItems(), regen: nameItems }),
      ctrl: () => go(playChoose, { id: 'disp:ctrl:' + disputeState.count, title, modeLabel: L('кто контролирует', 'who controls it'), pins, nameOf: disputeName, items: ctrlItems(), regen: ctrlItems }),
    };
    app.querySelectorAll('[data-m]').forEach(b => { b.onclick = acts[b.dataset.m]; });
  };
  render();
}

// ===================== Природные ресурсы =====================
const resState = { group: 'all', count: 15 };
function ResourceMenu() {
  const render = () => {
    const title = L('Природные ресурсы', 'Natural resources');
    const idx = DEPOSITS.map((d, i) => i).filter(i => resState.group === 'all' || resGroupOf(i) === resState.group);
    const pins = idx.map(i => ({ key: 'r' + i, lonlat: DEPOSITS[i].ll, label: resT(i).name }));
    const gid = `${resState.group}:${resState.count}`;
    app.innerHTML = `${topbar(title)}<div class="page"><div class="wrap">
      <div class="info-card">
        <p>${L('Важнейшие бассейны и месторождения мира: нефть и газ, уголь, руды металлов, золото и алмазы, уран, химическое сырьё. После каждого ответа — справка: где находится и что добывают.', 'The world’s key basins and deposits: oil and gas, coal, metal ores, gold and diamonds, uranium, chemical raw materials. After each answer you get a short profile: where it is and what is mined.')}</p>
        <p class="members">${L(`Месторождений и бассейнов: ${DEPOSITS.length}; рейтингов стран-лидеров: ${RES_LEADERS.length}.`, `${DEPOSITS.length} deposits and basins; ${RES_LEADERS.length} country rankings.`)}</p>
      </div>
      <div class="section-title">${L('Тип ресурса', 'Resource type')}</div>
      <div class="chips">${[['all', L('Все', 'All'), null]].concat(Object.entries(RES_GROUPS).map(([g, v]) => [g, L(v.ru, v.en), v.color]))
        .map(([g, label, color]) => `<button class="chip ${g === resState.group ? 'on' : ''}" data-g="${g}">${color ? `<i class="dot" style="background:${color}"></i>` : ''}${esc(label)}</button>`).join('')}</div>
      <p class="note">${L('Выбрано', 'Selected')}: ${pins.length}</p>
      <div class="section-title">${L('Количество вопросов', 'Number of questions')}</div>
      <div class="chips">${[10, 15, 30, 0].map(c => `<button class="chip ${c === resState.count ? 'on' : ''}" data-c="${c}">${c || L('Все', 'All')}</button>`).join('')}</div>
      <div class="modes">
        <button class="mode" data-m="study"><span class="ico">🔍</span><span class="txt"><div>${L('Изучить карту', 'Study the map')}</div><small>${L('Цвет точки — тип ресурса; нажмите, чтобы узнать подробности', 'Marker colour shows the resource type; tap for details')}</small></span></button>
        <button class="mode" data-m="find"><span class="ico">📍</span><span class="txt"><div>${L('Найди месторождение', 'Find the deposit')}</div><small>${L('Называется бассейн или месторождение — нажмите на нужную точку', 'A basin or deposit is named — tap its marker')}</small></span><span class="best">${best('res:find:' + gid)}</span></button>
        <button class="mode" data-m="choose"><span class="ico">❓</span><span class="txt"><div>${L('Что это за месторождение?', 'Name the deposit')}</div><small>${L('Точка подсвечена — выберите название из 4 вариантов', 'A marker is highlighted — pick its name from 4 options')}</small></span><span class="best">${best('res:choose:' + gid)}</span></button>
        <button class="mode" data-m="what"><span class="ico">⛏️</span><span class="txt"><div>${L('Что здесь добывают?', 'What is mined here?')}</div><small>${L('Точка подсвечена — выберите главный ресурс', 'A marker is highlighted — pick the main resource')}</small></span><span class="best">${best('res:what:' + gid)}</span></button>
        <button class="mode" data-m="leaders"><span class="ico">🏆</span><span class="txt"><div>${L('Страны-лидеры', 'Leading countries')}</div><small>${L('Кто первый по запасам и добыче? Нажмите на страну на карте', 'Who is first in reserves and output? Tap the country on the map')}</small></span><span class="best">${best('res:leaders:' + resState.count)}</span></button>
      </div>
    </div></div>`;
    bindBack();
    app.querySelectorAll('[data-g]').forEach(b => { b.onclick = () => { resState.group = b.dataset.g; render(); }; });
    app.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { resState.count = +b.dataset.c; render(); }; });
    const pick = () => { const all = pins.map(p => p.key); return resState.count ? sample(all, resState.count) : shuffle(all); };
    const nameItems = () => pick().map(k => {
      const wrong = sample(pins.filter(p => p.key !== k).map(p => p.label), 3);
      return { key: k, q: L('Что это за месторождение или бассейн?', 'Which deposit or basin is this?'), correct: depositName(k), options: shuffle([depositName(k), ...wrong]), info: depositInfo(k) };
    });
    const whatItems = () => pick().map(k => {
      const d = DEPOSITS[+k.slice(1)];
      const right = resLabel(d.res[0]);
      const wrong = sample(Object.keys(RES_TYPES).filter(c => !d.res.includes(c)), 3).map(resLabel);
      // название не показываем до ответа — оно часто подсказывает ресурс («Фосфориты Хурибги»)
      return { key: k, q: L('Что главным образом добывают здесь?', 'What is mainly mined here?'), correct: right, options: shuffle([right, ...wrong]), info: `${depositName(k)} — ${depositInfo(k)}` };
    });
    const groups = Object.entries(RES_GROUPS).map(([g, v]) => ({ cls: 'r-' + g, label: L(v.ru, v.en), color: v.color, keys: pins.filter(p => resGroupOf(+p.key.slice(1)) === g).map(p => p.key) })).filter(g => g.keys.length);
    const acts = {
      study: () => go(playStudy, { title, pins, labels: true, nameOf: depositName, infoOf: depositInfo, chips: pins.map(p => p.key), groups }),
      find: () => go(playFind, { id: 'res:find:' + gid, title, keys: pick(), pins, nameOf: depositName, infoOf: depositInfo, verb: L('Найдите', 'Find') }),
      choose: () => go(playChoose, { id: 'res:choose:' + gid, title, pins, nameOf: depositName, items: nameItems(), regen: nameItems }),
      what: () => go(playChoose, { id: 'res:what:' + gid, title, modeLabel: L('что здесь добывают', 'what is mined here'), pins, nameOf: depositName, items: whatItems(), regen: whatItems }),
      leaders: () => go(playLeaders, { id: 'res:leaders:' + resState.count, title: L('Страны-лидеры', 'Leading countries'), count: resState.count }),
    };
    app.querySelectorAll('[data-m]').forEach(b => { b.onclick = acts[b.dataset.m]; });
  };
  render();
}

// Режим «Страны-лидеры»: нажмите на карте на страну, занимающую первое место
function playLeaders(cfg) {
  const ui = gameShell(cfg.title);
  const items = cfg.items || (cfg.count ? sample(RES_LEADERS, cfg.count) : shuffle(RES_LEADERS));
  const map = GeoMap(ui.mapEl, { center: 10, onClick });
  map.setHome(null); map.fitView(null, false);
  const timer = makeTimer(ui.timerEl);
  const label = it => L(it.ru, it.en);
  const res = [];
  let i = 0, tries = 0, state = 'ask';
  function ask() {
    if (i >= items.length) return finish();
    const it = items[i];
    tries = 0; state = 'ask';
    map.removeAll('ok1 ok2 ok3 fail sel hl');
    ui.prog.textContent = `${i + 1}/${items.length}`;
    ui.bar.style.width = (i / items.length * 100) + '%';
    ui.prompt.innerHTML = `${L('Первое место', 'Number one')}: <b>${esc(label(it))}</b> <span class="sub">${L('Нажмите на страну-лидера на карте', 'Tap the leading country on the map')}</span>`;
    ui.panel.innerHTML = `<div class="btnrow"><button class="btn ghost" data-a="skip">${L('Не знаю — показать', 'Don’t know — show me')}</button></div>`;
    ui.panel.querySelector('[data-a=skip]').onclick = () => { if (state === 'ask') { tries = 3; reveal(); } };
  }
  function reveal() {
    state = 'reveal';
    const t = items[i].top[0];
    map.add(t, 'hl'); map.ensureVisible(t);
    ui.prompt.innerHTML = `${L('Правильный ответ', 'Correct answer')}: <b>${esc(nameOf(t))}</b> <span class="sub">${L('подсвечен на карте — нажмите на него, чтобы продолжить', 'highlighted on the map — tap it to continue')}</span>`;
  }
  function onClick(k, ev) {
    const it = items[i];
    if (state === 'done' || state === 'finished') {
      const place = it && state === 'done' ? it.top.indexOf(k) : -1;
      map.tip(nameOf(k) + (place >= 0 ? ` — №${place + 1}` : ''), ev, '', 1500);
      return;
    }
    const target = it.top[0];
    if (state === 'reveal') {
      if (k === target) showResult();
      else map.tip(L('Нажмите на подсвеченную: ', 'Tap the highlighted one: ') + nameOf(target), ev, 'bad');
      return;
    }
    if (k === target) { map.tip(nameOf(k), ev, 'good', 900); showResult(); }
    else {
      tries++; buzz(); map.flash(k); map.tip(L('Это: ', 'That’s ') + nameOf(k), ev, 'bad');
      if (tries >= 3) reveal();
    }
  }
  function showResult() {
    state = 'done';
    const it = items[i], [first, ...rest] = it.top;
    res[i] = tries;
    map.remove(first, 'hl'); map.add(first, tries >= 3 ? 'fail' : 'ok' + (tries + 1));
    rest.forEach(k => map.add(k, 'sel'));
    ui.prompt.innerHTML = `<b>${esc(label(it))}</b> <span class="sub">${esc(L(it.note.ru, it.note.en))}</span>`;
    const firstColor = ['var(--c-ok1)', 'var(--c-ok2)', 'var(--c-ok3)', 'var(--c-fail)'][Math.min(tries, 3)];
    ui.panel.innerHTML = `<div class="legend"><span><i style="background:${firstColor}"></i>${L('№1', '#1')}</span>${rest.length ? `<span><i style="background:var(--c-sel)"></i>${rest.length > 1 ? L('№2–3', '#2–3') : L('№2', '#2')}</span>` : ''}</div>
      <div class="btnrow"><button class="btn">${i + 1 < items.length ? L('Далее', 'Next') : L('Результаты', 'Results')}</button></div>`;
    ui.panel.querySelector('.btn').onclick = () => { i++; ask(); };
  }
  function finish() {
    state = 'finished'; timer.stop();
    map.removeAll('ok1 ok2 ok3 fail sel hl');
    const n = items.length;
    const pct = Math.round(items.reduce((s, it, j) => s + [1, 0.5, 0.25, 0][res[j]], 0) / n * 100);
    const first = res.filter(r => r === 0).length;
    saveBest(cfg.id, pct, timer.secs(), L('Страны-лидеры по ресурсам', 'Leading countries by resource'));
    const wrongIdx = items.map((it, j) => j).filter(j => res[j] > 0);
    inlineResult(ui, {
      pct, line: L(`С первой попытки: ${first} из ${n}`, `First try: ${first} of ${n}`) + ` · ${fmtTime(timer.secs())} · ${stars(pct)}`,
      mistakes: wrongIdx.map(j => ({ key: String(j), name: label(items[j]), note: nameOf(items[j].top[0]) })),
      onRetry: () => replace(playLeaders, Object.assign({}, cfg, { items: null })),
      onRetryWrong: wrongIdx.length ? () => replace(playLeaders, Object.assign({}, cfg, { items: shuffle(wrongIdx.map(j => items[j])), id: null })) : null,
      onChip: j => {
        const it = items[+j];
        map.removeAll('ok1 sel');
        map.add(it.top[0], 'ok1'); it.top.slice(1).forEach(k => map.add(k, 'sel'));
        ui.prompt.innerHTML = `<b>${esc(label(it))}</b> <span class="sub">${esc(L(it.note.ru, it.note.en))}</span>`;
      },
    });
  }
  ask();
  return () => timer.stop();
}

// ===================== Викторина по билетам =====================
const quizState = store.get('quizState') || { topics: Object.keys(TOPICS).map(Number), count: 20 };
function QuizMenu() {
  const byTopic = {};
  QUIZ.forEach(q => { byTopic[q.t] = (byTopic[q.t] || 0) + 1; });
  const render = () => {
    const sel = new Set(quizState.topics);
    const avail = QUIZ.filter(q => sel.has(q.t)).length;
    const n = quizState.count ? Math.min(quizState.count, avail) : avail;
    app.innerHTML = `${topbar(L('Викторина по билетам', 'Exam quiz'))}<div class="page"><div class="wrap">
      <div class="info-card"><p>${L('Вопросы с вариантами ответов по теоретическим темам экзаменационных билетов. После каждого ответа — пояснение.', 'Multiple-choice questions on the theory topics of the exam. Each answer comes with an explanation.')}</p></div>
      <div class="section-title">${L('Количество вопросов', 'Number of questions')}</div>
      <div class="chips">${[10, 20, 40, 0].map(c => `<button class="chip ${c === quizState.count ? 'on' : ''}" data-c="${c}">${c || L('Все', 'All')}</button>`).join('')}</div>
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">${L('Темы', 'Topics')}
        <span><button class="chip" data-all="1">${L('Все', 'All')}</button> <button class="chip" data-all="0">${L('Ни одной', 'None')}</button></span></div>
      <div class="list topic-list">${Object.keys(TOPICS).map(t => `<label><input type="checkbox" id="topic-${t}" data-t="${t}" ${sel.has(+t) ? 'checked' : ''}><span class="num">${t}.</span><span>${esc(topicName(t))}</span><small>${byTopic[t] || 0}</small></label>`).join('')}</div>
      <div class="sticky-bottom"><button class="btn" id="start" style="width:100%" ${avail ? '' : 'disabled'}>${L(`Начать (${n} из ${avail})`, `Start (${n} of ${avail})`)}</button></div>
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
      const pool = shuffle(QUIZ.map((q, i) => i).filter(i => sel.has(QUIZ[i].t)));
      go(playQuiz, { qs: quizState.count ? pool.slice(0, quizState.count) : pool });
    };
  };
  render();
}
// qs — индексы вопросов в QUIZ / QUIZ_EN
function playQuiz({ qs, retry }) {
  let i = 0, right = 0;
  const log = [];
  const t0 = Date.now();
  const title = retry ? L('Работа над ошибками', 'Review mistakes') : L('Викторина', 'Quiz');
  app.innerHTML = `${topbar(title, '<span class="prog"></span><span class="score"></span>')}<div class="progress"><div></div></div><div class="page"><div class="wrap" id="qw"></div></div>`;
  bindBack();
  const qw = $('#qw');
  function ask() {
    if (i >= qs.length) return finish();
    const q = quizQ(qs[i]);
    const opts = shuffle([q.a, ...q.w]);
    $('.prog').textContent = `${i + 1}/${qs.length}`;
    $('.score').textContent = `✓ ${right}`;
    $('.progress>div').style.width = (i / qs.length * 100) + '%';
    qw.innerHTML = `<div class="qcard"><div class="topic">${L('Билет', 'Topic')} ${q.t} · ${esc(topicName(q.t))}</div><h2>${esc(q.q)}</h2>
      <div class="qopts">${opts.map(o => `<button class="opt">${esc(o)}</button>`).join('')}</div><div id="after"></div></div>`;
    qw.querySelectorAll('.opt').forEach(b => { b.onclick = () => answer(b, q); });
    $('.page').scrollTop = 0;
  }
  function answer(btn, q) {
    const ok = btn.textContent === q.a;
    qw.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.textContent === q.a) b.classList.add('right'); });
    if (!ok) { btn.classList.add('wrong'); buzz(); } else right++;
    log.push({ idx: qs[i], ok, given: btn.textContent });
    $('.score').textContent = `✓ ${right}`;
    $('#after').innerHTML = `<div class="explain">${ok ? `<b style="color:var(--ok)">${L('Верно!', 'Correct!')}</b>` : `<b style="color:var(--bad)">${L('Неверно.', 'Wrong.')}</b> ${L('Правильный ответ', 'Correct answer')}: <b>${esc(q.a)}</b>.`} ${esc(q.e || '')}</div>
      <div style="margin-top:12px"><button class="btn" style="width:100%" id="next">${i + 1 < qs.length ? L('Далее', 'Next') : L('Результаты', 'Results')}</button></div>`;
    $('#next').onclick = () => { i++; ask(); };
    $('#next').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function finish() {
    const pct = Math.round(right / qs.length * 100);
    const secs = Math.round((Date.now() - t0) / 1000);
    const wrong = log.filter(l => !l.ok);
    $('.progress>div').style.width = '100%';
    qw.innerHTML = `<div class="result"><div class="score">${pct}%</div><div class="stars">${stars(pct)}</div><div class="sub">${L(`Верно ${right} из ${qs.length}`, `${right} of ${qs.length} correct`)} · ${fmtTime(secs)}</div></div>
      <div class="btnrow" style="margin:14px 0">
        <button class="btn ghost" id="menu">${L('Меню', 'Menu')}</button>
        ${wrong.length ? `<button class="btn ghost" id="rw">${L('Только ошибки', 'Mistakes only')}</button>` : ''}
        <button class="btn" id="again">${L('Ещё раз', 'Play again')}</button></div>
      ${wrong.length ? `<div class="section-title">${L('Разбор ошибок', 'Review')}</div>${wrong.map(l => { const q = quizQ(l.idx); return `<div class="qcard" style="margin-bottom:10px"><div class="topic">${L('Билет', 'Topic')} ${q.t}</div><p style="margin:0 0 6px;font-weight:600">${esc(q.q)}</p><p style="margin:0;color:var(--bad)">${L('Ваш ответ', 'Your answer')}: ${esc(l.given)}</p><p style="margin:0 0 6px;color:var(--ok)">${L('Верно', 'Correct')}: ${esc(q.a)}</p><p style="margin:0;color:var(--muted);font-size:14px">${esc(q.e || '')}</p></div>`; }).join('')}` : `<p class="note" style="text-align:center">${L('Без ошибок — отлично!', 'No mistakes — excellent!')}</p>`}`;
    $('#menu').onclick = back;
    $('#again').onclick = () => replace(playQuiz, { qs: shuffle(qs), retry });
    if (wrong.length) $('#rw').onclick = () => replace(playQuiz, { qs: shuffle(wrong.map(l => l.idx)), retry: true });
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
    app.innerHTML = `${topbar(L('Угадай организацию', 'Guess the organization'))}<div class="page"><div class="wrap">
      <div class="info-card"><p>${L('На карте выделены страны-участницы. Выберите, какое это объединение. Будьте внимательны: составы ЕАЭС, ОДКБ и СНГ похожи.', 'The member states are highlighted on the map. Pick which grouping it is. Careful: the EAEU, CSTO and CIS have similar members.')}</p></div>
      <div class="section-title">${L('Количество вопросов', 'Number of questions')}</div>
      <div class="chips">${[10, 20, 0].map(c => `<button class="chip ${c === guessState.count ? 'on' : ''}" data-c="${c}">${c || L('Все', 'All') + ' (' + pool.length + ')'}</button>`).join('')}</div>
      <div class="section-title">${L('Какие организации', 'Which organizations')}</div>
      <div class="chips"><button class="chip ${guessState.other ? '' : 'on'}" data-o="0">${L('Только основные', 'Main only')} (${ORGS.filter(o => !o.other).length})</button><button class="chip ${guessState.other ? 'on' : ''}" data-o="1">${L('Все', 'All')} (${ORGS.length})</button></div>
      <div class="modes"><button class="mode" id="start"><span class="ico">🧩</span><span class="txt"><div>${L('Начать', 'Start')}</div><small>${L('4 варианта ответа, после ответа — справка об организации', '4 options; after each answer you get a short profile of the organization')}</small></span><span class="best">${best(id)}</span></button></div>
    </div></div>`;
    bindBack();
    app.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { guessState.count = +b.dataset.c; render(); }; });
    app.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => { guessState.other = b.dataset.o === '1'; render(); }; });
    $('#start').onclick = () => go(playGuess, { pool, count: guessState.count, id });
  };
  render();
}
function playGuess(cfg) {
  const ui = gameShell(L('Угадай организацию', 'Guess the organization'));
  const rounds = (cfg.count ? sample(cfg.pool, cfg.count) : shuffle(cfg.pool)).map(o => {
    const others = sample(ORGS.filter(x => x !== o), 3).map(orgShort);
    return { org: o, keys: keysOf(o.members), options: shuffle([orgShort(o), ...others]) };
  });
  const timer = makeTimer(ui.timerEl);
  let i = 0, right = 0, answered = false, map = null;
  const wrong = [];
  const resetMap = () => ui.mapEl.querySelectorAll('svg, .map-tip').forEach(n => n.remove());
  function ask() {
    if (i >= rounds.length) return finish();
    answered = false;
    const r = rounds[i];
    ui.prog.textContent = `${i + 1}/${rounds.length}`;
    ui.bar.style.width = (i / rounds.length * 100) + '%';
    ui.prompt.innerHTML = `${L('Какая это организация?', 'Which organization is this?')} <span class="sub">${L('Выделено', 'Highlighted')}: ${countries(r.keys.length)}</span>`;
    ui.panel.innerHTML = `<div class="opts">${r.options.map(o => `<button class="opt">${esc(o)}</button>`).join('')}</div><div class="feedback">&nbsp;</div><div class="btnrow" hidden><button class="btn">${L('Далее', 'Next')}</button></div>`;
    ui.panel.querySelectorAll('.opt').forEach(b => { b.onclick = () => answer(b); });
    ui.panel.querySelector('.btnrow .btn').onclick = () => { i++; ask(); };
    resetMap();
    map = GeoMap(ui.mapEl, { center: r.org.center || 0, scope: new Set(r.keys), onClick: (k, ev) => map.tip(nameOf(k) + (answered ? ' — ' + countryInfo(k) : ''), ev, '', 2600) });
    map.setHome(r.org.view); map.fitView(r.org.view, false);
    r.keys.forEach(k => map.add(k, 'sel'));
  }
  function answer(btn) {
    if (answered) return; answered = true;
    const r = rounds[i], correct = orgShort(r.org), ok = btn.textContent === correct;
    ui.panel.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.textContent === correct) b.classList.add('right'); });
    if (ok) { right++; r.keys.forEach(k => { map.remove(k, 'sel'); map.add(k, 'ok1'); }); }
    else { btn.classList.add('wrong'); wrong.push(r); buzz(); }
    ui.panel.querySelector('.feedback').innerHTML = (ok ? `<b class="good">${L('Верно!', 'Correct!')}</b> ` : `<b class="bad">${L('Неверно.', 'Wrong.')}</b> ${L('Это', 'It’s')} <b>${esc(correct)}</b>. `) + esc(orgName(r.org)) + '. ' + esc(orgInfo(r.org) || '');
    ui.panel.querySelector('.btnrow').hidden = false;
  }
  function finish() {
    timer.stop();
    const pct = Math.round(right / rounds.length * 100);
    saveBest(cfg.id, pct, timer.secs(), L('Угадай организацию — ', 'Guess the organization — ') + (cfg.count ? L(`${cfg.count} вопросов`, `${cfg.count} questions`) : L('все', 'all')));
    resetMap();
    map = GeoMap(ui.mapEl, { center: 10, onClick: (k, ev) => map.tip(nameOf(k) + ' — ' + countryInfo(k), ev, '', 3200) });
    map.setHome(null); map.fitView(null, false);
    inlineResult(ui, {
      pct, line: `${L('Верно', 'Correct')}: ${right} ${L('из', 'of')} ${rounds.length} · ${fmtTime(timer.secs())} · ${stars(pct)} · ${L('нажмите на страну, чтобы увидеть её организации', 'tap a country to see its organizations')}`,
      mistakes: wrong.map(r => ({ key: r.org.id, name: orgShort(r.org), note: orgName(r.org) })),
      mistakesTitle: L('Не угаданы', 'Missed'),
      onRetry: () => replace(playGuess, cfg),
      onRetryWrong: wrong.length ? () => replace(playGuess, Object.assign({}, cfg, { pool: wrong.map(r => r.org), count: 0, id: null })) : null,
      onChip: id => {
        const o = ORGS.find(x => x.id === id); if (!o) return;
        map.removeAll('sel'); keysOf(o.members).forEach(k => map.add(k, 'sel'));
        ui.prompt.innerHTML = `<b>${esc(orgShort(o))}</b> <span class="sub">${esc(orgName(o))} — ${L('участники выделены на карте', 'members are highlighted on the map')}</span>`;
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
    const list = allBest().sort((a, b) => cmp(bestLabel(a), bestLabel(b)));
    const avg = list.length ? Math.round(list.reduce((s, x) => s + x.pct, 0) / list.length) : 0;
    app.innerHTML = `${topbar(L('Мои результаты', 'My results'))}<div class="page"><div class="wrap">
      ${list.length ? `<div class="result"><div class="score">${avg}%</div><div class="sub">${L('средний лучший результат · пройдено режимов', 'average best score · modes played')}: ${list.length}</div></div>
      <div class="list">${list.map(x => `<div class="row"><span class="txt"><div>${esc(bestLabel(x))}</div><small>${L('лучшее время', 'best time')} ${fmtTime(x.secs || 0)}</small></span><span class="pill ${x.pct >= 90 ? 'good' : x.pct >= 60 ? 'mid' : 'low'}">${x.pct}%</span></div>`).join('')}</div>
      <div style="margin-top:16px">${confirmReset
        ? `<p class="note">${L('Удалить все результаты на этом устройстве?', 'Delete all results on this device?')}</p><div class="btnrow"><button class="btn ghost" id="no">${L('Отмена', 'Cancel')}</button><button class="btn danger" id="yes">${L('Удалить', 'Delete')}</button></div>`
        : `<button class="btn ghost" id="reset" style="width:100%">${L('Сбросить результаты', 'Reset results')}</button>`}</div>`
      : `<div class="info-card" style="margin-top:16px"><p>${L('Пока пусто. Пройдите любой режим — лучший результат появится здесь.', 'Nothing here yet. Play any mode and your best score will appear here.')}</p><p class="members">${L('Результаты хранятся только в этом браузере.', 'Results are stored only in this browser.')}</p></div>`}
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
