import { sb, $, $$, esc, ago, av, S, overlay, toast, uploadImage, imagePickerHTML, imagePreviewHTML } from './core.js';
import { openChallenge } from './challenge.js';

export async function render(el) {
  const since = new Date(Date.now() - 864e5).toISOString();
  const [st, ch, ps] = await Promise.all([
    sb.from('posts').select('id,content,image_url,user_id,created_at,profiles!posts_user_id_fkey(full_name)').eq('is_story', true).gte('created_at', since).order('created_at', { ascending: false }),
    sb.from('challenges').select('id,subject_name,num,profiles(full_name)').eq('status', 'waiting').order('created_at', { ascending: false }).limit(5),
    sb.from('posts').select('id,content,image_url,created_at,user_id,profiles!posts_user_id_fkey(full_name,username),likes(user_id),comments(count)').eq('is_story', false).order('created_at', { ascending: false }).limit(50)
  ]);
  if (st.error) console.error('STORIES ERROR:', st.error);
  if (ch.error) console.error('CHALLENGES ERROR:', ch.error);
  if (ps.error) { console.error('POSTS ERROR:', ps.error); toast('تعذر تحميل المنشورات: ' + ps.error.message); }
  const stories = st.data || [], chals = ch.data || [], posts = ps.data || [];

  el.innerHTML = `
    <div class="stories"><button class="st" data-add="1"><span class="av">＋</span> حالتك</button>
      ${stories.map((s, i) => `<div class="story-item" style="position:relative;display:inline-flex;align-items:center">
        <button class="st" data-s="${i}">${av(s.profiles?.full_name)} ${esc((s.profiles?.full_name || '').split(' ')[0])}</button>
        ${s.user_id === S.me.id ? `<button class="story-delete" data-delete-story="${s.id}" title="حذف الحالة" style="position:absolute;top:-5px;right:-5px;z-index:5;border:0;border-radius:50%;background:#e53935;color:white;width:23px;height:23px;cursor:pointer">×</button>` : ''}
      </div>`).join('')}
    </div>
    ${chals.map(c => `<div class="card chal row"><span style="font-size:1.8rem">⚔️</span><div class="grow"><b>تحدي ${esc(c.subject_name)}</b><div class="mut">${c.num} سؤال · من ${esc(c.profiles?.full_name || 'طالب')}</div></div><button class="btn sm" data-j="${c.id}">انضم</button></div>`).join('')}
    <div id="posts">${posts.map(postHTML).join('') || '<div class="card mut" style="text-align:center">لا توجد منشورات بعد. اضغط ＋ وانشر أول منشور.</div>'}</div>`;

  $('[data-add]', el)?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('taki:go', { detail: 'add' })));
  $$('[data-s]', el).forEach(b => b.onclick = () => {
    const s = stories[Number(b.dataset.s)];
    overlay(`<div class="row">${av(s.profiles?.full_name)}<b>${esc(s.profiles?.full_name || 'طالب')}</b></div><div class="story-view">${esc(s.content)}</div>${imagePreviewHTML(s.image_url)}`);
  });
  $$('[data-delete-story]', el).forEach(b => b.onclick = async e => {
    e.stopPropagation(); if (!confirm('هل تريد حذف هذه الحالة نهائياً؟')) return;
    b.disabled = true;
    const { error } = await sb.from('posts').delete().eq('id', b.dataset.deleteStory).eq('user_id', S.me.id).eq('is_story', true);
    if (error) toast('تعذر حذف الحالة: ' + error.message); else { b.closest('.story-item')?.remove(); toast('تم حذف الحالة'); }
    b.disabled = false;
  });
  $$('[data-j]', el).forEach(b => b.onclick = () => openChallenge(b.dataset.j));
  $$('.post', el).forEach(wire);
}

const postHTML = p => {
  const likes = p.likes || [], comments = p.comments || [];
  const liked = likes.some(l => l.user_id === S.me.id), isOwner = p.user_id === S.me.id;
  return `<article class="card post" data-id="${p.id}" data-owner="${p.user_id}">
    <div class="row">${av(p.profiles?.full_name)}<div class="grow"><b>${esc(p.profiles?.full_name || 'طالب')}</b><div class="mut">${ago(p.created_at)}</div></div></div>
    ${p.content ? `<div class="pbody">${esc(p.content)}</div>` : ''}${imagePreviewHTML(p.image_url, 'صورة المنشور')}
    <div class="acts"><button class="lk ${liked ? 'liked' : ''}">${liked ? '❤️' : '🤍'} <span>${likes.length}</span></button>
      <button class="cb">💬 <span class="comment-count">${comments[0]?.count || 0}</span></button>
      ${isOwner ? '<button class="delete-post" style="border:0;background:transparent;color:#ff5555;cursor:pointer;padding:6px 10px">🗑️ حذف</button>' : ''}</div>
    <div class="cm" hidden></div></article>`;
};

function wire(card) {
  const id = card.dataset.id;
  $('.lk', card).onclick = async e => {
    const b = e.currentTarget; if (b.disabled) return;
    const on = b.classList.contains('liked'), n = $('span', b), old = Number(n.textContent); b.disabled = true;
    try {
      const result = on ? await sb.from('likes').delete().match({ post_id: id, user_id: S.me.id }) : await sb.from('likes').insert({ post_id: id, user_id: S.me.id });
      if (result.error) throw result.error;
      b.classList.toggle('liked', !on); n.textContent = Math.max(0, old + (on ? -1 : 1)); b.firstChild.textContent = on ? '🤍 ' : '❤️ ';
      if (!on && card.dataset.owner !== S.me.id) toast('+1 نقطة ⭐');
    } catch (error) { toast('تعذّر تنفيذ الإعجاب: ' + error.message); }
    finally { b.disabled = false; }
  };
  $('.cb', card).onclick = async () => { const box = $('.cm', card); box.hidden = !box.hidden; if (!box.hidden) await loadComments(card, box, id); };
  $('.delete-post', card)?.addEventListener('click', async () => {
    if (!confirm('هل تريد حذف هذا المنشور نهائياً؟')) return;
    const { error } = await sb.from('posts').delete().eq('id', id).eq('user_id', S.me.id).eq('is_story', false);
    if (error) toast('تعذر حذف المنشور: ' + error.message); else { card.remove(); toast('تم حذف المنشور'); }
  });
}

async function loadComments(card, box, postId) {
  box.innerHTML = '<div class="mut" style="text-align:center;padding:12px">جارٍ تحميل التعليقات...</div>';
  const { data, error } = await sb.from('comments').select('id,content,parent_id,user_id,created_at,profiles!comments_user_id_fkey(full_name),comment_likes(user_id)').eq('post_id', postId).order('created_at', { ascending: true });
  if (error) { console.error(error); box.innerHTML = ''; toast('تعذّر تحميل التعليقات: ' + error.message); return; }
  const rows = data || [], roots = rows.filter(c => !c.parent_id);
  const renderComment = c => `<div class="comment-item" style="padding:9px 0;border-bottom:1px solid rgba(127,127,127,.15)" data-comment="${c.id}">
    <b>${esc(c.profiles?.full_name || 'طالب')}</b><div>${esc(c.content)}</div><small class="mut">${ago(c.created_at)}</small>
    <div class="row" style="gap:8px;margin-top:4px"><button class="comment-like" data-id="${c.id}">${(c.comment_likes || []).some(x => x.user_id === S.me.id) ? '❤️' : '🤍'} ${(c.comment_likes || []).length}</button><button class="comment-reply" data-id="${c.id}">↩ رد</button></div>
    ${rows.filter(x => x.parent_id === c.id).map(r => `<div style="margin:8px 0 0 18px;padding:8px;border-right:2px solid var(--cy)"><b>${esc(r.profiles?.full_name || 'طالب')}</b><div>${esc(r.content)}</div><small class="mut">${ago(r.created_at)}</small></div>`).join('')}
  </div>`;
  box.innerHTML = `<div class="comments-list">${roots.map(renderComment).join('') || '<p class="mut" style="text-align:center">لا توجد تعليقات بعد. كن أول من يعلق!</p>'}</div>
    <div class="row" style="margin-top:12px"><input class="inp comment-input" style="margin:0" placeholder="اكتب تعليقاً…" maxlength="300"><button class="btn sm comment-send">إرسال</button></div>`;
  const inp = $('.comment-input', box), sendBtn = $('.comment-send', box);
  let replyTo = null;
  $$('[data-id]', box).forEach(b => {
    if (b.classList.contains('comment-like')) b.onclick = async () => {
      const commentId = b.dataset.id, existing = rows.find(x => x.id === commentId)?.comment_likes || [], liked = existing.some(x => x.user_id === S.me.id);
      const res = liked ? await sb.from('comment_likes').delete().match({ comment_id: commentId, user_id: S.me.id }) : await sb.from('comment_likes').insert({ comment_id: commentId, user_id: S.me.id });
      if (res.error) toast('تعذر تحديث الإعجاب: ' + res.error.message); else await loadComments(card, box, postId);
    };
    if (b.classList.contains('comment-reply')) b.onclick = () => { replyTo = b.dataset.id; inp.placeholder = 'اكتب رداً على التعليق…'; inp.focus(); };
  });
  const send = async () => {
    const content = inp.value.trim(); if (!content || sendBtn.disabled) return;
    sendBtn.disabled = true; inp.disabled = true;
    const { error } = await sb.from('comments').insert({ post_id: postId, user_id: S.me.id, content, parent_id: replyTo });
    if (error) toast('تعذّر إرسال التعليق: ' + error.message);
    else { if (card.dataset.owner !== S.me.id) toast('+2 نقاط ⭐'); const count = $('.comment-count', card); count.textContent = Number(count.textContent) + 1; await loadComments(card, box, postId); }
    sendBtn.disabled = false; inp.disabled = false;
  };
  sendBtn.onclick = send; inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); send(); } };
}
