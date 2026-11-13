import { sb, $, $$, esc, ago, av, S, overlay, toast, uploadImage, imagePickerHTML, imagePreviewHTML } from './core.js';

export async function render(el) {
  let view = 'dm';
  el.innerHTML = `<div class="seg"><button data-v="dm" class="on">💬 المحادثات</button><button data-v="groups">👥 المجموعات</button><button data-v="rank">🏆 الترتيب</button></div>
    <input id="chat-search" class="inp" placeholder="ابحث عن طالب بالاسم أو الرقم…"><div class="row" style="margin:8px 0"><button class="btn sm" id="new-group">＋ إنشاء مجموعة</button></div><div id="chat-list"></div>`;
  const list = $('#chat-list', el), search = $('#chat-search', el);
  const switchView = async v => {
    view = v; $$('.seg button', el).forEach(b => b.classList.toggle('on', b.dataset.v === v));
    search.hidden = v !== 'dm'; $('#new-group', el).hidden = v !== 'groups';
    await draw();
  };
  async function users() {
    const q = search.value.trim().replace(/[,()%*]/g, '');
    let r = sb.from('profiles').select('id,full_name,username,points').neq('id', S.me.id).limit(40);
    r = q ? r.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`) : r.order('full_name');
    const { data, error } = await r;
    if (error) { list.innerHTML = `<p class="err">${esc(error.message)}</p>`; return; }
    const { data: unreadRows } = await sb.from('messages').select('sender_id').eq('receiver_id', S.me.id).is('read_at', null);
    const unread = (unreadRows || []).reduce((acc, row) => { acc[row.sender_id] = (acc[row.sender_id] || 0) + 1; return acc; }, {});
    const totalUnread = (unreadRows || []).length;
    list.innerHTML = (data || []).map(u => `<button class="card row" data-user="${u.id}">${av(u.full_name)}<div class="grow"><b>${esc(u.full_name)}</b><div class="mut">#${esc(u.username)}</div></div>${unread[u.id] ? `<span class="chip">${unread[u.id]} غير مقروءة</span>` : ''}<span class="chip">⭐ ${u.points}</span></button>`).join('') || '<p class="mut" style="text-align:center">لا يوجد طلاب مطابقون.</p>';
    $$('[data-user]', list).forEach(b => b.onclick = () => openDirectChat((data || []).find(x => x.id === b.dataset.user)));
    if (totalUnread) list.insertAdjacentHTML('afterbegin', `<p class="mut">إجمالي الرسائل غير المقروءة: ${totalUnread}</p>`);
  }
  async function groups() {
    const { data: memberships, error } = await sb.from('chat_group_members').select('group_id,role,chat_groups(id,name,description,avatar_url,owner_id,created_at)').eq('user_id', S.me.id);
    if (error) { list.innerHTML = `<p class="err">${esc(error.message)}<br>نفّذ ملف SQL الإضافي أولاً.</p>`; return; }
    list.innerHTML = (memberships || []).map(m => `<button class="card row" data-group="${m.group_id}">${m.chat_groups?.avatar_url ? `<img src="${esc(m.chat_groups.avatar_url)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">` : '<span class="av">👥</span>'}<div class="grow"><b>${esc(m.chat_groups?.name || 'مجموعة')}</b><div class="mut">${esc(m.chat_groups?.description || 'محادثة جماعية')}</div></div><span class="chip">${m.role === 'owner' ? 'مالك' : 'عضو'}</span></button>`).join('') || '<p class="mut" style="text-align:center">لم تنضم إلى مجموعات بعد. أنشئ مجموعتك الأولى.</p>';
    $$('[data-group]', list).forEach(b => b.onclick = () => openGroupChat(b.dataset.group));
  }
  async function ranking() {
    const { data, error } = await sb.from('profiles').select('id,full_name,points').order('points', { ascending: false }).limit(50);
    list.innerHTML = error ? `<p class="err">${esc(error.message)}</p>` : (data || []).map((u, i) => `<div class="card rank" ${u.id === S.me.id ? 'style="border-color:var(--cy)"' : ''}><span class="n">${i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</span>${av(u.full_name)}<b class="grow">${esc(u.full_name)}</b><span class="chip">⭐ ${u.points}</span></div>`).join('');
  }
  async function draw() { if (view === 'dm') await users(); else if (view === 'groups') await groups(); else await ranking(); }
  $$('.seg button', el).forEach(b => b.onclick = () => switchView(b.dataset.v));
  let timer; search.oninput = () => { clearTimeout(timer); timer = setTimeout(users, 300); };
  $('#new-group', el).onclick = createGroup;
  await draw();
}

async function createGroup() {
  const { data: students, error } = await sb.from('profiles').select('id,full_name,username').neq('id', S.me.id).order('full_name').limit(100);
  if (error) return toast('تعذر تحميل الطلاب: ' + error.message);
  const o = overlay(`<h2 class="ttl">إنشاء مجموعة جديدة</h2><input id="gn" class="inp" maxlength="60" placeholder="اسم المجموعة">
    <textarea id="gd" class="inp" maxlength="180" placeholder="وصف المجموعة (اختياري)"></textarea>
    <p class="mut">اختر الأعضاء الذين تريد إضافتهم الآن:</p><div style="max-height:240px;overflow:auto">${(students || []).map(s => `<label class="row" style="padding:7px"><input type="checkbox" value="${s.id}"><span>${esc(s.full_name)} <small class="mut">#${esc(s.username)}</small></span></label>`).join('')}</div>
    <button class="btn" id="create-group-submit">إنشاء المجموعة</button>`);
  $('#create-group-submit', o).onclick = async e => {
    const btn = e.currentTarget, name = $('#gn', o).value.trim(), description = $('#gd', o).value.trim();
    if (!name) return toast('اكتب اسم المجموعة');
    btn.disabled = true;
    try {
      const { data: group, error: ge } = await sb.from('chat_groups').insert({ name, description, owner_id: S.me.id }).select('id').single();
      if (ge) throw ge;
      const selected = $$('input[type="checkbox"]:checked', o).map(x => x.value);
      const ids = [S.me.id, ...selected];
      const { error: me } = await sb.from('chat_group_members').insert(ids.map(user_id => ({ group_id: group.id, user_id, role: user_id === S.me.id ? 'owner' : 'member' })));
      if (me) throw me;
      o.remove(); toast('تم إنشاء المجموعة'); window.dispatchEvent(new CustomEvent('taki:go', { detail: 'chat' }));
    } catch (err) { toast('تعذر إنشاء المجموعة: ' + err.message); btn.disabled = false; }
  };
}

async function openDirectChat(u) {
  const me = S.me.id;
  const o = overlay(`<div class="row" style="margin-bottom:10px">${av(u.full_name)}<b>${esc(u.full_name)}</b></div><div class="chat-box" id="cb" style="min-height:240px;max-height:55vh;overflow:auto"></div>
    <div id="image-selected" class="mut"></div><div class="row">${imagePickerHTML('dm-image')}<input id="mi" class="inp" style="margin:0" placeholder="اكتب رسالة…" maxlength="500"><button class="btn sm" id="sd">إرسال</button></div>`);
  const box = $('#cb', o), inp = $('#mi', o), picker = $('#dm-image', o); let selectedFile = null;
  const add = m => {
    const own = m.sender_id === me;
    box.insertAdjacentHTML('beforeend', `<div class="msg ${own ? 'me' : ''}" style="margin:8px 0;max-width:85%">${m.content ? `<div>${esc(m.content)}</div>` : ''}${imagePreviewHTML(m.image_url, 'صورة في الرسالة')}<small class="mut">${ago(m.created_at)}${m.read_at && own ? ' · تمت القراءة' : ''}</small>
      <div><button class="msg-like" data-message="${m.id}" style="border:0;background:transparent;cursor:pointer">🤍 إعجاب</button></div></div>`);
    box.scrollTop = box.scrollHeight;
  };
  const { data, error } = await sb.from('messages').select('*').or(`and(sender_id.eq.${me},receiver_id.eq.${u.id}),and(sender_id.eq.${u.id},receiver_id.eq.${me})`).order('created_at').limit(200);
  if (error) toast('تعذر تحميل الرسائل: ' + error.message);
  (data || []).forEach(add);
  for (const m of (data || []).filter(x => x.receiver_id === me && !x.read_at)) await sb.rpc('mark_message_read', { p_message_id: m.id });
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-message]'); if (!b) return;
    const { error: le } = await sb.from('message_likes').insert({ message_id: b.dataset.message, user_id: me });
    if (le && !String(le.code).includes('23505')) toast('تعذر الإعجاب بالرسالة'); else b.textContent = '❤️ أعجبت';
  });
  const chn = sb.channel('dm-' + me + '-' + u.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me}` }, async p => {
    if (p.new.sender_id === u.id) { add(p.new); await sb.rpc('mark_message_read', { p_message_id: p.new.id }); }
  }).subscribe();
  $('.close', o).addEventListener('click', () => sb.removeChannel(chn));
  picker.onchange = () => { selectedFile = picker.files?.[0] || null; $('#image-selected', o).textContent = selectedFile ? `📷 ${selectedFile.name}` : ''; };
  const send = async () => {
    const content = inp.value.trim(); if ((!content && !selectedFile) || $('#sd', o).disabled) return;
    const btn = $('#sd', o); btn.disabled = true;
    try {
      const image_url = selectedFile ? await uploadImage(selectedFile, 'messages') : null;
      const { data: m, error: se } = await sb.from('messages').insert({ sender_id: me, receiver_id: u.id, content, image_url }).select().single();
      if (se) throw se;
      add(m); inp.value = ''; selectedFile = null; picker.value = ''; $('#image-selected', o).textContent = '';
    } catch (err) { toast('تعذر إرسال الرسالة: ' + err.message); }
    btn.disabled = false;
  };
  $('#sd', o).onclick = send; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); send(); } };
}

async function openGroupChat(groupId) {
  const me = S.me.id;
  const { data: group, error: ge } = await sb.from('chat_groups').select('*').eq('id', groupId).single();
  if (ge || !group) return toast('تعذر فتح المجموعة: ' + (ge?.message || 'المجموعة غير موجودة'));
  const o = overlay(`<div class="row" style="margin-bottom:10px">${group.avatar_url ? `<img src="${esc(group.avatar_url)}" style="width:42px;height:42px;border-radius:50%;object-fit:cover">` : '<span class="av">👥</span>'}<div class="grow"><b>${esc(group.name)}</b><div class="mut">${esc(group.description || 'محادثة جماعية')}</div></div><button class="btn sm" id="add-member">＋ عضو</button></div>
    <div class="chat-box" id="gb" style="min-height:240px;max-height:55vh;overflow:auto"></div><div id="g-image-selected" class="mut"></div>
    <div class="row">${imagePickerHTML('group-image')}<input id="gm" class="inp" style="margin:0" placeholder="اكتب رسالة للمجموعة…" maxlength="1000"><button class="btn sm" id="gs">إرسال</button></div>`);
  const box = $('#gb', o), inp = $('#gm', o), picker = $('#group-image', o); let selectedFile = null;
  const { data: members } = await sb.from('chat_group_members').select('user_id,role,profiles(full_name)').eq('group_id', groupId);
  const isAdmin = group.owner_id === me || (members || []).some(m => m.user_id === me && m.role === 'admin');
  $('#add-member', o).hidden = !isAdmin;
  const { data: msgs, error: meErr } = await sb.from('group_messages').select('*,profiles!group_messages_sender_id_fkey(full_name),group_message_likes(user_id)').eq('group_id', groupId).order('created_at').limit(250);
  if (meErr) toast('تعذر تحميل رسائل المجموعة: ' + meErr.message);
  const add = m => {
    const likes = m.group_message_likes || [];
    box.insertAdjacentHTML('beforeend', `<div class="msg ${m.sender_id === me ? 'me' : ''}" style="margin:8px 0;max-width:88%"><b>${esc(m.profiles?.full_name || (m.sender_id === me ? S.me.full_name : 'عضو'))}</b>${m.content ? `<div>${esc(m.content)}</div>` : ''}${imagePreviewHTML(m.image_url, 'صورة في المجموعة')}<small class="mut">${ago(m.created_at)}</small><div><button data-glike="${m.id}" style="border:0;background:transparent;cursor:pointer">${likes.some(x => x.user_id === me) ? '❤️' : '🤍'} ${likes.length}</button></div></div>`);
    box.scrollTop = box.scrollHeight;
  };
  (msgs || []).forEach(add);
  box.onclick = async e => { const b = e.target.closest('[data-glike]'); if (!b) return; const { error } = await sb.from('group_message_likes').insert({ group_message_id: b.dataset.glike, user_id: me }); if (error && !String(error.code).includes('23505')) toast(error.message); else b.textContent = '❤️'; };
  const chn = sb.channel('group-' + groupId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, async p => {
    const { data: fresh } = await sb.from('group_messages').select('*,profiles!group_messages_sender_id_fkey(full_name),group_message_likes(user_id)').eq('id', p.new.id).single();
    if (fresh) add(fresh);
  }).subscribe();
  $('.close', o).addEventListener('click', () => sb.removeChannel(chn));
  $('#add-member', o).onclick = async () => {
    const { data: students } = await sb.from('profiles').select('id,full_name,username').neq('id', me).order('full_name').limit(100);
    const pick = overlay(`<h3 class="ttl">إضافة عضو</h3><div style="max-height:55vh;overflow:auto">${(students || []).map(s => `<button class="card row" data-pick="${s.id}">${esc(s.full_name)} <small class="mut">#${esc(s.username)}</small></button>`).join('')}</div>`);
    $$('[data-pick]', pick).forEach(b => b.onclick = async () => { const { error } = await sb.rpc('add_chat_group_member', { p_group_id: groupId, p_user_id: b.dataset.pick }); if (error) toast('تعذرت إضافة العضو: ' + error.message); else { toast('تمت إضافة العضو'); pick.remove(); } });
  };
  picker.onchange = () => { selectedFile = picker.files?.[0] || null; $('#g-image-selected', o).textContent = selectedFile ? `📷 ${selectedFile.name}` : ''; };
  $('#gs', o).onclick = async () => {
    const btn = $('#gs', o), content = inp.value.trim(); if ((!content && !selectedFile) || btn.disabled) return; btn.disabled = true;
    try {
      const image_url = selectedFile ? await uploadImage(selectedFile, 'group-messages') : null;
      const { data: sent, error } = await sb.from('group_messages').insert({ group_id: groupId, sender_id: me, content, image_url }).select('id').single();
      if (error) throw error;
      const { data: fresh } = await sb.from('group_messages').select('*,profiles!group_messages_sender_id_fkey(full_name),group_message_likes(user_id)').eq('id', sent.id).single();
      if (fresh) add(fresh); inp.value = ''; selectedFile = null; picker.value = ''; $('#g-image-selected', o).textContent = '';
    } catch (err) { toast('تعذر إرسال الرسالة: ' + err.message); }
    btn.disabled = false;
  };
}
