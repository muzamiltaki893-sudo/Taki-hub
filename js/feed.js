import { sb, $, $$, esc, ago, av, S, overlay, toast } from './core.js';
import { openChallenge } from './challenge.js';

export async function render(el) {
  const since = new Date(Date.now() - 864e5).toISOString();

  const [st, ch, ps] = await Promise.all([

    // جلب الحالات
    sb.from('posts')
      .select(`
        id,
        content,
        user_id,
        created_at,
        profiles!posts_user_id_fkey(full_name)
      `)
      .eq('is_story', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),

    // جلب التحديات
    sb.from('challenges')
      .select('id,subject_name,num,profiles(full_name)')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(5),

    // جلب المنشورات
    sb.from('posts')
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles!posts_user_id_fkey(full_name,username),
        likes(user_id),
        comments(count)
      `)
      .eq('is_story', false)
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  // معالجة الأخطاء
  if (st.error) {
    console.error('STORIES ERROR:', st.error);
  }

  if (ch.error) {
    console.error('CHALLENGES ERROR:', ch.error);
  }

  if (ps.error) {
    console.error('POSTS ERROR:', ps.error);
    toast('تعذر تحميل المنشورات: ' + ps.error.message);
  }

  const stories = st.data || [];
  const chals = ch.data || [];
  const posts = ps.data || [];

  // عرض المحتوى
  el.innerHTML = `

    <div class="stories">

      <button class="st" data-add="1">
        <span class="av">＋</span>
        حالتك
      </button>

      ${stories.map((s, i) => `
        <div class="story-item"
          style="position:relative;display:inline-flex;align-items:center;">

          <button class="st" data-s="${i}">
            ${av(s.profiles?.full_name)}
            ${esc((s.profiles?.full_name || '').split(' ')[0])}
          </button>

          ${s.user_id === S.me.id ? `
            <button
              class="story-delete"
              data-delete-story="${s.id}"
              title="حذف الحالة"
              style="
                position:absolute;
                top:-5px;
                right:-5px;
                z-index:5;
                border:0;
                border-radius:50%;
                background:#e53935;
                color:white;
                width:23px;
                height:23px;
                cursor:pointer;
              ">
              ×
            </button>
          ` : ''}

        </div>
      `).join('')}

    </div>

    ${chals.map(c => `
      <div class="card chal row">

        <span style="font-size:1.8rem">⚔️</span>

        <div class="grow">
          <b>تحدي ${esc(c.subject_name)}</b>

          <div class="mut">
            ${c.num} سؤال · من ${esc(c.profiles?.full_name || 'طالب')}
          </div>
        </div>

        <button class="btn sm" data-j="${c.id}">
          انضم
        </button>

      </div>
    `).join('')}

    <div id="posts">

      ${posts.map(postHTML).join('') ||
        '<div class="card mut" style="text-align:center">لا توجد منشورات بعد. اضغط ＋ وانشر أول منشور.</div>'
      }

    </div>
  `;


  // إضافة حالة جديدة
  const addBtn = $('[data-add]', el);

  if (addBtn) {
    addBtn.onclick = () => {
      window.dispatchEvent(
        new CustomEvent('taki:go', { detail: 'add' })
      );
    };
  }


  // عرض الحالات
  $$('[data-s]', el).forEach(b => {

    b.onclick = () => {

      const s = stories[Number(b.dataset.s)];

      overlay(`
        <div class="row">
          ${av(s.profiles?.full_name)}
          <b>${esc(s.profiles?.full_name || 'طالب')}</b>
        </div>

        <div class="story-view">
          ${esc(s.content)}
        </div>
      `);

    };

  });


  // حذف الحالات
  $$('[data-delete-story]', el).forEach(b => {

    b.onclick = async e => {

      e.stopPropagation();

      const id = b.dataset.deleteStory;

      if (!confirm('هل تريد حذف هذه الحالة نهائياً؟')) {
        return;
      }

      b.disabled = true;

      const { error } = await sb
        .from('posts')
        .delete()
        .eq('id', id)
        .eq('user_id', S.me.id)
        .eq('is_story', true);

      b.disabled = false;

      if (error) {
        console.error('STORY DELETE ERROR:', error);
        toast('تعذر حذف الحالة: ' + error.message);
        return;
      }

      b.closest('.story-item')?.remove();

      toast('تم حذف الحالة بنجاح');

    };

  });


  // الانضمام للتحديات
  $$('[data-j]', el).forEach(b => {

    b.onclick = () => openChallenge(b.dataset.j);

  });


  // تفعيل أزرار المنشورات
  $$('.post', el).forEach(wire);

}


// ====================================
// إنشاء بطاقة المنشور
// ====================================

const postHTML = p => {

  const likes = p.likes || [];
  const comments = p.comments || [];

  const liked = likes.some(
    l => l.user_id === S.me.id
  );

  const isOwner = p.user_id === S.me.id;

  return `

    <article class="card post"
      data-id="${p.id}"
      data-owner="${p.user_id}">

      <div class="row">

        ${av(p.profiles?.full_name)}

        <div class="grow">

          <b>${esc(p.profiles?.full_name || 'طالب')}</b>

          <div class="mut">
            ${ago(p.created_at)}
          </div>

        </div>

      </div>


      <div class="pbody">
        ${esc(p.content)}
      </div>


      <div class="acts">

        <button class="lk ${liked ? 'liked' : ''}">

          ${liked ? '❤️' : '🤍'}

          <span>${likes.length}</span>

        </button>


        <button class="cb">
          💬 ${comments[0]?.count || 0}
        </button>


        ${isOwner ? `
          <button
            class="delete-post"
            title="حذف المنشور"
            style="
              border:0;
              background:transparent;
              color:#ff5555;
              cursor:pointer;
              padding:6px 10px;
            ">
            🗑️ حذف
          </button>
        ` : ''}

      </div>


      <div class="cm" hidden></div>

    </article>

  `;

};


// ====================================
// تفعيل التفاعلات
// ====================================

function wire(card) {

  const id = card.dataset.id;


  // الإعجاب
  $('.lk', card).onclick = async e => {

    const b = e.currentTarget;

    const on = b.classList.contains('liked');

    const n = $('span', b);

    b.disabled = true;

    const { error } = on

      ? await sb.from('likes')
          .delete()
          .match({
            post_id: id,
            user_id: S.me.id
          })

      : await sb.from('likes')
          .insert({
            post_id: id,
            user_id: S.me.id
          });


    b.disabled = false;

    if (error) {

      console.error('LIKE ERROR:', error);

      return toast('تعذّر تنفيذ الإعجاب: ' + error.message);

    }


    b.classList.toggle('liked', !on);

    n.textContent =
      Number(n.textContent) + (on ? -1 : 1);

    b.firstChild.textContent = on ? '🤍 ' : '❤️ ';


    if (!on && card.dataset.owner !== S.me.id) {

      toast('+1 نقطة ⭐');

    }

  };


  // عرض التعليقات
  $('.cb', card).onclick = async () => {

    const box = $('.cm', card);

    box.hidden = !box.hidden;

    if (!box.hidden) {

      await loadComments(card, box, id);

    }

  };


  // حذف المنشور
  const deleteBtn = $('.delete-post', card);

  if (deleteBtn) {

    deleteBtn.onclick = async () => {

      if (!confirm('هل تريد حذف هذا المنشور نهائياً؟')) {
        return;
      }

      deleteBtn.disabled = true;

      const { error } = await sb
        .from('posts')
        .delete()
        .eq('id', id)
        .eq('user_id', S.me.id)
        .eq('is_story', false);

      deleteBtn.disabled = false;

      if (error) {

        console.error('POST DELETE ERROR:', error);

        toast('تعذر حذف المنشور: ' + error.message);

        return;

      }

      // إزالة المنشور من الواجهة
      card.remove();

      // التحقق من عدم بقاء منشورات
      const remaining = $$('.post', $('#posts'));

      if (remaining.length === 0) {

        $('#posts').innerHTML = `
          <div class="card mut" style="text-align:center">
            لا توجد منشورات بعد. اضغط ＋ وانشر أول منشور.
          </div>
        `;

      }

      toast('تم حذف المنشور بنجاح');

    };

  }

}


// ====================================
// تحميل التعليقات
// ====================================

async function loadComments(card, box, id) {

  const { data, error } = await sb

    .from('comments')

    .select(`
      content,
      created_at,
      profiles!comments_user_id_fkey(full_name)
    `)

    .eq('post_id', id)

    .order('created_at', { ascending: true });


  if (error) {

    console.error('COMMENTS ERROR:', error);

    toast('تعذّر تحميل التعليقات: ' + error.message);

    return;

  }


  box.innerHTML = `

    ${(data || []).map(c => `

      <p>

        <b>
          ${esc(c.profiles?.full_name || 'طالب')}
        </b>

        ${esc(c.content)}

      </p>

    `).join('')}


    <div class="row">

      <input
        class="inp"
        style="margin:0"
        placeholder="اكتب تعليقاً…"
        maxlength="300"
      >

      <button class="btn sm">
        إرسال
      </button>

    </div>

  `;


  const inp = $('input', box);

  const sendBtn = $('button', box);


  // إرسال تعليق
  sendBtn.onclick = async () => {

    const t = inp.value.trim();

    if (!t) return;

    sendBtn.disabled = true;

    const { error } = await sb

      .from('comments')

      .insert({

        post_id: id,

        user_id: S.me.id,

        content: t

      });


    sendBtn.disabled = false;


    if (error) {

      console.error('COMMENT INSERT ERROR:', error);

      return toast('تعذّر إرسال التعليق: ' + error.message);

    }


    if (card.dataset.owner !== S.me.id) {

      toast('+2 نقاط ⭐');

    }


    // تحديث عدد التعليقات
    const cb = $('.cb', card);

    const match = cb.textContent.match(/\d+/);

    const count = match ? Number(match[0]) : 0;

    cb.textContent = `💬 ${count + 1}`;


    // إعادة تحميل التعليقات
    await loadComments(card, box, id);

  };

}