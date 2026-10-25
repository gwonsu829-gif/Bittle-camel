// 비틀낙타 랭킹: 시작 전에 닉네임을 받고, 개인 최고기록을 넘으면 Supabase scores 테이블에 자동으로 올린다.
// 랭킹 화면은 닉네임마다 가장 좋은 기록 하나만 모드별 TOP 10으로 보여준다.
// 아래 두 값이 비어 있으면 닉네임·랭킹 없이 게임만 돌아간다. publishable 키는 공개용 키라 페이지에 넣어도 된다.
const BOARD = {
  url: 'https://uzmuincsrfjgzsuaqpiv.supabase.co',
  key: 'sb_publishable_hcyCfJh1xSPhnkoNQJ0SnA_LtE7waqP', // publishable 키 (service_role·secret 키는 절대 넣지 말 것)
};

const Board = (() => {
  const NAME_KEY = 'bitteul-name';
  const enabled = () => Boolean(BOARD.url && BOARD.key);
  // 옛 anon 키(eyJ…로 시작하는 JWT)는 Authorization에도 넣고, 새 publishable 키(sb_publishable_…)는 apikey로만 보낸다.
  const headers = () => ({
    apikey: BOARD.key, 'Content-Type': 'application/json',
    ...(BOARD.key.startsWith('eyJ') ? { Authorization: 'Bearer ' + BOARD.key } : {}),
  });

  // ponytail: 상위 100줄을 받아 닉네임별로 한 줄만 남긴다. 한 사람이 100줄 넘게 상위를 차지하면 TOP 10이 덜 찰 수 있다 → 그때는 DB 뷰로 옮기기.
  async function top(mode) {
    const q = `select=name,dist,time&mode=eq.${mode}&order=dist.desc,time.asc&limit=100`;
    const r = await fetch(`${BOARD.url}/rest/v1/scores?${q}`, { headers: headers() });
    if (!r.ok) throw new Error('랭킹을 불러오지 못했어요 (' + r.status + ')');
    const seen = new Set();
    return (await r.json()).filter(s => !seen.has(s.name) && seen.add(s.name)).slice(0, 10);
  }

  async function submit(row) {
    const r = await fetch(`${BOARD.url}/rest/v1/scores`, {
      method: 'POST', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error('기록을 올리지 못했어요 (' + r.status + ')');
  }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const name = () => (store.get(NAME_KEY) || '').trim();
  const recKey = (mode, n) => `bitteul-rec:${mode}:${n}`;
  const record = (mode, n) => { try { return JSON.parse(store.get(recKey(mode, n))); } catch (e) { return null; } };
  const better = (a, b) => !b || a.dist > b.dist || (a.dist === b.dist && a.time < b.time);

  // 다른 사람이 입력한 이름이라 textContent로만 넣는다.
  function render(ol, list) {
    ol.replaceChildren();
    if (!list.length) {
      const li = document.createElement('li'); li.className = 'empty'; li.textContent = '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요.';
      ol.append(li);
      return;
    }
    const me = name();
    list.forEach((s, i) => {
      const li = document.createElement('li');
      if (s.name === me) li.className = 'mine';
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = i + 1;
      const who = document.createElement('span'); who.className = 'who'; who.textContent = s.name;
      const score = document.createElement('span'); score.className = 'score';
      score.textContent = `${Number(s.dist).toFixed(1)}m · ${Number(s.time).toFixed(1)}초`;
      li.append(rank, who, score);
      ol.append(li);
    });
  }

  // 출발 전에 부른다. 닉네임 칸이 있으면 그 값을 저장하고, 비어 있으면 출발을 막는다.
  function ready() {
    if (!enabled()) return true;
    const input = document.getElementById('board-name');
    if (input) {
      const n = input.value.trim().slice(0, 12);
      if (!n) {
        input.focus();
        const msg = input.closest('.board')?.querySelector('.board-msg');
        if (msg) msg.textContent = '닉네임을 먼저 적어 주세요.';
        return false;
      }
      store.set(NAME_KEY, n);
    }
    return Boolean(name());
  }

  // card: 패널 카드, run: 이번 판 기록 {dist, time} (시작 화면이면 없음)
  function mount(card, mode, run) {
    if (!enabled()) return;
    const box = document.createElement('section');
    box.className = 'board';
    box.innerHTML = `
      ${run ? '' : `<form class="board-form">
        <label for="board-name">닉네임</label>
        <input id="board-name" maxlength="12" placeholder="랭킹에 표시될 이름 (12자까지)" autocomplete="nickname">
      </form>`}
      <p class="board-msg" role="status"></p>
      <h2>${mode === 'hard' ? '하드' : '일반'} 랭킹 TOP 10</h2>
      <ol></ol>`;
    card.insertBefore(box, card.querySelector('#go'));
    const ol = box.querySelector('ol'), msg = box.querySelector('.board-msg');
    const refresh = () => top(mode).then(list => render(ol, list)).catch(e => (msg.textContent = e.message));

    if (!run) {
      const form = box.querySelector('form'), input = form.querySelector('input');
      input.value = name();
      if (!input.value) setTimeout(() => input.focus({ preventScroll: true }), 0); // 처음 온 사람은 이름 칸부터
      form.addEventListener('submit', e => { e.preventDefault(); card.querySelector('#go')?.click(); });
      refresh();
      return;
    }

    const me = name(), mine = { dist: Math.round(run.dist * 10) / 10, time: Math.round(run.time * 10) / 10 };
    const prev = record(mode, me);
    if (mine.dist < 1 || !better(mine, prev)) {
      msg.textContent = prev ? `${me}님 개인 최고: ${prev.dist.toFixed(1)}m · ${prev.time.toFixed(1)}초` : '';
      refresh();
      return;
    }
    msg.textContent = '개인 최고기록! 랭킹에 올리는 중…';
    submit({ name: me, mode, ...mine })
      .then(() => {
        store.set(recKey(mode, me), JSON.stringify(mine));
        msg.textContent = `${me}님 개인 최고기록 갱신! 랭킹에 반영했어요.`;
      })
      .catch(e => (msg.textContent = e.message + ' 다음 판에 다시 올려 볼게요.'))
      .finally(refresh);
  }

  const css = document.createElement('style');
  css.textContent = `
    .card { max-height: calc(100% - 32px); overflow-y: auto; }
    .board { display: grid; gap: 8px; border-top: 2px dashed rgba(58, 36, 22, .25); padding-top: 12px; }
    .board h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: 18px; }
    .board-form { display: grid; gap: 4px; }
    .board-form label { font-size: 13px; font-weight: 700; }
    .board-form input { min-width: 0; font: inherit; font-size: 16px; padding: 9px 10px; border: 2px solid var(--ink); border-radius: 6px; background: #fff; color: var(--ink); }
    .board ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 196px; overflow-y: auto; font-size: 14px; }
    .board li { display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; padding: 3px 6px; border-radius: 4px; font-variant-numeric: tabular-nums; }
    .board li:nth-child(-n+3) .rank { color: var(--ember); }
    .board li.mine { background: rgba(208, 83, 47, .15); }
    .board li.empty { display: block; opacity: .7; }
    .board .rank { font-family: var(--display); }
    .board .who { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .board-msg { margin: 0; font-size: 14px; color: var(--ember); }
    .board-msg:empty { display: none; }`;
  document.head.append(css);

  return { mount, ready, enabled };
})();
