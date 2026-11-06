// Философия — подготовка к экзамену: конспекты, карточки, тренировки, экзамен.
(function () {
'use strict';

// ===================== Данные =====================
const TOPICS = PH_TOPICS.slice().sort((a, b) => a.n - b.n);
const BYN = {}; TOPICS.forEach(t => { BYN[t.n] = t; });
const ERAS = [
  { id: 'intro', name: 'Введение и Древний Восток', short: 'Восток' },
  { id: 'ant', name: 'Античность', short: 'Античность' },
  { id: 'med', name: 'Средние века', short: 'Средние века' },
  { id: 'ren', name: 'Возрождение и Реформация', short: 'Возрождение' },
  { id: 'new', name: 'Новое время и Просвещение', short: 'Новое время' },
  { id: 'ger', name: 'Немецкая классика и XIX век', short: 'XIX век' },
  { id: 'xx', name: 'XX век и современность', short: 'XX век' },
];
const ERA = {}; ERAS.forEach(e => { ERA[e.id] = e; });
const PEOPLE = PH_PEOPLE.map(([name, years, y, era, topics, idea, works, quotes]) => ({ name, years, y, era, topics, idea, works, quotes }));
const TERMS = [];
TOPICS.forEach(t => t.terms.forEach(([term, def], i) => TERMS.push({ id: `${t.n}:${i}`, n: t.n, era: t.era, term, def })));
const QUESTIONS = [];
TOPICS.forEach(t => t.quiz.forEach(([q, a, w, e], i) => QUESTIONS.push({ id: `${t.n}:${i}`, n: t.n, era: t.era, q, a, w, e })));

// ===================== Утилиты =====================
const app = document.getElementById('app');
const $ = (s, r = app) => r.querySelector(s);
const $$ = (s, r = app) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.random() * a.length | 0];
const plural = (n, one, few, many) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many); };
const nW = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem('philo:' + k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('philo:' + k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ } },
};
const S = {
  read: store.get('read', {}),       // n → время прочтения
  test: store.get('test', {}),       // n → лучший % теста по билету
  cards: store.get('cards', {}),     // id → 1 (знаю) / 0 (повторить)
  self: store.get('self', {}),       // n → good / part / bad (самооценка билета)
  wrong: store.get('wrong', {}),     // id вопроса → 1
  best: store.get('best', {}),       // режим → {pct, label, at}
  last: store.get('last', 0),        // последний открытый билет
};
const save = k => store.set(k, S[k]);
function saveBest(id, pct, label) {
  const b = S.best[id];
  if (!b || pct >= b.pct) S.best[id] = { pct, label, at: Date.now() };
  save('best');
}
const buzz = () => {
  try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* нет вибрации */ }
  const el = $('.qcard');
  if (el && !REDUCED) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
};
function countUp(el, to, suffix = '') {
  if (!el) return;
  if (REDUCED) { el.textContent = to + suffix; return; }
  const t0 = performance.now(), dur = 800;
  const step = t => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suffix; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ===================== Иконки =====================
const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  book: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5-.7 1.5-1.5z"/>',
  cards: '<rect x="3.5" y="6" width="12" height="14" rx="2"/><path d="M8 3.5h10.5A2 2 0 0 1 20.5 5.5V17"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  seal: '<path d="M6 3.5h12v17l-6-3.5-6 3.5z"/><path d="M9 9h6M9 12.5h4"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>',
  bust: '<circle cx="12" cy="8" r="4"/><path d="M5 20.5c.6-4 3.4-6.5 7-6.5s6.4 2.5 7 6.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.8 2.6 14.2 0 17M12 3.5c-2.6 2.8-2.6 14.2 0 17"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  quote: '<path d="M10 8H6.5A1.5 1.5 0 0 0 5 9.5V13h5V8zM10 13c0 2.5-1.5 4-4 4.5M19 8h-3.5A1.5 1.5 0 0 0 14 9.5V13h5V8zM19 13c0 2.5-1.5 4-4 4.5"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M7 4a2 2 0 0 0-2 2v11"/><path d="M9 9h4M9 12.5h4"/>',
  idea: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3 10.1V15.5h6v-1.9a5.5 5.5 0 0 0-3-10.1z"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
// меандр — греческий орнамент
const MEANDER = `<svg class="meander" aria-hidden="true" width="100%" height="12"><defs><pattern id="mq" width="24" height="12" patternUnits="userSpaceOnUse"><path d="M0 11h18V1H6v6h6V4" fill="none" stroke="currentColor" stroke-width="1.4"/></pattern></defs><rect width="240" height="12" fill="url(#mq)"/></svg>`;

// ===================== Разметка конспекта =====================
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
function planOf(t) { return t.text.split('\n').filter(l => l.startsWith('## ')).map(l => l.slice(3)); }
function rememberOf(t) { const l = t.text.split('\n').find(x => x.startsWith('! ')); return l ? l.slice(2) : ''; }
function renderText(t) {
  let html = '', inList = false, h = 0;
  const close = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of t.text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const li = line.match(/^(\s*)(-|\d+\.) (.*)$/);
    if (li) {
      if (!inList) { html += '<ul>'; inList = true; }
      const sub = li[1].length > 0, num = li[2] !== '-' ? li[2].slice(0, -1) : '';
      html += `<li class="${sub ? 'sub' : ''}${num ? ' num' : ''}"${num ? ` data-n="${num}"` : ''}>${inline(li[3])}</li>`;
      continue;
    }
    close();
    if (!line.trim()) continue;
    if (line.startsWith('## ')) { h++; html += `<h3 id="s${h}"><span class="sn">${h}</span>${inline(line.slice(3))}</h3>`; }
    else if (line.startsWith('> ')) html += `<blockquote>${inline(line.slice(2))}</blockquote>`;
    else if (line.startsWith('! ')) html += `<aside class="remember"><span class="lbl">Запомнить</span>${inline(line.slice(2))}</aside>`;
    else html += `<p>${inline(line)}</p>`;
  }
  close();
  return html;
}

// ===================== Навигация =====================
let cleanup = null, pending = null, lastPath = null;
const scrollMem = {};
const depth = () => (history.state && history.state.d) || 1;
try { history.replaceState({ d: depth() }, '', location.hash || '#/'); } catch (e) { /* file:// и др. */ }
function path() { return location.hash.replace(/^#\/?/, ''); }
function go(p) { scrollMem[path()] = window.scrollY; try { history.pushState({ d: depth() + 1 }, '', '#/' + p); } catch (e) { location.hash = '#/' + p; return; } render('fwd'); }
function replaceTo(p) { try { history.replaceState({ d: depth() }, '', '#/' + p); } catch (e) { location.hash = '#/' + p; return; } render('swap'); }
function back(parent = '') { if (depth() > 1) history.back(); else replaceTo(parent); }
function play(fn, cfg, parent) { pending = { fn, cfg, parent }; if (path() === 'play') render('swap'); else go('play'); }
window.addEventListener('popstate', () => render('back'));

function render(nav = 'swap') {
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  const p = path(), [name, arg] = p.split('/');
  const views = { '': Home, tickets: Tickets, t: Topic, cards: CardsMenu, drill: DrillMenu, exam: ExamMenu, draw: Draw, people: People, progress: Progress };
  app.className = 'enter-' + (REDUCED ? 'none' : nav);
  let r;
  if (name === 'play') {
    if (!pending) { replaceTo(''); return; }
    r = pending.fn(pending.cfg, pending.parent);
  } else {
    const v = views[name] || Home;
    r = v(arg);
  }
  cleanup = typeof r === 'function' ? r : null;
  const y = nav === 'back' && scrollMem[p] ? scrollMem[p] : 0;
  window.scrollTo(0, y);
  lastPath = p;
  void app.offsetWidth;
  app.classList.add('in');
}
function topbar(title, parent = '', extra = '') {
  return `<header class="topbar"><button class="back" aria-label="Назад">${icon('back')}</button><div class="tb-title">${esc(title)}</div><div class="tb-extra">${extra}</div></header>`;
}
function bindBack(parent = '') { const b = $('.topbar .back'); if (b) b.onclick = () => back(parent); }
function bindLinks(root = app) { $$('[data-go]', root).forEach(el => { el.addEventListener('click', e => { e.preventDefault(); go(el.dataset.go); }); }); }

// ===================== Общие блоки =====================
const eraTag = (id, cls = '') => `<span class="era-tag ${cls}" data-era="${id}">${esc(ERA[id].short)}</span>`;
function chipsRow(items, isOn, attr) {
  return `<div class="chips">${items.map(([v, label]) => `<button class="chip ${isOn(v) ? 'on' : ''}" ${attr}="${v}" aria-pressed="${isOn(v)}">${label}</button>`).join('')}</div>`;
}
function eraPicker(sel) {
  return `<div class="chips era-chips">${ERAS.map(e => `<button class="chip era ${sel.has(e.id) ? 'on' : ''}" data-era-pick="${e.id}" data-era="${e.id}" aria-pressed="${sel.has(e.id)}">${esc(e.short)}</button>`).join('')}</div>`;
}
function bindEraPicker(state, rerender) {
  $$('[data-era-pick]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.eraPick, s = new Set(state.eras);
      if (s.has(id)) { if (s.size > 1) s.delete(id); } else s.add(id);
      state.eras = ERAS.map(e => e.id).filter(x => s.has(x));
      rerender();
    };
  });
}
const allEras = () => ERAS.map(e => e.id);
const stars = pct => { const n = pct >= 95 ? 3 : pct >= 75 ? 2 : pct >= 50 ? 1 : 0; return '★'.repeat(n) + '☆'.repeat(3 - n); };
const verdict = pct => pct >= 90 ? 'Превосходно — вы готовы к экзамену.' : pct >= 75 ? 'Хорошо. Повторите ошибки — и будет отлично.' : pct >= 50 ? 'Неплохо, но стоит перечитать конспекты.' : 'Пока слабо — начните с конспектов и карточек.';

// ===================== Главная =====================
function Home() {
  const read = Object.keys(S.read).length;
  const tests = Object.values(S.test);
  const avg = tests.length ? Math.round(tests.reduce((a, b) => a + b, 0) / tests.length) : 0;
  const known = TERMS.filter(c => S.cards[c.id] === 1).length;
  const good = Object.values(S.self).filter(v => v === 'good').length;
  const wrongN = Object.keys(S.wrong).length;
  const last = S.last && BYN[S.last];
  const R = 44, C = 2 * Math.PI * R, frac = read / TOPICS.length;
  const mode = (to, ic, title, desc, meta) => `<a class="mode" href="#/${to}" data-go="${to}"><span class="m-ico">${icon(ic)}</span><span class="m-txt"><b>${title}</b><small>${desc}</small></span><span class="m-meta">${meta}</span></a>`;
  app.innerHTML = `<div class="page home">
    <section class="hero">
      <div class="hero-top">
        <a class="crumb" href="index.html">${icon('globe')}ГеоТренажёр</a>
        <span class="hero-greek" lang="el">φιλοσοφία</span>
      </div>
      <div class="hero-body">
        <div class="hero-text">
          <p class="kicker">Подготовка к экзамену</p>
          <h1>Философия</h1>
          <p class="hero-lead">Конспекты всех 50 билетов, карточки понятий, тренировки на запоминание и проверка знаний — от Фалеса до философии сознания.</p>
        </div>
        <a class="ring" href="#/progress" data-go="progress" aria-label="Мой прогресс">
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-bg" cx="50" cy="50" r="${R}"/><circle class="ring-fg" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg>
          <span class="ring-num"><b>${read}</b><small>из ${TOPICS.length}<br>изучено</small></span>
        </a>
      </div>
      ${MEANDER}
    </section>
    <div class="wrap">
      ${last ? `<a class="resume" href="#/t/${last.n}" data-go="t/${last.n}"><span class="r-lbl">Продолжить</span><span class="r-num">№${last.n}</span><span class="r-title">${esc(last.title)}</span>${icon('chev')}</a>` : ''}
      <h2 class="sec">Изучить</h2>
      <div class="modes">
        ${mode('tickets', 'book', 'Конспекты билетов', 'План ответа, главное, понятия и персоналии по каждому билету', `${read}/${TOPICS.length} прочитано`)}
        ${mode('cards', 'cards', 'Карточки понятий', 'Термин на лицевой стороне, определение — на обороте', `${known}/${TERMS.length} выучено`)}
        ${mode('people', 'bust', 'Персоналии и хронология', 'Философы на линии времени: годы, идеи, труды, цитаты', nW(PEOPLE.length, 'мыслитель', 'мыслителя', 'мыслителей'))}
      </div>
      <h2 class="sec">Запомнить</h2>
      <div class="modes">
        ${mode('drill', 'target', 'Тренировки', '«Чей это труд?», «Кто это сказал?», «Чья идея?», хронология, термины', '5 упражнений')}
      </div>
      <h2 class="sec">Проверить себя</h2>
      <div class="modes">
        ${mode('exam', 'seal', 'Экзаменационный тест', 'Вопросы по выбранным эпохам с разбором ошибок', `${QUESTIONS.length} вопросов${avg ? ` · средний ${avg}%` : ''}`)}
        ${mode('draw', 'dice', 'Билет наугад', 'Вспомните план ответа, затем сверьтесь и оцените себя', good ? `«знаю» — ${good}/${TOPICS.length}` : 'как на экзамене')}
      </div>
      ${wrongN ? `<button class="btn ghost wide" id="mistakes">${icon('repeat')}Работа над ошибками · ${nW(wrongN, 'вопрос', 'вопроса', 'вопросов')}</button>` : ''}
      <p class="foot">Прогресс сохраняется только в этом браузере. <a href="#/progress" data-go="progress">Мой прогресс</a></p>
    </div>
  </div>`;
  bindLinks();
  const m = $('#mistakes');
  if (m) m.onclick = () => startMistakes('');
  if (!REDUCED) { const fg = $('.ring-fg'); if (fg) { fg.style.strokeDashoffset = C; requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = C * (1 - frac); })); } }
}

// ===================== Список билетов =====================
const listState = { q: '', era: 'all' };
function Tickets() {
  const render = () => {
    const q = listState.q.trim().toLowerCase();
    const match = t => (listState.era === 'all' || t.era === listState.era) && (!q || String(t.n) === q || t.title.toLowerCase().includes(q) || t.lead.toLowerCase().includes(q));
    const groups = ERAS.map(e => ({ e, items: TOPICS.filter(t => t.era === e.id && match(t)) })).filter(g => g.items.length);
    const row = t => {
      const pct = S.test[t.n], self = S.self[t.n];
      return `<a class="trow" href="#/t/${t.n}" data-go="t/${t.n}" data-era="${t.era}">
        <span class="t-num">${t.n}</span>
        <span class="t-txt"><span class="t-title">${esc(t.title)}</span></span>
        <span class="t-st">${S.read[t.n] ? `<span class="st-read" title="Прочитано">${icon('check')}</span>` : ''}${pct != null ? `<span class="st-pct ${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'}" title="Лучший тест">${pct}%</span>` : ''}${self ? `<span class="st-self ${self}" title="Самооценка"></span>` : ''}</span>
      </a>`;
    };
    $('#tl').innerHTML = groups.length ? groups.map(g => `<section class="tgroup" data-era="${g.e.id}"><h2 class="era-h"><span>${esc(g.e.name)}</span><small>${g.items[0].n}–${g.items[g.items.length - 1].n}</small></h2>${g.items.map(row).join('')}</section>`).join('') : '<p class="empty">Ничего не найдено.</p>';
    bindLinks($('#tl'));
    $$('[data-ef]').forEach(b => { const on = b.dataset.ef === listState.era; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  };
  app.innerHTML = `${topbar('Билеты')}<div class="page"><div class="wrap">
    <label class="search">${icon('search')}<input type="search" id="q" placeholder="Номер или слово: Кант, атом, счастье…" value="${esc(listState.q)}" autocomplete="off"></label>
    <div class="chips scroll-x">${[['all', 'Все']].concat(ERAS.map(e => [e.id, e.short])).map(([v, l]) => `<button class="chip ${v !== 'all' ? 'era' : ''}" data-ef="${v}" ${v !== 'all' ? `data-era="${v}"` : ''}>${esc(l)}</button>`).join('')}</div>
    <div class="legend"><span>${icon('check')} прочитан</span><span><i class="st-pct good">%</i> лучший тест</span><span><i class="st-self good"></i> самооценка</span></div>
    <div id="tl"></div>
  </div></div>`;
  bindBack();
  $('#q').oninput = e => { listState.q = e.target.value; render(); };
  $$('[data-ef]').forEach(b => { b.onclick = () => { listState.era = b.dataset.ef; render(); }; });
  render();
}

// ===================== Билет (конспект) =====================
function Topic(arg) {
  const t = BYN[+arg];
  if (!t) { replaceTo('tickets'); return; }
  S.last = t.n; save('last');
  const plan = planOf(t);
  const people = PEOPLE.filter(p => p.topics.includes(t.n)).sort((a, b) => a.y - b.y);
  const prev = BYN[t.n - 1], next = BYN[t.n + 1];
  const read = !!S.read[t.n];
  const pct = S.test[t.n];
  app.innerHTML = `${topbar(`Билет ${t.n}`, 'tickets', `<span class="tb-of">${t.n}/${TOPICS.length}</span>`)}<div class="page topic" data-era="${t.era}"><div class="wrap">
    <header class="t-head">
      <div class="t-meta">${eraTag(t.era)}<span class="t-no">Билет № ${t.n}</span></div>
      <h1>${esc(t.title)}</h1>
      <p class="t-lead">${esc(t.lead)}</p>
    </header>
    <nav class="plan" aria-label="План ответа"><div class="plan-h">План ответа</div><ol>${plan.map((h, i) => `<li><a href="#s${i + 1}" data-anchor="s${i + 1}">${inline(h)}</a></li>`).join('')}</ol></nav>
    <article class="prose">${renderText(t)}</article>
    <section class="block"><h2 class="sec">Ключевые понятия</h2><dl class="terms">${t.terms.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></section>
    ${people.length ? `<section class="block"><h2 class="sec">Персоналии</h2><div class="plist">${people.map(p => `<div class="pcard"><div class="p-name">${esc(p.name)}</div><div class="p-years">${esc(p.years)}</div><div class="p-idea">${esc(p.idea)}</div>${p.works.length ? `<div class="p-works">${p.works.map(esc).join(' · ')}</div>` : ''}</div>`).join('')}</div></section>` : ''}
    <section class="actions">
      <button class="btn" id="test">${icon('seal')}Проверить себя · ${nW(t.quiz.length, 'вопрос', 'вопроса', 'вопросов')}${pct != null ? ` <span class="badge">${pct}%</span>` : ''}</button>
      <div class="btnrow">
        <button class="btn ghost" id="cards">${icon('cards')}Карточки</button>
        <button class="btn ghost ${read ? 'done' : ''}" id="mark" aria-pressed="${read}">${icon('check')}${read ? 'Изучен' : 'Отметить изученным'}</button>
      </div>
    </section>
    <nav class="pn">
      ${prev ? `<a href="#/t/${prev.n}" class="pn-prev" data-swap="${prev.n}"><small>← Билет ${prev.n}</small><span>${esc(prev.title)}</span></a>` : '<span></span>'}
      ${next ? `<a href="#/t/${next.n}" class="pn-next" data-swap="${next.n}"><small>Билет ${next.n} →</small><span>${esc(next.title)}</span></a>` : '<span></span>'}
    </nav>
  </div></div>`;
  bindBack('tickets');
  $$('[data-anchor]').forEach(a => { a.onclick = e => { e.preventDefault(); const el = document.getElementById(a.dataset.anchor); if (el) el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }; });
  $$('[data-swap]').forEach(a => { a.onclick = e => { e.preventDefault(); replaceTo('t/' + a.dataset.swap); }; });
  $('#mark').onclick = () => {
    if (S.read[t.n]) delete S.read[t.n]; else S.read[t.n] = Date.now();
    save('read');
    const on = !!S.read[t.n], b = $('#mark');
    b.classList.toggle('done', on); b.setAttribute('aria-pressed', on);
    b.innerHTML = `${icon('check')}${on ? 'Изучен' : 'Отметить изученным'}`;
  };
  $('#test').onclick = () => play(playQuiz, {
    title: `Билет ${t.n}`, id: 'topic:' + t.n, label: `Тест по билету ${t.n}`,
    qs: shuffle(QUESTIONS.filter(q => q.n === t.n)).map(toQ),
    onDone: p => { if (S.test[t.n] == null || p > S.test[t.n]) { S.test[t.n] = p; save('test'); } if (p >= 80 && !S.read[t.n]) { S.read[t.n] = Date.now(); save('read'); } },
  }, 't/' + t.n);
  $('#cards').onclick = () => play(playCards, { deck: shuffle(TERMS.filter(c => c.n === t.n)), title: `Карточки · билет ${t.n}` }, 't/' + t.n);
  // отметка «прочитан», когда пролистали до конца
  const onScroll = () => {
    if (S.read[t.n]) return;
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 160) {
      S.read[t.n] = Date.now(); save('read');
      const b = $('#mark'); if (b) { b.classList.add('done'); b.setAttribute('aria-pressed', 'true'); b.innerHTML = `${icon('check')}Изучен`; }
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

// ===================== Тест (общий движок) =====================
const toQ = q => ({ id: q.id, n: q.n, q: q.q, a: q.a, w: q.w, e: q.e, tag: `Билет ${q.n}` });
function markWrong(id, ok) {
  if (!id || !/^\d+:\d+$/.test(id)) return;
  if (ok) delete S.wrong[id]; else S.wrong[id] = 1;
  save('wrong');
}
// cfg: {title, qs:[{id, q, a, w, e, tag}], id, label, onDone}
function playQuiz(cfg, parent) {
  const qs = cfg.qs;
  let i = 0, right = 0;
  const log = [];
  app.innerHTML = `${topbar(cfg.title, parent, '<span class="tb-prog"></span>')}<div class="progress"><div></div></div><div class="page"><div class="wrap narrow" id="qw"></div></div>`;
  bindBack(parent);
  const qw = $('#qw');
  function ask() {
    if (i >= qs.length) return finish();
    const q = qs[i];
    const opts = shuffle([q.a, ...q.w]);
    $('.tb-prog').textContent = `${i + 1} / ${qs.length}`;
    $('.progress>div').style.width = (i / qs.length * 100) + '%';
    qw.innerHTML = `<div class="qcard">
      ${q.tag ? `<div class="q-tag">${esc(q.tag)}</div>` : ''}
      <h2 class="q-text">${q.html || esc(q.q)}</h2>
      <div class="opts">${opts.map((o, k) => `<button class="opt" data-k="${k}"><span class="o-key">${k + 1}</span><span class="o-txt">${esc(o)}</span></button>`).join('')}</div>
      <div id="after"></div></div>`;
    $$('.opt', qw).forEach(b => { b.onclick = () => answer(b, q, opts); });
    window.scrollTo(0, 0);
  }
  function answer(btn, q, opts) {
    const given = opts[+btn.dataset.k], ok = given === q.a;
    $$('.opt', qw).forEach(b => { b.disabled = true; if (opts[+b.dataset.k] === q.a) b.classList.add('right'); });
    if (ok) right++; else { btn.classList.add('wrong'); buzz(); }
    markWrong(q.id, ok);
    log.push({ q, ok, given });
    $('#after').innerHTML = `<div class="explain ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Верно.' : 'Неверно.'}</b> ${ok ? '' : `Правильный ответ: <b>${esc(q.a)}</b>. `}${esc(q.e || '')}</div>
      <button class="btn wide" id="next">${i + 1 < qs.length ? 'Дальше' : 'Результат'}</button>`;
    $('#next').onclick = () => { i++; ask(); };
    $('#next').focus({ preventScroll: true });
    $('#next').scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
  }
  function finish() {
    const pct = qs.length ? Math.round(right / qs.length * 100) : 0;
    $('.progress>div').style.width = '100%';
    $('.tb-prog').textContent = '';
    if (cfg.id) saveBest(cfg.id, pct, cfg.label || cfg.title);
    if (cfg.onDone) cfg.onDone(pct, log);
    const wrong = log.filter(l => !l.ok);
    // разбивка по эпохам, если вопросы из разных билетов
    const byEra = {};
    log.forEach(l => { const e = l.q.n && BYN[l.q.n] ? BYN[l.q.n].era : null; if (!e) return; byEra[e] = byEra[e] || [0, 0]; byEra[e][1]++; if (l.ok) byEra[e][0]++; });
    const eraKeys = Object.keys(byEra);
    qw.innerHTML = `<div class="result"><div class="r-score">${pct}%</div><div class="r-stars" aria-label="${stars(pct)}">${stars(pct)}</div><div class="r-sub">Верно ${right} из ${qs.length}</div><p class="r-verdict">${verdict(pct)}</p></div>
      ${eraKeys.length > 1 ? `<div class="breakdown">${ERAS.filter(e => byEra[e.id]).map(e => { const [a, b] = byEra[e.id], p = Math.round(a / b * 100); return `<div class="bd-row" data-era="${e.id}"><span>${esc(e.short)}</span><span class="bd-bar"><i style="width:${p}%"></i></span><b>${a}/${b}</b></div>`; }).join('')}</div>` : ''}
      <div class="btnrow">
        <button class="btn ghost" id="menu">Готово</button>
        ${wrong.length ? `<button class="btn ghost" id="rw">Только ошибки</button>` : ''}
        <button class="btn" id="again">Ещё раз</button>
      </div>
      ${wrong.length ? `<h2 class="sec">Разбор ошибок</h2>${wrong.map(l => `<div class="review">${l.q.tag ? `<div class="q-tag">${esc(l.q.tag)}</div>` : ''}<p class="rv-q">${l.q.html || esc(l.q.q)}</p><p class="rv-bad">Ваш ответ: ${esc(l.given)}</p><p class="rv-ok">Верно: ${esc(l.q.a)}</p>${l.q.e ? `<p class="rv-e">${esc(l.q.e)}</p>` : ''}${l.q.n ? `<a class="rv-link" href="#/t/${l.q.n}" data-go="t/${l.q.n}">Открыть конспект билета ${l.q.n} →</a>` : ''}</div>`).join('')}` : '<p class="empty">Без ошибок!</p>'}`;
    countUp($('.r-score', qw), pct, '%');
    bindLinks(qw);
    $('#menu').onclick = () => back(parent);
    $('#again').onclick = () => play(playQuiz, Object.assign({}, cfg, { qs: shuffle(qs) }), parent);
    if (wrong.length) $('#rw').onclick = () => play(playQuiz, Object.assign({}, cfg, { qs: shuffle(wrong.map(l => l.q)), id: null, title: 'Работа над ошибками' }), parent);
    window.scrollTo(0, 0);
  }
  const onKey = e => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const n = parseInt(e.key, 10), opts = $$('.opts .opt', qw);
    if (n >= 1 && n <= opts.length && !opts[0].disabled) { e.preventDefault(); opts[n - 1].click(); }
    else if (e.key === 'Enter' && $('#next') && document.activeElement !== $('#next')) { e.preventDefault(); $('#next').click(); }
  };
  document.addEventListener('keydown', onKey);
  ask();
  return () => document.removeEventListener('keydown', onKey);
}
function startMistakes(parent) {
  const ids = Object.keys(S.wrong);
  const qs = shuffle(QUESTIONS.filter(q => ids.includes(q.id))).map(toQ);
  if (!qs.length) return;
  play(playQuiz, { title: 'Работа над ошибками', qs, id: null }, parent);
}

// ===================== Экзамен =====================
const examState = store.get('examState', { eras: allEras(), count: 20 });
function ExamMenu() {
  const render = () => {
    const sel = new Set(examState.eras);
    const pool = QUESTIONS.filter(q => sel.has(q.era));
    const n = examState.count ? Math.min(examState.count, pool.length) : pool.length;
    const key = 'exam:' + (examState.eras.length === ERAS.length ? 'all' : examState.eras.join('+')) + ':' + (examState.count || 'all');
    const b = S.best[key];
    const wrongN = Object.keys(S.wrong).length;
    app.innerHTML = `${topbar('Экзаменационный тест')}<div class="page"><div class="wrap narrow">
      <div class="note-card"><p>Вопросы из всех билетов выбранных эпох, с четырьмя вариантами ответа и пояснением. В конце — результат по эпохам и разбор ошибок со ссылками на конспекты.</p></div>
      <h2 class="sec">Эпохи</h2>
      ${eraPicker(sel)}
      <div class="chips"><button class="chip" id="all">Все эпохи</button></div>
      <h2 class="sec">Количество вопросов</h2>
      ${chipsRow([[10, '10'], [20, '20'], [40, '40'], [0, `Все (${pool.length})`]], v => v === examState.count, 'data-c')}
      ${b ? `<p class="best">Лучший результат в этом наборе: <b>${b.pct}%</b></p>` : ''}
      <div class="sticky-cta"><button class="btn wide" id="go">Начать · ${nW(n, 'вопрос', 'вопроса', 'вопросов')}</button></div>
      ${wrongN ? `<button class="btn ghost wide" id="mist">${icon('repeat')}Работа над ошибками · ${wrongN}</button>` : ''}
    </div></div>`;
    bindBack();
    const persist = () => store.set('examState', examState);
    bindEraPicker(examState, () => { persist(); render(); });
    $('#all').onclick = () => { examState.eras = allEras(); persist(); render(); };
    $$('[data-c]').forEach(x => { x.onclick = () => { examState.count = +x.dataset.c; persist(); render(); }; });
    $('#go').onclick = () => {
      const qs = shuffle(pool).slice(0, n).map(toQ);
      play(playQuiz, { title: 'Экзамен', qs, id: key, label: `Экзамен: ${examState.eras.length === ERAS.length ? 'все эпохи' : examState.eras.map(e => ERA[e].short).join(', ')}, ${n} вопр.` }, 'exam');
    };
    const m = $('#mist'); if (m) m.onclick = () => startMistakes('exam');
  };
  render();
}

// ===================== Билет наугад =====================
const drawState = { skipKnown: true, seen: [] };
function Draw() {
  const choose = () => {
    let pool = TOPICS.filter(t => !drawState.seen.includes(t.n));
    if (drawState.skipKnown) pool = pool.filter(t => S.self[t.n] !== 'good');
    if (!pool.length) { drawState.seen = []; pool = TOPICS.filter(t => !drawState.skipKnown || S.self[t.n] !== 'good'); }
    if (!pool.length) pool = TOPICS;
    // сначала те, что оценены как «не знаю», затем без оценки
    const weight = t => S.self[t.n] === 'bad' ? 3 : !S.self[t.n] ? 2 : 1;
    const bag = []; pool.forEach(t => { for (let k = 0; k < weight(t); k++) bag.push(t); });
    return pick(bag);
  };
  let t = choose(), shown = false;
  const counts = () => { const v = Object.values(S.self); return { good: v.filter(x => x === 'good').length, part: v.filter(x => x === 'part').length, bad: v.filter(x => x === 'bad').length }; };
  const render = () => {
    const c = counts();
    app.innerHTML = `${topbar('Билет наугад')}<div class="page"><div class="wrap narrow">
      <div class="selfbar"><span class="good">знаю ${c.good}</span><span class="part">частично ${c.part}</span><span class="bad">не знаю ${c.bad}</span><span class="rest">без оценки ${TOPICS.length - c.good - c.part - c.bad}</span></div>
      <div class="ticket" data-era="${t.era}">
        <div class="tk-head"><span>Экзаменационный билет</span><span class="tk-no">№ ${t.n}</span></div>
        <h1 class="tk-title">${esc(t.title)}</h1>
        <div class="tk-foot">${eraTag(t.era)}<span>${esc(ERA[t.era].name)}</span></div>
      </div>
      ${shown ? `<div class="reveal">
        <h2 class="sec">План ответа</h2>
        <ol class="plan-list">${planOf(t).map(h => `<li>${inline(h)}</li>`).join('')}</ol>
        ${rememberOf(t) ? `<aside class="remember"><span class="lbl">Главное</span>${inline(rememberOf(t))}</aside>` : ''}
        <h2 class="sec">Понятия</h2>
        <dl class="terms compact">${t.terms.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
        <a class="rv-link" href="#/t/${t.n}" data-go="t/${t.n}">Открыть полный конспект →</a>
        <h2 class="sec">Как вы ответили бы?</h2>
        <div class="self3"><button class="s-bad" data-s="bad">Не знаю</button><button class="s-part" data-s="part">Частично</button><button class="s-good" data-s="good">Знаю</button></div>
      </div>` : `<p class="hint">Вспомните план ответа: основные идеи, представителей, понятия. Можно проговорить вслух — потом откройте подсказку и сравните.</p>
      <button class="btn wide" id="show">Показать план ответа</button>`}
      <div class="draw-opts"><label class="tgl"><input type="checkbox" id="skip" ${drawState.skipKnown ? 'checked' : ''}><span>Пропускать билеты, отмеченные «знаю»</span></label>
      <button class="btn ghost small" id="other">${icon('dice')}Другой билет</button></div>
    </div></div>`;
    bindBack(); bindLinks();
    const sh = $('#show'); if (sh) sh.onclick = () => { shown = true; render(); const r = $('.reveal'); if (r) r.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); };
    $$('[data-s]').forEach(b => { b.onclick = () => { S.self[t.n] = b.dataset.s; save('self'); nextT(); }; });
    $('#other').onclick = nextT;
    $('#skip').onchange = e => { drawState.skipKnown = e.target.checked; };
  };
  const nextT = () => { drawState.seen.push(t.n); t = choose(); shown = false; render(); window.scrollTo(0, 0); };
  render();
}

// ===================== Карточки =====================
const cardsState = store.get('cardsState', { eras: allEras(), onlyNew: false });
function CardsMenu() {
  const render = () => {
    const sel = new Set(cardsState.eras);
    const inScope = TERMS.filter(c => sel.has(c.era));
    const deck = inScope.filter(c => !cardsState.onlyNew || S.cards[c.id] !== 1);
    const known = inScope.filter(c => S.cards[c.id] === 1).length;
    app.innerHTML = `${topbar('Карточки понятий')}<div class="page"><div class="wrap narrow">
      <div class="note-card"><p>На лицевой стороне — понятие. Вспомните определение, нажмите на карточку, чтобы перевернуть, и честно отметьте: «знаю» или «повторить». Карточки «повторить» вернутся через несколько шагов.</p></div>
      <h2 class="sec">Эпохи</h2>
      ${eraPicker(sel)}
      <div class="chips"><button class="chip" id="all">Все эпохи</button></div>
      <h2 class="sec">Какие карточки</h2>
      ${chipsRow([[0, `Все (${inScope.length})`], [1, `Только невыученные (${inScope.length - known})`]], v => (v === 1) === cardsState.onlyNew, 'data-o')}
      <div class="meter"><span>Выучено в выбранных эпохах</span><b>${known} / ${inScope.length}</b><span class="m-bar"><i style="width:${inScope.length ? known / inScope.length * 100 : 0}%"></i></span></div>
      <div class="sticky-cta"><button class="btn wide" id="go" ${deck.length ? '' : 'disabled'}>${deck.length ? `Начать · ${nW(deck.length, 'карточка', 'карточки', 'карточек')}` : 'Все карточки выучены'}</button></div>
      ${known ? '<button class="btn ghost wide" id="reset">Сбросить отметки «знаю» в выбранных эпохах</button>' : ''}
    </div></div>`;
    bindBack();
    const persist = () => store.set('cardsState', cardsState);
    bindEraPicker(cardsState, () => { persist(); render(); });
    $('#all').onclick = () => { cardsState.eras = allEras(); persist(); render(); };
    $$('[data-o]').forEach(b => { b.onclick = () => { cardsState.onlyNew = b.dataset.o === '1'; persist(); render(); }; });
    $('#go').onclick = () => play(playCards, { deck: shuffle(deck), title: 'Карточки' }, 'cards');
    const r = $('#reset'); if (r) r.onclick = () => { inScope.forEach(c => { delete S.cards[c.id]; }); save('cards'); render(); };
  };
  render();
}
function playCards({ deck, title }, parent) {
  const queue = deck.slice();
  let cur = null, flipped = false, knew = 0, again = 0;
  const total = deck.length;
  app.innerHTML = `${topbar(title, parent, '<span class="tb-prog"></span>')}<div class="progress"><div></div></div><div class="page"><div class="wrap narrow" id="cw"></div></div>`;
  bindBack(parent);
  const cw = $('#cw');
  const done = () => total - queue.length - (cur ? 1 : 0);
  function next() {
    cur = queue.shift();
    if (!cur) return finish();
    flipped = false;
    const t = BYN[cur.n];
    $('.tb-prog').textContent = `осталось ${queue.length + 1}`;
    $('.progress>div').style.width = (done() / total * 100) + '%';
    cw.innerHTML = `<div class="flash" data-era="${cur.era}" tabindex="0" role="button" aria-label="Перевернуть карточку">
        <div class="f-inner">
          <div class="f-face f-front"><div class="f-tag">${eraTag(cur.era)}<span>Билет ${cur.n}</span></div><div class="f-term">${esc(cur.term)}</div><div class="f-hint">нажмите, чтобы перевернуть</div></div>
          <div class="f-face f-back"><div class="f-tag"><span>${esc(cur.term)}</span></div><div class="f-def">${esc(cur.def)}</div><div class="f-src">Билет ${cur.n} · ${esc(t.title)}</div></div>
        </div>
      </div>
      <div class="f-btns"><button class="btn ghost" id="again" disabled>${icon('repeat')}Повторить</button><button class="btn" id="know" disabled>${icon('check')}Знаю</button></div>
      <p class="kbd-hint">Пробел — перевернуть · 1 — повторить · 2 — знаю</p>`;
    const f = $('.flash', cw);
    f.onclick = flip;
    f.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); flip(); } };
    $('#again').onclick = () => rate(false);
    $('#know').onclick = () => rate(true);
  }
  function flip() {
    flipped = !flipped;
    $('.flash', cw).classList.toggle('flipped', flipped);
    $('#again').disabled = false; $('#know').disabled = false;
  }
  function rate(ok) {
    if (!flipped) return;
    if (ok) { S.cards[cur.id] = 1; knew++; }
    else { S.cards[cur.id] = 0; again++; queue.splice(Math.min(3, queue.length), 0, cur); }
    save('cards');
    cur = null;
    next();
  }
  function finish() {
    $('.progress>div').style.width = '100%';
    $('.tb-prog').textContent = '';
    cw.innerHTML = `<div class="result"><div class="r-score">${total}</div><div class="r-sub">${plural(total, 'карточка пройдена', 'карточки пройдены', 'карточек пройдено')}</div><p class="r-verdict">${again ? `Повторов: ${again}. Вернитесь к карточкам завтра — интервальное повторение лучше всего закрепляет память.` : 'Все карточки с первого раза — отлично!'}</p></div>
      <div class="btnrow"><button class="btn ghost" id="menu">Готово</button><button class="btn" id="again2">Пройти ещё раз</button></div>`;
    $('#menu').onclick = () => back(parent);
    $('#again2').onclick = () => play(playCards, { deck: shuffle(deck), title }, parent);
  }
  const onKey = e => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === ' ' && $('.flash')) { e.preventDefault(); flip(); }
    else if (e.key === '1' && flipped) rate(false);
    else if (e.key === '2' && flipped) rate(true);
  };
  document.addEventListener('keydown', onKey);
  next();
  return () => document.removeEventListener('keydown', onKey);
}

// ===================== Тренировки =====================
const drillState = store.get('drillState', { eras: allEras(), count: 10 });
const stripPar = s => s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
const norm = s => stripPar(s).toLowerCase().replace(/[«»"”“.,!?—–-]/g, '').replace(/\s+/g, ' ').trim();
const DRILLS = [
  { id: 'works', icon: 'book', title: 'Чей это труд?', desc: 'Название произведения → автор', has: p => p.works.length },
  { id: 'quotes', icon: 'quote', title: 'Кто это сказал?', desc: 'Цитата или знаменитый тезис → философ', has: p => p.quotes.length },
  { id: 'ideas', icon: 'idea', title: 'Чья это идея?', desc: 'Главная идея учения → мыслитель', has: () => true },
  { id: 'terms', icon: 'cards', title: 'Узнай понятие', desc: 'Определение → термин', has: null },
  { id: 'chrono', icon: 'clock', title: 'Хронология', desc: 'Расставьте четырёх мыслителей по времени', has: () => true },
];
function distractors(person, pool, conflict) {
  const near = shuffle(pool.filter(p => p.name !== person.name && !conflict(p)))
    .sort((a, b) => Math.abs(a.y - person.y) - Math.abs(b.y - person.y));
  // берём из ближайших по времени, чтобы было не слишком просто
  return shuffle(near.slice(0, 8)).slice(0, 3).map(p => p.name);
}
function buildDrill(kind, eras, count) {
  const sel = new Set(eras);
  const people = PEOPLE.filter(p => sel.has(p.era));
  const peopleAll = people.length >= 6 ? people : PEOPLE;
  const items = [];
  const exp = p => `${p.name} (${p.years}) — ${p.idea}.`;
  if (kind === 'works') {
    people.forEach(p => p.works.forEach(w => items.push({
      id: null, n: p.topics[0], q: `Чей это труд? ${stripPar(w)}`, html: `<span class="q-pre">Чей это труд?</span>${esc(stripPar(w))}`,
      a: p.name, w: distractors(p, peopleAll, o => o.works.some(x => norm(x) === norm(w))), e: exp(p), tag: ERA[p.era].short,
    })));
  } else if (kind === 'quotes') {
    people.forEach(p => p.quotes.forEach(qt => items.push({
      id: null, n: p.topics[0], q: `Кто это сказал? «${qt}»`, html: `<span class="q-pre">Кто это сказал?</span><span class="q-quote">«${esc(qt)}»</span>`,
      a: p.name, w: distractors(p, peopleAll, o => o.quotes.some(x => norm(x) === norm(qt))), e: exp(p), tag: ERA[p.era].short,
    })));
  } else if (kind === 'ideas') {
    people.forEach(p => items.push({
      id: null, n: p.topics[0], q: `Чья это идея? ${p.idea}`, html: `<span class="q-pre">Чья это идея?</span>${esc(p.idea)}`,
      a: p.name, w: distractors(p, peopleAll, o => norm(o.idea) === norm(p.idea)), e: `${p.name} (${p.years}). ${p.works.length ? 'Труды: ' + p.works.map(stripPar).join(', ') + '.' : ''}`, tag: ERA[p.era].short,
    }));
  } else if (kind === 'terms') {
    const terms = TERMS.filter(c => sel.has(c.era));
    const termsAll = terms.length >= 6 ? terms : TERMS;
    terms.forEach(c => {
      const others = shuffle(termsAll.filter(x => x.term !== c.term && norm(x.term) !== norm(c.term)));
      const sameEra = others.filter(x => x.era === c.era);
      const w = (sameEra.length >= 3 ? sameEra : others).slice(0, 3).map(x => x.term);
      items.push({ id: null, n: c.n, q: `Какое понятие определено так: ${c.def}`, html: `<span class="q-pre">Какое понятие так определяется?</span>${esc(c.def)}`, a: c.term, w, e: `Билет ${c.n}: ${BYN[c.n].title}.`, tag: `Билет ${c.n}` });
    });
  }
  return shuffle(items).filter(x => x.w.length === 3).slice(0, count || items.length);
}
function DrillMenu() {
  const render = () => {
    const sel = new Set(drillState.eras);
    const peopleN = PEOPLE.filter(p => sel.has(p.era));
    const avail = d => d.id === 'terms' ? TERMS.filter(c => sel.has(c.era)).length : d.id === 'works' ? peopleN.reduce((s, p) => s + p.works.length, 0) : d.id === 'quotes' ? peopleN.reduce((s, p) => s + p.quotes.length, 0) : d.id === 'chrono' ? (peopleN.length >= 4 ? '∞' : 0) : peopleN.length;
    app.innerHTML = `${topbar('Тренировки')}<div class="page"><div class="wrap narrow">
      <div class="note-card"><p>Короткие упражнения на запоминание имён, трудов, цитат, идей и дат. Варианты ответа подбираются из мыслителей близкого времени — так тренировка честнее.</p></div>
      <h2 class="sec">Эпохи</h2>
      ${eraPicker(sel)}
      <div class="chips"><button class="chip" id="all">Все эпохи</button></div>
      <h2 class="sec">Вопросов в раунде</h2>
      ${chipsRow([[10, '10'], [20, '20'], [0, 'Все']], v => v === drillState.count, 'data-c')}
      <h2 class="sec">Упражнения</h2>
      <div class="modes">${DRILLS.map(d => { const a = avail(d); const b = S.best['drill:' + d.id]; return `<button class="mode" data-d="${d.id}" ${a ? '' : 'disabled'}><span class="m-ico">${icon(d.icon)}</span><span class="m-txt"><b>${d.title}</b><small>${d.desc}</small></span><span class="m-meta">${a === '∞' ? 'раунды' : a + ' шт.'}${b ? ` · лучший ${b.pct}%` : ''}</span></button>`; }).join('')}</div>
    </div></div>`;
    bindBack();
    const persist = () => store.set('drillState', drillState);
    bindEraPicker(drillState, () => { persist(); render(); });
    $('#all').onclick = () => { drillState.eras = allEras(); persist(); render(); };
    $$('[data-c]').forEach(x => { x.onclick = () => { drillState.count = +x.dataset.c; persist(); render(); }; });
    $$('[data-d]').forEach(b => {
      b.onclick = () => {
        const d = DRILLS.find(x => x.id === b.dataset.d);
        if (d.id === 'chrono') return play(playChrono, { eras: drillState.eras, rounds: drillState.count || 15 }, 'drill');
        const qs = buildDrill(d.id, drillState.eras, drillState.count);
        if (qs.length) play(playQuiz, { title: d.title, qs, id: 'drill:' + d.id, label: 'Тренировка: ' + d.title }, 'drill');
      };
    });
  };
  render();
}
// Хронология: нажмите на мыслителей по порядку — от самого раннего
function playChrono({ eras, rounds }, parent) {
  const sel = new Set(eras);
  let pool = PEOPLE.filter(p => sel.has(p.era));
  if (pool.length < 4) pool = PEOPLE;
  const gap = ps => { const ys = ps.map(p => p.y).sort((a, b) => a - b); for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < (ys[i] < 0 ? 25 : 12)) return false; return true; };
  const makeSet = () => { for (let k = 0; k < 200; k++) { const s = shuffle(pool).slice(0, 4); if (gap(s)) return s; } return shuffle(pool).slice(0, 4); };
  let r = 0, score = 0, set = null, order = [];
  app.innerHTML = `${topbar('Хронология', parent, '<span class="tb-prog"></span>')}<div class="progress"><div></div></div><div class="page"><div class="wrap narrow" id="hw"></div></div>`;
  bindBack(parent);
  const hw = $('#hw');
  function round() {
    if (r >= rounds) return finish();
    set = makeSet(); order = [];
    $('.tb-prog').textContent = `${r + 1} / ${rounds}`;
    $('.progress>div').style.width = (r / rounds * 100) + '%';
    draw(false);
  }
  function draw(checked) {
    const sorted = set.slice().sort((a, b) => a.y - b.y);
    hw.innerHTML = `<div class="qcard"><div class="q-tag">Хронология</div><h2 class="q-text">Нажмите на мыслителей по порядку — от самого раннего к самому позднему</h2>
      <div class="chrono">${set.map((p, k) => { const pos = order.indexOf(k); const correct = checked ? sorted.indexOf(p) : -1; const ok = checked && pos === correct; return `<button class="ch-item ${pos >= 0 ? 'picked' : ''} ${checked ? (ok ? 'right' : 'wrong') : ''}" data-k="${k}" ${checked ? 'disabled' : ''}><span class="ch-pos">${pos >= 0 ? pos + 1 : ''}</span><span class="ch-name">${esc(p.name)}</span>${checked ? `<span class="ch-years">${esc(p.years)}</span>` : ''}</button>`; }).join('')}</div>
      <div id="after">${checked ? `<div class="explain ${order.every((k, i) => sorted[i] === set[k]) ? 'ok' : 'bad'}"><b>Правильный порядок:</b><ol class="ch-sol">${sorted.map(p => `<li><b>${esc(p.name)}</b> — ${esc(p.years)}</li>`).join('')}</ol></div><button class="btn wide" id="next">${r + 1 < rounds ? 'Дальше' : 'Результат'}</button>` : (order.length ? '<button class="btn ghost wide" id="undo">Сбросить выбор</button>' : '')}</div></div>`;
    if (!checked) {
      $$('.ch-item', hw).forEach(b => { b.onclick = () => {
        const k = +b.dataset.k, pos = order.indexOf(k);
        if (pos >= 0) order = order.slice(0, pos); else order.push(k);
        if (order.length === 4) { const ok = order.every((kk, i) => set.slice().sort((a, c) => a.y - c.y)[i] === set[kk]); if (ok) score++; else buzz(); draw(true); }
        else draw(false);
      }; });
      const u = $('#undo'); if (u) u.onclick = () => { order = []; draw(false); };
    } else {
      $('#next').onclick = () => { r++; round(); };
      $('#next').focus({ preventScroll: true });
    }
  }
  function finish() {
    const pct = Math.round(score / rounds * 100);
    saveBest('drill:chrono', pct, 'Тренировка: хронология');
    $('.progress>div').style.width = '100%'; $('.tb-prog').textContent = '';
    hw.innerHTML = `<div class="result"><div class="r-score">${pct}%</div><div class="r-stars">${stars(pct)}</div><div class="r-sub">Без ошибок ${score} из ${rounds}</div><p class="r-verdict">Опорные даты удобно запоминать «якорями»: Сократ — 399 до н. э., Августин — V в., Фома — XIII в., Декарт — 1637, Кант — 1781, Гегель — 1807.</p></div>
      <div class="btnrow"><button class="btn ghost" id="menu">Готово</button><button class="btn" id="again">Ещё раз</button></div>`;
    countUp($('.r-score', hw), pct, '%');
    $('#menu').onclick = () => back(parent);
    $('#again').onclick = () => play(playChrono, { eras, rounds }, parent);
  }
  const onKey = e => { if (e.key === 'Enter' && $('#next') && document.activeElement !== $('#next')) { e.preventDefault(); $('#next').click(); } };
  document.addEventListener('keydown', onKey);
  round();
  return () => document.removeEventListener('keydown', onKey);
}

// ===================== Персоналии =====================
const peopleState = { q: '' };
function People() {
  const render = () => {
    const q = peopleState.q.trim().toLowerCase();
    const match = p => !q || [p.name, p.idea, p.years, ...p.works, ...p.quotes].join(' ').toLowerCase().includes(q);
    const groups = ERAS.map(e => ({ e, items: PEOPLE.filter(p => p.era === e.id && match(p)).sort((a, b) => a.y - b.y) })).filter(g => g.items.length);
    $('#pl').innerHTML = groups.length ? groups.map(g => `<section class="tl-group" data-era="${g.e.id}"><h2 class="era-h"><span>${esc(g.e.name)}</span></h2><ol class="timeline">${g.items.map(p => `<li class="tl-item"><details><summary><span class="tl-years">${esc(p.years)}</span><span class="tl-name">${esc(p.name)}</span><span class="tl-idea">${esc(p.idea)}</span></summary>
      <div class="tl-more">${p.works.length ? `<p><b>Труды:</b> ${p.works.map(esc).join('; ')}</p>` : ''}${p.quotes.length ? p.quotes.map(x => `<blockquote>${esc(x)}</blockquote>`).join('') : ''}<p class="tl-links">${p.topics.map(n => `<a href="#/t/${n}" data-go="t/${n}">Билет ${n}</a>`).join('')}</p></div></details></li>`).join('')}</ol></section>`).join('') : '<p class="empty">Никого не найдено.</p>';
    bindLinks($('#pl'));
  };
  app.innerHTML = `${topbar('Персоналии')}<div class="page"><div class="wrap narrow">
    <label class="search">${icon('search')}<input type="search" id="q" placeholder="Имя, труд или идея…" value="${esc(peopleState.q)}" autocomplete="off"></label>
    <button class="btn ghost wide" id="chrono">${icon('clock')}Тренировка: хронология</button>
    <div id="pl"></div>
  </div></div>`;
  bindBack();
  $('#q').oninput = e => { peopleState.q = e.target.value; render(); };
  $('#chrono').onclick = () => play(playChrono, { eras: allEras(), rounds: 10 }, 'people');
  render();
}

// ===================== Прогресс =====================
function Progress() {
  let confirm = false;
  const render = () => {
    const read = Object.keys(S.read).length;
    const known = TERMS.filter(c => S.cards[c.id] === 1).length;
    const tested = Object.keys(S.test).length;
    const avg = tested ? Math.round(Object.values(S.test).reduce((a, b) => a + b, 0) / tested) : 0;
    const v = Object.values(S.self);
    const best = Object.entries(S.best).filter(([k]) => !k.startsWith('topic:')).sort((a, b) => b[1].at - a[1].at);
    app.innerHTML = `${topbar('Мой прогресс')}<div class="page"><div class="wrap narrow">
      <div class="stats">
        <div class="stat"><b>${read}</b><span>из ${TOPICS.length} билетов изучено</span></div>
        <div class="stat"><b>${tested ? avg + '%' : '—'}</b><span>средний тест по билетам (${tested})</span></div>
        <div class="stat"><b>${known}</b><span>из ${TERMS.length} карточек выучено</span></div>
        <div class="stat"><b>${v.filter(x => x === 'good').length}</b><span>билетов отмечено «знаю»</span></div>
      </div>
      <h2 class="sec">Билеты по эпохам</h2>
      <div class="breakdown">${ERAS.map(e => { const ts = TOPICS.filter(t => t.era === e.id), r = ts.filter(t => S.read[t.n]).length; return `<div class="bd-row" data-era="${e.id}"><span>${esc(e.short)}</span><span class="bd-bar"><i style="width:${r / ts.length * 100}%"></i></span><b>${r}/${ts.length}</b></div>`; }).join('')}</div>
      <h2 class="sec">Карта билетов</h2>
      <div class="grid50">${TOPICS.map(t => { const p = S.test[t.n], s = S.self[t.n]; const cls = s === 'good' || p >= 80 ? 'good' : s === 'part' || p >= 50 ? 'mid' : s === 'bad' || p != null ? 'low' : S.read[t.n] ? 'read' : ''; return `<a href="#/t/${t.n}" data-go="t/${t.n}" class="cell ${cls}" title="${esc(t.title)}">${t.n}</a>`; }).join('')}</div>
      <div class="legend"><span><i class="cell-dot good"></i>знаю / тест от 80%</span><span><i class="cell-dot mid"></i>частично</span><span><i class="cell-dot low"></i>слабо</span><span><i class="cell-dot read"></i>прочитан</span></div>
      ${best.length ? `<h2 class="sec">Лучшие результаты</h2><div class="list">${best.map(([k, b]) => `<div class="lrow"><span>${esc(b.label || k)}</span><b class="${b.pct >= 80 ? 'good' : b.pct >= 50 ? 'mid' : 'low'}">${b.pct}%</b></div>`).join('')}</div>` : ''}
      <div class="reset">${confirm ? `<p>Удалить весь прогресс по философии на этом устройстве?</p><div class="btnrow"><button class="btn ghost" id="no">Отмена</button><button class="btn danger" id="yes">Удалить</button></div>` : '<button class="btn ghost wide" id="rst">Сбросить прогресс</button>'}</div>
    </div></div>`;
    bindBack(); bindLinks();
    const on = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
    on('rst', () => { confirm = true; render(); });
    on('no', () => { confirm = false; render(); });
    on('yes', () => { ['read', 'test', 'cards', 'self', 'wrong', 'best'].forEach(k => { S[k] = {}; save(k); }); S.last = 0; save('last'); confirm = false; render(); });
  };
  render();
}

// ===================== Старт =====================
render('swap');
})();
