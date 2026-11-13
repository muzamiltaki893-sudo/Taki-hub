import {
  sb, $, $$, esc, S, overlay, toast,
  loadData, quiz, pts, shuffle, av,
  uploadImage, imagePickerHTML, imagePreviewHTML
} from './core.js';


// ==================================================
// صفحة المنشورات والحالات والتحديات والألعاب
// ==================================================

export async function render(el) {

  const d = await loadData();
  let mode = 'post';
  let selectedImage = null;

  const draw = () => {

    el.innerHTML = `

      <div class="seg">

        <button data-m="post" class="${mode === 'post' ? 'on' : ''}">
          منشور
        </button>

        <button data-m="story" class="${mode === 'story' ? 'on' : ''}">
          حالة
        </button>

        <button data-m="chal" class="${mode === 'chal' ? 'on' : ''}">
          تحدٍ ⚔️
        </button>

      </div>


      ${mode === 'chal' ? `

        <div class="card">

          <h3>⚔️ إنشاء تحدٍ جديد</h3>

          <p class="mut">
            اختر المادة وعدد الأسئلة.
          </p>

          <select id="sj" class="inp">

            ${d.subjects.map(s => `
              <option value="${esc(s.id)}">
                ${esc(s.icon || '📚')} ${esc(s.name)}
              </option>
            `).join('')}

          </select>


          <input
            id="nq"
            class="inp"
            type="number"
            min="3"
            max="30"
            value="10"
            placeholder="عدد الأسئلة"
          >

          <button class="btn" id="go">
            إنشاء التحدي ⚔️
          </button>

        </div>

      ` : `

        <div class="card">

          <textarea
            id="tx"
            class="inp"
            maxlength="${mode === 'story' ? 140 : 1000}"
            placeholder="${mode === 'story' ? 'اكتب حالتك…' : 'بماذا تفكر؟'}"
          ></textarea>


          <div style="margin-top:12px">

            ${imagePickerHTML('taki-post-image')}

          </div>


          <div id="image-preview"></div>


          <button class="btn" id="go" style="margin-top:12px">

            ${mode === 'story' ? 'نشر الحالة' : 'نشر المنشور'}

          </button>

        </div>

      `}


      <!-- منطقة الألعاب -->

      <div class="card" style="margin-top:18px">

        <div class="row">

          <div class="grow">

            <h3 style="margin:0">🎮 مركز الألعاب</h3>

            <small class="mut">
              استمتع بالألعاب داخل TAKI
            </small>

          </div>

          <span style="font-size:28px">🕹️</span>

        </div>


        <button
          class="btn"
          id="open-games"
          style="width:100%;margin-top:12px"
        >
          🎮 افتح الألعاب
        </button>

      </div>

    `;


    // تبديل الوضع

    $$('.seg button', el).forEach(b => {

      b.onclick = () => {

        mode = b.dataset.m;
        selectedImage = null;

        draw();

      };

    });


    // اختيار صورة

    if (mode !== 'chal') {

      const picker = $('#taki-post-image', el);

      picker.onchange = () => {

        const file = picker.files?.[0];

        if (!file) return;

        if (!file.type.startsWith('image/')) {

          toast('اختر ملف صورة صالحاً');
          picker.value = '';
          return;

        }

        if (file.size > 6 * 1024 * 1024) {

          toast('حجم الصورة يجب ألا يتجاوز 6 ميجابايت');
          picker.value = '';
          return;

        }

        selectedImage = file;

        const preview = $('#image-preview', el);

        const url = URL.createObjectURL(file);

        preview.innerHTML = `

          <div style="margin-top:12px">

            <img
              src="${url}"
              style="
                width:100%;
                max-height:300px;
                object-fit:contain;
                border-radius:12px;
              "
            >

            <button
              class="btn sm"
              id="remove-image"
              style="margin-top:8px;background:#b52b38"
            >
              إزالة الصورة
            </button>

          </div>

        `;

        $('#remove-image', preview).onclick = () => {

          URL.revokeObjectURL(url);

          selectedImage = null;
          picker.value = '';
          preview.innerHTML = '';

        };

      };

    }


    // زر التنفيذ

    $('#go', el).onclick = e => submit(e.currentTarget);


    // فتح الألعاب

    $('#open-games', el).onclick = openGames;

  };


  // ==================================================
  // إنشاء منشور أو حالة أو تحدٍ
  // ==================================================

  async function submit(btn) {

    btn.disabled = true;

    try {

      if (mode === 'chal') {

        const sid = $('#sj', el).value;

        const n = Math.min(
          30,
          Math.max(3, Number($('#nq', el).value) || 10)
        );

        const pool = d.quizzes[sid] || [];

        if (pool.length < 3) {

          throw new Error('لا توجد أسئلة كافية في هذه المادة');

        }

        const subject = d.subjects.find(s => s.id === sid);

        if (!subject) {

          throw new Error('المادة غير موجودة');

        }

        const questions = shuffle(pool).slice(
          0,
          Math.min(n, pool.length)
        );

        const { data, error } = await sb

          .from('challenges')

          .insert({

            host_id: S.me.id,

            subject_name: subject.name,

            num: questions.length,

            questions,

            status: 'waiting'

          })

          .select('id')

          .single();


        if (error) throw error;

        if (!data?.id) {

          throw new Error('لم يتم استرجاع رقم التحدي');

        }

        toast('تم إنشاء التحدي بنجاح ⚔️');

        await openChallenge(data.id);


      } else {

        const content = $('#tx', el).value.trim();

        if (!content && !selectedImage) {

          throw new Error('اكتب شيئاً أو أرفق صورة');

        }


        let image_url = null;

        if (selectedImage) {

          toast('جارٍ رفع الصورة...');

          image_url = await uploadImage(
            selectedImage,
            mode === 'story' ? 'stories' : 'posts'
          );

        }


        const { error } = await sb

          .from('posts')

          .insert({

            user_id: S.me.id,

            content,

            image_url,

            is_story: mode === 'story'

          });


        if (error) throw error;

        toast(
          mode === 'story'
            ? 'تم نشر الحالة بنجاح'
            : 'تم نشر المنشور بنجاح'
        );


        window.dispatchEvent(

          new CustomEvent('taki:go', {

            detail: 'feed'

          })

        );

      }

    } catch (e) {

      console.error('SUBMIT ERROR:', e);

      toast('تعذر إكمال العملية: ' + e.message);

    } finally {

      btn.disabled = false;

    }

  }


  draw();

}



// ==================================================
// غرفة التحدي
// ==================================================

export async function openChallenge(id) {

  const o = overlay('<div id="room"></div>');

  const room = $('#room', o);

  let ch = null;
  let players = [];
  let mode = 'lobby';
  let myScore = 0;
  let channel = null;


  // تحميل البيانات

  const load = async () => {

    const { data, error } = await sb

      .from('challenges')

      .select('*')

      .eq('id', id)

      .maybeSingle();


    if (error) throw error;

    if (!data) {

      throw new Error('هذا التحدي غير موجود');

    }

    ch = data;


    // تحميل المشاركين

    const { data: members, error: membersError } = await sb

      .from('challenge_players')

      .select('*')

      .eq('challenge_id', id)

      .order('score', { ascending: false });


    if (membersError) throw membersError;

    players = members || [];


    // أسماء المشاركين

    const ids = [...new Set(players.map(p => p.user_id))];

    if (ids.length) {

      const { data: profiles } = await sb

        .from('profiles')

        .select('id,full_name')

        .in('id', ids);


      const map = new Map(
        (profiles || []).map(p => [p.id, p])
      );

      players = players.map(p => ({

        ...p,

        profiles: map.get(p.user_id) || {
          full_name: 'طالب'
        }

      }));

    }

  };


  try {

    await load();

  } catch (e) {

    room.innerHTML = `

      <div class="card">

        <h3>تعذر فتح التحدي</h3>

        <p>${esc(e.message)}</p>

      </div>

    `;

    return;

  }



  // الانضمام

  const member = () =>

    players.some(p => p.user_id === S.me.id);


  if (!member() && ch.status === 'waiting') {

    const { error } = await sb

      .from('challenge_players')

      .insert({

        challenge_id: id,

        user_id: S.me.id,

        score: 0,

        finished: false

      });


    if (error) {

      console.error(error);

      toast('تعذر الانضمام: ' + error.message);

    }

    await load();

  }



  // قائمة المشاركين

  const list = () => players.map((p, i) => `

    <div class="card rank">

      <span class="n">${i + 1}</span>

      ${av(p.profiles?.full_name)}

      <b class="grow">

        ${esc(p.profiles?.full_name || 'طالب')}

        ${p.user_id === ch.host_id ? ' 👑' : ''}

      </b>

      <span class="chip">

        ${p.finished ? '✔ ' : ''}

        ${Number(p.score || 0)}

      </span>

    </div>

  `).join('');



  // عرض الغرفة

  const draw = () => {

    if (mode === 'play') return;

    if (!member()) {

      room.innerHTML = '<div class="card">أنت لست مشاركاً في هذا التحدي.</div>';

      return;

    }

    const me = players.find(p => p.user_id === S.me.id);

    if (me?.finished) {

      mode = 'result';

      room.innerHTML = `

        <h2 class="ttl">🏆 نتائج التحدي</h2>

        ${list()}

      `;

      return;

    }


    if (ch.status === 'started') {

      play();

      return;

    }


    room.innerHTML = `

      <h2 class="ttl">⚔️ تحدي ${esc(ch.subject_name)}</h2>

      <p class="mut">

        ${ch.num} سؤال · ${players.length} مشارك

      </p>

      ${list()}

      ${ch.host_id === S.me.id

        ? '<button class="btn" id="start">ابدأ التحدي</button>'

        : '<p class="mut">بانتظار صاحب التحدي...</p>'

      }

    `;


    $('#start', room)?.addEventListener('click', startChallenge);

  };



  // بدء التحدي

  async function startChallenge() {

    if (ch.host_id !== S.me.id) return;

    const btn = $('#start', room);

    if (btn) btn.disabled = true;

    try {

      const { error } = await sb

        .from('challenges')

        .update({ status: 'started' })

        .eq('id', id)

        .eq('host_id', S.me.id);


      if (error) throw error;

      await load();

      draw();

    } catch (e) {

      toast('تعذر بدء التحدي: ' + e.message);

      if (btn) btn.disabled = false;

    }

  }



  // تشغيل الأسئلة

  function play() {

    if (mode === 'play') return;

    mode = 'play';

    myScore = 0;


    if (!Array.isArray(ch.questions) || !ch.questions.length) {

      toast('لا توجد أسئلة');

      return;

    }


    quiz(room, ch.questions, {

      onCorrect: async () => {

        myScore++;

        await pts(1);


        const { error } = await sb

          .from('challenge_players')

          .update({ score: myScore })

          .match({

            challenge_id: id,

            user_id: S.me.id

          });


        if (error) console.error(error);

      },


      onDone: async () => {

        const { error } = await sb

          .from('challenge_players')

          .update({

            score: myScore,

            finished: true

          })

          .match({

            challenge_id: id,

            user_id: S.me.id

          });


        if (error) toast('تعذر حفظ النتيجة');

        mode = 'result';

        await load();

        draw();

      }

    });

  }



  // تحديث مباشر

  const refresh = async () => {

    if (mode === 'play' || mode === 'result') return;

    try {

      await load();

      draw();

    } catch (e) {

      console.error(e);

    }

  };


  channel = sb.channel('room-' + id)

    .on('postgres_changes', {

      event: '*',

      schema: 'public',

      table: 'challenge_players',

      filter: `challenge_id=eq.${id}`

    }, refresh)

    .on('postgres_changes', {

      event: 'UPDATE',

      schema: 'public',

      table: 'challenges',

      filter: `id=eq.${id}`

    }, refresh)

    .subscribe();


  $('.close', o).onclick = () => {

    if (channel) sb.removeChannel(channel);

    o.remove();

  };


  draw();

}



// ==================================================
// مركز الألعاب
// ==================================================

function openGames() {

  const o = overlay(`

    <h2 class="ttl">🎮 مركز ألعاب TAKI</h2>

    <p class="mut">اختر اللعبة التي تريد لعبها</p>

    <div class="card">

      <button class="btn game-button" data-game="snake" style="width:100%">
        🐍 Snake
      </button>

      <p class="mut">اجمع الطعام وزد طول الثعبان.</p>

    </div>

    <div class="card">

      <button class="btn game-button" data-game="ball" style="width:100%">
        🎯 Ball Blast
      </button>

      <p class="mut">دمر الكرات قبل أن تصل إلى الأسفل.</p>

    </div>

    <div class="card">

      <button class="btn game-button" data-game="memory" style="width:100%">
        🧠 Memory Match
      </button>

      <p class="mut">اعثر على البطاقات المتطابقة.</p>

    </div>

  `);


  $$('[data-game]', o).forEach(b => {

    b.onclick = () => {

      const game = b.dataset.game;

      o.remove();

      if (game === 'snake') snakeGame();
      if (game === 'ball') ballGame();
      if (game === 'memory') memoryGame();

    };

  });

}



// ==================================================
// لعبة Snake
// ==================================================

function snakeGame() {

  const o = overlay(`

    <h2 class="ttl">🐍 Snake</h2>

    <p id="snake-score">النقاط: 0</p>

    <canvas id="snake-canvas"
      width="320"
      height="320"
      style="width:100%;max-width:360px;background:#101c27;border-radius:14px">
    </canvas>

    <div style="text-align:center;margin-top:12px">

      <button class="btn sm" data-dir="up">⬆️</button>

      <div>

        <button class="btn sm" data-dir="left">⬅️</button>

        <button class="btn sm" data-dir="down">⬇️</button>

        <button class="btn sm" data-dir="right">➡️</button>

      </div>

    </div>

    <button class="btn" id="snake-restart">إعادة اللعب</button>

  `);


  const canvas = $('#snake-canvas', o);
  const ctx = canvas.getContext('2d');

  let timer = null;
  let snake, food, dx, dy, score, over;


  function start() {

    clearInterval(timer);

    snake = [
      { x: 8, y: 8 },
      { x: 7, y: 8 },
      { x: 6, y: 8 }
    ];

    food = { x: 14, y: 10 };

    dx = 1;
    dy = 0;

    score = 0;
    over = false;

    $('#snake-score', o).textContent = 'النقاط: 0';

    draw();

    timer = setInterval(step, 130);

  }


  function draw() {

    ctx.fillStyle = '#101c27';
    ctx.fillRect(0, 0, 320, 320);

    ctx.fillStyle = '#ff5555';

    ctx.fillRect(food.x * 16, food.y * 16, 14, 14);

    snake.forEach((p, i) => {

      ctx.fillStyle = i === 0 ? '#5cff9d' : '#20b86a';

      ctx.fillRect(p.x * 16, p.y * 16, 14, 14);

    });

  }


  function step() {

    if (over) return;

    const head = {

      x: snake[0].x + dx,

      y: snake[0].y + dy

    };


    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= 20 ||
      head.y >= 20 ||
      snake.some(p => p.x === head.x && p.y === head.y)
    ) {

      over = true;

      clearInterval(timer);

      toast('انتهت اللعبة! نقاطك: ' + score);

      return;

    }


    snake.unshift(head);


    if (head.x === food.x && head.y === food.y) {

      score++;

      $('#snake-score', o).textContent = 'النقاط: ' + score;

      food = {

        x: Math.floor(Math.random() * 20),

        y: Math.floor(Math.random() * 20)

      };

    } else {

      snake.pop();

    }

    draw();

  }


  function direction(d) {

    if (d === 'up' && dy !== 1) {
      dx = 0; dy = -1;
    }

    if (d === 'down' && dy !== -1) {
      dx = 0; dy = 1;
    }

    if (d === 'left' && dx !== 1) {
      dx = -1; dy = 0;
    }

    if (d === 'right' && dx !== -1) {
      dx = 1; dy = 0;
    }

  }


  $$('[data-dir]', o).forEach(b => {

    b.onclick = () => direction(b.dataset.dir);

  });


  const key = e => {

    const map = {

      ArrowUp: 'up',

      ArrowDown: 'down',

      ArrowLeft: 'left',

      ArrowRight: 'right'

    };

    if (map[e.key]) {

      e.preventDefault();

      direction(map[e.key]);

    }

  };


  document.addEventListener('keydown', key);


  $('#snake-restart', o).onclick = start;


  $('.close', o).addEventListener('click', () => {

    clearInterval(timer);

    document.removeEventListener('keydown', key);

  });


  start();

}



// ==================================================
// لعبة Ball Blast
// ==================================================

function ballGame() {

  const o = overlay(`

    <h2 class="ttl">🎯 Ball Blast</h2>

    <p id="ball-score">النقاط: 0</p>

    <p id="ball-life">الحياة: ❤️❤️❤️</p>

    <canvas id="ball-canvas"
      width="360"
      height="440"
      style="width:100%;background:#101c27;border-radius:14px;touch-action:manipulation">
    </canvas>

    <button class="btn" id="ball-restart">إعادة اللعب</button>

  `);


  const canvas = $('#ball-canvas', o);
  const ctx = canvas.getContext('2d');

  let balls = [];
  let score = 0;
  let lives = 3;
  let running = true;
  let raf = 0;
  let spawn = 0;


  function addBall() {

    balls.push({

      x: 20 + Math.random() * 320,

      y: -20,

      r: 13 + Math.random() * 12,

      speed: 1.2 + Math.random() * 1.5

    });

  }


  function draw() {

    if (!running) return;

    ctx.fillStyle = '#101c27';

    ctx.fillRect(0, 0, 360, 440);


    spawn++;

    if (spawn > 45) {

      addBall();

      spawn = 0;

    }


    balls.forEach(b => {

      b.y += b.speed;

      ctx.beginPath();

      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);

      ctx.fillStyle = '#ff6b5c';

      ctx.fill();

      ctx.strokeStyle = '#ffd27a';

      ctx.lineWidth = 2;

      ctx.stroke();

    });


    balls = balls.filter(b => {

      if (b.y - b.r > 440) {

        lives--;

        $('#ball-life', o).textContent =
          'الحياة: ' + '❤️'.repeat(lives);

        if (lives <= 0) {

          end();

        }

        return false;

      }

      return true;

    });


    raf = requestAnimationFrame(draw);

  }


  function end() {

    running = false;

    cancelAnimationFrame(raf);

    toast('انتهت اللعبة! نقاطك: ' + score);

  }


  canvas.onclick = e => {

    if (!running) return;

    const rect = canvas.getBoundingClientRect();

    const x = (e.clientX - rect.left) * 360 / rect.width;

    const y = (e.clientY - rect.top) * 440 / rect.height;


    const index = balls.findIndex(b => {

      const distance = Math.hypot(x - b.x, y - b.y);

      return distance <= b.r + 8;

    });


    if (index >= 0) {

      balls.splice(index, 1);

      score++;

      $('#ball-score', o).textContent = 'النقاط: ' + score;

    }

  };


  function restart() {

    cancelAnimationFrame(raf);

    balls = [];

    score = 0;

    lives = 3;

    spawn = 0;

    running = true;

    $('#ball-score', o).textContent = 'النقاط: 0';

    $('#ball-life', o).textContent = 'الحياة: ❤️❤️❤️';

    draw();

  }


  $('#ball-restart', o).onclick = restart;


  $('.close', o).addEventListener('click', () => {

    running = false;

    cancelAnimationFrame(raf);

  });


  draw();

}



// ==================================================
// لعبة Memory Match
// ==================================================

function memoryGame() {

  const symbols = [

    '🐱', '🐱',

    '🚀', '🚀',

    '🍎', '🍎',

    '⚽', '⚽',

    '💻', '💻',

    '⭐', '⭐',

    '🎮', '🎮',

    '🌙', '🌙'

  ];


  const o = overlay(`

    <h2 class="ttl">🧠 Memory Match</h2>

    <p id="memory-info">الحركات: 0 | الأزواج: 0 / 8</p>

    <div id="memory-board"
      style="
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:8px;
      ">
    </div>

    <button class="btn" id="memory-restart">
      إعادة اللعب
    </button>

  `);


  const board = $('#memory-board', o);

  let cards = [];
  let selected = [];
  let moves = 0;
  let pairs = 0;
  let locked = false;
  let timer = null;


  function start() {

    clearTimeout(timer);

    cards = shuffle(symbols);

    selected = [];

    moves = 0;

    pairs = 0;

    locked = false;

    renderCards();

    updateInfo();

  }


  function updateInfo() {

    $('#memory-info', o).textContent =

      `الحركات: ${moves} | الأزواج: ${pairs} / 8`;

  }


  function renderCards() {

    board.innerHTML = cards.map((symbol, i) => `

      <button
        class="memory-card"
        data-index="${i}"
        style="
          height:75px;
          font-size:25px;
          border:0;
          border-radius:12px;
          background:#453a77;
          color:white;
          cursor:pointer;
        "
      >
        ❔
      </button>

    `).join('');


    $$('.memory-card', board).forEach(b => {

      b.onclick = () => choose(Number(b.dataset.index));

    });

  }


  function choose(index) {

    if (locked || selected.includes(index)) return;

    const button = $(`[data-index="${index}"]`, board);

    if (button.dataset.done === '1') return;


    button.textContent = cards[index];

    button.style.background = '#6552a8';

    selected.push(index);


    if (selected.length === 2) {

      moves++;

      updateInfo();

      locked = true;

      const [a, b] = selected;


      if (cards[a] === cards[b]) {

        $$(`[data-index="${a}"], [data-index="${b}"]`, board)
          .forEach(x => {

            x.dataset.done = '1';

            x.style.background = '#168b60';

          });

        pairs++;

        selected = [];

        locked = false;

        updateInfo();


        if (pairs === 8) {

          toast('أحسنت! أكملت اللعبة 🏆');

        }

      } else {

        timer = setTimeout(() => {

          [a, b].forEach(i => {

            const x = $(`[data-index="${i}"]`, board);

            if (x) {

              x.textContent = '❔';

              x.style.background = '#453a77';

            }

          });

          selected = [];

          locked = false;

        }, 850);

      }

    }

  }


  $('#memory-restart', o).onclick = start;


  $('.close', o).addEventListener('click', () => {

    clearTimeout(timer);

  });


  start();

}