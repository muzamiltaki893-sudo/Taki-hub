import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const S = { me: null, data: null };
export const shuffle = a => [...a].sort(() => Math.random() - .5);
export const av = n => `<span class="av">${esc((n || '؟').trim()[0])}</span>`;

export const toast = m => {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = m;
  document.body.append(t); setTimeout(() => t.remove(), 2500);
};

export const ago = d => {
  const s = (Date.now() - new Date(d)) / 1000;
  return s < 60 ? 'الآن' : s < 3600 ? `منذ ${~~(s / 60)} د` : s < 86400 ? `منذ ${~~(s / 3600)} س` : `منذ ${~~(s / 86400)} يوم`;
};

// نقطة واحدة لكل إجابة صحيحة (تُسجَّل في قاعدة البيانات عبر دالة آمنة)
export const pts = async n => {
  const { error } = await sb.rpc('add_points', { n });
  if (!error) { S.me.points += n; const c = $('#pt'); if (c) c.textContent = `⭐ ${S.me.points}`; }
};

export async function loadData() {
  if (!S.data) {
    const [c, q] = await Promise.all([fetch('data/content.json'), fetch('data/quizzes.json')]);
    S.data = { ...(await c.json()), quizzes: await q.json() };
  }
  return S.data;
}

export function overlay(html) {
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="sheet"><button class="close" aria-label="إغلاق">✕</button>${html}</div>`;
  document.body.append(o);
  $('.close', o).onclick = () => o.remove();
  return o;
}

// محرك الاختبار: اختيار من متعدد، مؤقت اختياري، يُستخدم في المكتب والتحديات
export function quiz(el, qs, { secs = 0, onCorrect, onDone }) {
  let i = 0, score = 0, left = secs, tm, done = false;
  const end = () => { if (done) return; done = true; clearInterval(tm); onDone(score, qs.length); };
  const show = () => {
    const q = qs[i];
    el.innerHTML = `<div class="qhead"><span>${i + 1} / ${qs.length}</span>${secs ? '<b id="tm"></b>' : ''}</div>
      <div class="bar"><i style="width:${(i / qs.length) * 100}%"></i></div>
      <h3 style="margin-bottom:14px">${esc(q.q)}</h3>
      ${q.options.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}`;
    $$('.opt', el).forEach(b => b.onclick = () => {
      if (done) return;
      const ok = +b.dataset.k === q.answer;
      $$('.opt', el).forEach(x => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add('ok'); });
      if (ok) { score++; onCorrect?.(); } else b.classList.add('no');
      setTimeout(() => (++i < qs.length ? show() : end()), 700);
    });
  };
  if (secs) tm = setInterval(() => {
    left--; const t = $('#tm', el);
    if (t) t.textContent = `⏱ ${~~(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left <= 0) end();
  }, 1000);
  show();
}
