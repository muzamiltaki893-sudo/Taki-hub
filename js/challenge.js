import { sb, $, $$, esc, S, overlay, toast, loadData, quiz, pts, shuffle, av } from './core.js';

/* ───────── تبويب ＋ : منشور / حالة / تحدٍّ ───────── */
export async function render(el) {
  const d = await loadData();
  let mode = 'post';
  const draw = () => {
    el.innerHTML = `<div class="seg">
      <button data-m="post" class="${mode === 'post' ? 'on' : ''}">منشور</button>
      <button data-m="story" class="${mode === 'story' ? 'on' : ''}">حالة</button>
      <button data-m="chal" class="${mode === 'chal' ? 'on' : ''}">تحدٍّ ⚔️</button></div>
      ${mode === 'chal' ? `
        <div class="card"><p class="mut" style="margin-bottom:8px">اختر المادة وعدد الأسئلة، وسيصل الطلب لجميع الطلاب.</p>
        <select id="sj" class="inp">${d.subjects.map(s => `<option value="${s.id}">${s.icon} ${esc(s.name)}</option>`).join('')}</select>
        <input id="nq" class="inp" type="number" min="3" max="30" value="10" placeholder="عدد الأسئلة">
        <button class="btn" id="go">إنشاء التحدي</button></div>`
      : `<div class="card"><textarea id="tx" class="inp" maxlength="${mode === 'story' ? 140 : 1000}" placeholder="${mode === 'story' ? 'اكتب حالتك (تختفي بعد 24 ساعة)…' : 'بماذا تفكر؟'}"></textarea>
        <button class="btn" id="go">${mode === 'story' ? 'رفع الحالة' : 'نشر'}</button></div>`}`;
    $$('.seg button', el).forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    $('#go', el).onclick = e => submit(e.currentTarget);
  };

  async function submit(btn) {
    btn.disabled = true;
    try {
      if (mode === 'chal') {
        const sid = $('#sj', el).value, n = Math.min(30, Math.max(3, +$('#nq', el).value || 10));
        const pool = d.quizzes[sid] || [];
        if (pool.length < 3) throw new Error('لا توجد أسئلة كافية في هذه المادة');
        const { data, error } = await sb.from('challenges').insert({
          host_id: S.me.id, subject_name: d.subjects.find(s => s.id === sid).name,
          num: Math.min(n, pool.length), questions: shuffle(pool).slice(0, n)
        }).select('id').single();
        if (error) throw error;
        openChallenge(data.id);
      } else {
        const t = $('#tx', el).value.trim();
        if (!t) throw new Error('اكتب شيئاً أولاً');
        const { error } = await sb.from('posts').insert({ user_id: S.me.id, content: t, is_story: mode === 'story' });
        if (error) throw error;
        toast(mode === 'story' ? 'تم رفع الحالة' : 'تم النشر');
        window.dispatchEvent(new CustomEvent('taki:go', { detail: 'feed' }));
      }
    } catch (e) { toast(e.message || 'حدث خطأ'); }
    btn.disabled = false;
  }
  draw();
}

/* ───────── غرفة التحدي المباشرة ───────── */
export async function openChallenge(id) {
  const o = overlay('<div id="room"></div>');
  const room = $('#room', o);
  let ch, players = [], mode = 'lobby', myScore = 0;

  const load = async () => {
    ch = (await sb.from('challenges').select('*,profiles(full_name)').eq('id', id).single()).data;
    players = (await sb.from('challenge_players').select('*,profiles(full_name)').eq('challenge_id', id).order('score', { ascending: false })).data || [];
  };
  await load();
  if (!ch) { room.innerHTML = '<p class="err">التحدي غير موجود</p>'; return; }
  const member = () => players.some(p => p.user_id === S.me.id);
  if (!member() && ch.status === 'waiting') {
    await sb.from('challenge_players').insert({ challenge_id: id, user_id: S.me.id });
    await load();
  }

  const list = () => players.map((p, i) => `<div class="card rank">
    <span class="n">${i + 1}</span>${av(p.profiles?.full_name)}
    <b class="grow">${esc(p.profiles?.full_name)}${p.user_id === ch.host_id ? ' 👑' : ''}</b>
    <span class="chip">${p.finished ? '✔ ' : ''}${p.score}</span></div>`).join('');

  const draw = () => {
    if (mode === 'play') return;
    if (!member()) { room.innerHTML = '<p class="mut" style="text-align:center">بدأ هذا التحدي بالفعل.</p>'; return; }
    const host = ch.host_id === S.me.id;
    if (mode === 'result' || (ch.status === 'started' && players.find(p => p.user_id === S.me.id)?.finished)) {
      mode = 'result';
      room.innerHTML = `<h2 class="ttl">🏆 النتائج</h2>${list()}`; return;
    }
    if (ch.status === 'started') return play();
    room.innerHTML = `<h2 class="ttl">⚔️ تحدي ${esc(ch.subject_name)}</h2>
      <p class="mut" style="margin-bottom:10px">${ch.num} سؤال · بانتظار اللاعبين (${players.length})</p>${list()}
      ${host ? '<button class="btn" id="st">ابدأ التحدي</button>' : '<p class="mut" style="text-align:center">بانتظار أن يبدأ صاحب التحدي…</p>'}`;
    $('#st', room)?.addEventListener('click', () => sb.from('challenges').update({ status: 'started' }).eq('id', id));
  };

  function play() {
    mode = 'play'; myScore = 0;
    quiz(room, ch.questions, {
      onCorrect: () => { myScore++; pts(1); sb.from('challenge_players').update({ score: myScore }).match({ challenge_id: id, user_id: S.me.id }); },
      onDone: async () => {
        await sb.from('challenge_players').update({ score: myScore, finished: true }).match({ challenge_id: id, user_id: S.me.id });
        mode = 'result'; await load(); draw();
      }
    });
  }

  const refresh = async () => { await load(); draw(); };
  const chn = sb.channel('room-' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_players', filter: `challenge_id=eq.${id}` }, refresh)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'challenges', filter: `id=eq.${id}` }, refresh)
    .subscribe();
  $('.close', o).addEventListener('click', () => sb.removeChannel(chn));
  draw();
}
