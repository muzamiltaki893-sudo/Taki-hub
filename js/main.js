import { sb, $, $$, S } from './core.js';
import * as feed from './feed.js';
import * as office from './office.js';
import * as challenge from './challenge.js';
import * as chat from './chat.js';
import * as profile from './profile.js';

const tabs = { feed, office, add: challenge, chat, profile };
const mail = u => `${u.trim().toLowerCase()}@taki.app`; // رقم المستخدم يتحول داخلياً إلى بريد

async function enter(user) {
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (!data) { await sb.auth.signOut(); throw new Error('الحساب غير مفعّل، تواصل مع الإدارة'); }
  S.me = data;
  $('#login').hidden = true; $('#app').hidden = false;
  $('#pt').textContent = `⭐ ${data.points}`;
  go('feed');
}

export async function go(t) {
  $$('.nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  const v = $('#view');
  v.innerHTML = '<p class="mut" style="text-align:center;padding:40px">جاري التحميل…</p>';
  try { await tabs[t].render(v); v.scrollTop = 0; }
  catch (e) { v.innerHTML = `<p class="err">تعذّر التحميل: ${e.message}</p>`; }
}
window.addEventListener('taki:go', e => go(e.detail));
$$('.nav button').forEach(b => b.onclick = () => go(b.dataset.t));

$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const btn = $('#go'), err = $('#err');
  err.textContent = ''; btn.disabled = true; btn.textContent = 'جاري الدخول…';
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email: mail($('#u').value), password: $('#p').value });
    if (error) throw new Error('رقم المستخدم أو كلمة المرور غير صحيحة');
    await enter(data.user);
  } catch (x) { err.textContent = x.message; }
  btn.disabled = false; btn.textContent = 'تسجيل الدخول';
};

(async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) try { await enter(data.session.user); } catch { /* يبقى على شاشة الدخول */ }
})();
