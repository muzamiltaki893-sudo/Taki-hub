import { sb, $, $$, esc, av, S, overlay, toast } from './core.js';

export async function render(el) {
  let view = 'u';
  el.innerHTML = `<div class="seg"><button data-m="u" class="on">👥 المحادثات</button><button data-m="r">🏆 الترتيب</button></div>
    <input id="s" class="inp" placeholder="ابحث عن طالب بالاسم أو الرقم…"><div id="list"></div>`;
  const list = $('#list', el), search = $('#s', el);

  async function users() {
    const q = search.value.trim().replace(/[,()%*]/g, '');
    let r = sb.from('profiles').select('id,full_name,username,points').neq('id', S.me.id).limit(40);
    r = q ? r.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`) : r.order('full_name');
    const { data } = await r;
    list.innerHTML = (data || []).map(u => `<button class="card row" data-u='${esc(JSON.stringify(u))}'>${av(u.full_name)}
      <div class="grow"><b>${esc(u.full_name)}</b><div class="mut">#${esc(u.username)}</div></div><span class="chip">⭐ ${u.points}</span></button>`).join('')
      || '<p class="mut" style="text-align:center">لا يوجد طلاب مطابقون.</p>';
    $$('[data-u]', list).forEach(b => b.onclick = () => openChat(JSON.parse(b.dataset.u)));
  }

  async function ranking() {
    const { data } = await sb.from('profiles').select('id,full_name,points').order('points', { ascending: false }).limit(50);
    list.innerHTML = (data || []).map((u, i) => `<div class="card rank" ${u.id === S.me.id ? 'style="border-color:var(--cy)"' : ''}>
      <span class="n">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>${av(u.full_name)}
      <b class="grow">${esc(u.full_name)}</b><span class="chip">⭐ ${u.points}</span></div>`).join('');
  }

  const draw = () => { search.hidden = view === 'r'; view === 'u' ? users() : ranking(); };
  $$('.seg button', el).forEach(b => b.onclick = () => {
    view = b.dataset.m; $$('.seg button', el).forEach(x => x.classList.toggle('on', x === b)); draw();
  });
  let t; search.oninput = () => { clearTimeout(t); t = setTimeout(users, 300); };
  draw();
}

async function openChat(u) {
  const o = overlay(`<div class="row" style="margin-bottom:10px">${av(u.full_name)}<b>${esc(u.full_name)}</b></div>
    <div class="chat-box" id="cb"></div>
    <div class="row"><input id="mi" class="inp" style="margin:0" placeholder="اكتب رسالة…" maxlength="500"><button class="btn sm" id="sd">إرسال</button></div>`);
  const box = $('#cb', o), inp = $('#mi', o), me = S.me.id;
  const add = m => {
    box.insertAdjacentHTML('beforeend', `<div class="msg ${m.sender_id === me ? 'me' : ''}">${esc(m.content)}</div>`);
    box.scrollTop = box.scrollHeight;
  };
  const { data } = await sb.from('messages').select('*')
    .or(`and(sender_id.eq.${me},receiver_id.eq.${u.id}),and(sender_id.eq.${u.id},receiver_id.eq.${me})`)
    .order('created_at').limit(200);
  (data || []).forEach(add);

  const chn = sb.channel('dm-' + me + '-' + u.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me}` },
      p => { if (p.new.sender_id === u.id) add(p.new); })
    .subscribe();
  $('.close', o).addEventListener('click', () => sb.removeChannel(chn));

  const send = async () => {
    const t = inp.value.trim(); if (!t) return;
    inp.value = '';
    const { data: m, error } = await sb.from('messages').insert({ sender_id: me, receiver_id: u.id, content: t }).select().single();
    error ? toast('تعذّر إرسال الرسالة') : add(m);
  };
  $('#sd', o).onclick = send;
  inp.onkeydown = e => { if (e.key === 'Enter') send(); };
}
