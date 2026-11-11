import { sb, $, esc, av, S, toast } from './core.js';

export async function render(el) {
  // نجلب أحدث بيانات لأن النقاط تتغير من الإعجابات والتعليقات
  const { data: me } = await sb.from('profiles').select('*').eq('id', S.me.id).single();
  S.me = me; $('#pt').textContent = `⭐ ${me.points}`;
  const [{ count: ahead }, { count: posts }, { count: likes }] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }).gt('points', me.points),
    sb.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('is_story', false),
    sb.from('likes').select('post_id', { count: 'exact', head: true }).eq('user_id', me.id)
  ]);

  el.innerHTML = `<div class="prof card">
    ${av(me.full_name)}<h2>${esc(me.full_name)}</h2><div class="mut">رقم المستخدم #${esc(me.username)}</div>
    <div class="stats"><div><b>${me.points}</b>النقاط</div><div><b>${(ahead || 0) + 1}</b>الترتيب</div><div><b>${posts || 0}</b>المنشورات</div></div>
    <p class="mut">أعجبت بـ ${likes || 0} منشور · انضم ${new Date(me.created_at).toLocaleDateString('ar')}</p></div>
    <div class="card"><input id="nm" class="inp" value="${esc(me.full_name)}" maxlength="40" placeholder="الاسم">
      <textarea id="bio" class="inp" maxlength="160" placeholder="نبذة عنك…">${esc(me.bio || '')}</textarea>
      <button class="btn" id="sv">حفظ التعديلات</button></div>
    <button class="card big" id="lo" style="color:var(--no)">تسجيل الخروج</button>
    <p class="copy">جميع الحقوق محفوظة تكي 2026©<br><a href="mailto:muzamiltaki893@gmail.com" style="color:var(--cy)">muzamiltaki893@gmail.com</a></p>`;

  $('#sv', el).onclick = async () => {
    const full_name = $('#nm', el).value.trim(); if (!full_name) return toast('الاسم مطلوب');
    const { error } = await sb.from('profiles').update({ full_name, bio: $('#bio', el).value.trim() }).eq('id', me.id);
    error ? toast('تعذّر الحفظ') : toast('تم الحفظ ✔');
  };
  $('#lo', el).onclick = async () => { await sb.auth.signOut(); location.reload(); };
}
