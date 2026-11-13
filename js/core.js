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
  document.body.append(t); setTimeout(() => t.remove(), 3000);
};

export const ago = d => {
  const s = (Date.now() - new Date(d)) / 1000;
  return s < 60 ? 'الآن' : s < 3600 ? `منذ ${~~(s / 60)} د` : s < 86400 ? `منذ ${~~(s / 3600)} س` : `منذ ${~~(s / 86400)} يوم`;
};

export const pts = async n => {
  const { error } = await sb.rpc('add_points', { n });
  if (!error && S.me) { S.me.points = (S.me.points || 0) + n; const c = $('#pt'); if (c) c.textContent = `⭐ ${S.me.points}`; }
};

export async function loadData() {
  if (!S.data) {
    const [c, q] = await Promise.all([fetch('data/content.json'), fetch('data/quizzes.json')]);
    if (!c.ok || !q.ok) throw new Error('تعذر تحميل ملفات المحتوى والاختبارات');
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

// يرفع الصور إلى Storage ثم يعيد رابطاً عاماً. اسم الملف فريد لتجنب الاستبدال.
export async function uploadImage(file, folder = 'uploads') {
  if (!file) return null;
  if (!file.type?.startsWith('image/')) throw new Error('الملف المختار ليس صورة');
  if (file.size > 6 * 1024 * 1024) throw new Error('حجم الصورة يجب ألا يتجاوز 6 ميجابايت');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${S.me.id}/${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('taki-media').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = sb.storage.from('taki-media').getPublicUrl(path);
  return data.publicUrl;
}

export function imagePickerHTML(id = 'image-file') {
  return `<label class="btn sm" for="${id}" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">📷 إرفاق صورة</label><input id="${id}" type="file" accept="image/*" hidden>`;
}

export function imagePreviewHTML(url, alt = 'صورة مرفقة') {
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" style="display:block;max-width:100%;max-height:420px;object-fit:contain;border-radius:14px;margin-top:10px"></a>` : '';
}

// يخلط الخيارات مع المحافظة على الإجابة الصحيحة.
export function quiz(el, qs, { secs = 0, onCorrect, onDone }) {
  let i = 0, score = 0, left = secs, tm, done = false;
  const report = [];
  const end = () => { if (done) return; done = true; clearInterval(tm); onDone?.(score, qs.length, report); };
  const show = () => {
    if (done || !qs[i]) return end();
    const q = qs[i];
    const options = q.options.map((text, oldIndex) => ({ text, correct: oldIndex === Number(q.answer) }));
    const mixed = shuffle(options);
    el.innerHTML = `<div class="qhead"><span>${i + 1} / ${qs.length}</span>${secs ? '<b id="tm"></b>' : ''}</div>
      <div class="bar"><i style="width:${(i / qs.length) * 100}%"></i></div>
      <h3 style="margin-bottom:14px">${esc(q.q)}</h3>
      ${mixed.map((o, k) => `<button class="opt" data-correct="${o.correct}">${esc(o.text)}</button>`).join('')}`;
    $$('.opt', el).forEach(b => b.onclick = () => {
      if (done) return;
      $$('.opt', el).forEach(x => { x.disabled = true; if (x.dataset.correct === 'true') x.classList.add('ok'); });
      const selected = b.textContent;
      const correctOption = mixed.find(x => x.correct)?.text ?? '';
      const ok = b.dataset.correct === 'true';
      report.push({ question: q.q, selected, correct: correctOption, isCorrect: ok });
      if (ok) { score++; onCorrect?.(); } else b.classList.add('no');
      setTimeout(() => (++i < qs.length ? show() : end()), 700);
    });
  };
  if (secs) tm = setInterval(() => {
    if (done) return;
    left--; const t = $('#tm', el);
    if (t) t.textContent = `⏱ ${Math.max(0, ~~(left / 60))}:${String(Math.max(0, left % 60)).padStart(2, '0')}`;
    if (left <= 0) end();
  }, 1000);
  show();
}
