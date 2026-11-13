import { $, $$, esc, S, loadData, quiz, pts, shuffle } from './core.js';

export async function render(el) {
  const d = await loadData();
  el.innerHTML = `<h2 class="ttl">المكتب</h2><div class="grid">${d.subjects.map(s => `<button class="sub" data-id="${s.id}"><span>${s.icon}</span>${esc(s.name)}</button>`).join('')}</div>`;
  $$('.sub', el).forEach(b => b.onclick = () => subject(el, d, d.subjects.find(s => s.id === b.dataset.id)));
}

function subject(el, d, s) {
  el.innerHTML = `<button class="back" id="bk">رجوع إلى المواد</button><h2 class="ttl">${s.icon} ${esc(s.name)}</h2>
    <div class="two"><button class="card big" id="c">📖 المحتوى</button><button class="card big" id="q">📝 الاختبار</button></div><div id="out"></div>`;
  $('#bk', el).onclick = () => render(el);
  const out = $('#out', el);
  $('#c', el).onclick = () => {
    const items = d.content[s.id] || [];
    out.innerHTML = items.map(i => `<article class="card"><b>${esc(i.title)}</b><div class="pbody">${esc(i.body)}</div></article>`).join('') || '<p class="mut" style="text-align:center">لم يُضف محتوى لهذه المادة بعد.</p>';
  };
  $('#q', el).onclick = () => {
    const qs = shuffle(d.quizzes[s.id] || []).slice(0, 20);
    if (!qs.length) { out.innerHTML = '<p class="mut" style="text-align:center">لا توجد أسئلة لهذه المادة بعد.</p>'; return; }
    quiz(out, qs, {
      secs: 600,
      onCorrect: () => pts(1),
      onDone: (score, total, report = []) => {
        const percent = total ? Math.round(score / total * 100) : 0;
        out.innerHTML = `<div class="result"><div class="big-n">${score}/${total}</div><h3>${percent}%</h3>
          <p>الإجابات الصحيحة: ${score} · الخاطئة: ${total - score}</p><p>ربحت ${score} نقطة ⭐</p>
          <div style="text-align:right;margin-top:16px"><h3>مراجعة إجاباتك</h3>${report.map((r, i) => `<article class="card" style="margin:8px 0"><b>${i + 1}. ${esc(r.question)}</b><p style="color:${r.isCorrect ? 'var(--ok,#2eaf70)' : 'var(--no,#e55)'}">إجابتك: ${esc(r.selected)} ${r.isCorrect ? '✓' : '✗'}</p>${!r.isCorrect ? `<p>الإجابة الصحيحة: ${esc(r.correct)}</p>` : ''}</article>`).join('')}</div>
          <button class="btn sm" id="again" style="margin-top:14px">اختبار جديد</button></div>`;
      }
    });
  };
  out.addEventListener('click', e => { if (e.target.id === 'again') $('#q', el).click(); });
}
