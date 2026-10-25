// 비틀낙타 랭킹: Supabase의 scores 테이블에 기록을 올리고 모드별 TOP 10을 보여준다.
// 아래 두 값을 Supabase 프로젝트 설정(Project Settings → API)에서 복사해 넣으면 켜진다.
// 비어 있으면 랭킹 없이 게임만 돌아간다. anon 키는 공개용 키라 페이지에 넣어도 된다.
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

  async function top(mode) {
    const q = `select=name,dist,time&mode=eq.${mode}&order=dist.desc,time.asc&limit=10`;
    const r = await fetch(`${BOARD.url}/rest/v1/scores?${q}`, { headers: headers() });
    if (!r.ok) throw new Error('랭킹을 불러오지 못했어요 (' + r.status + ')');
    return r.json();
  }

  async function submit(row) {
    const r = await fetch(`${BOARD.url}/rest/v1/scores`, {
      method: 'POST', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error('기록을 올리지 못했어요 (' + r.status + ')');
  }

  function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }

  // 이름은 다른 사람이 입력한 값이라 textContent로만 넣는다.
  function render(ol, list, mine) {
    ol.replaceChildren();
    if (!list.length) {
      const li = document.createElement('li'); li.className = 'empty'; li.textContent = '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요.';
      ol.append(li);
      return;
    }
    list.forEach((s, i) => {
      const li = document.createElement('li');
      if (mine && s.name === mine.name && Number(s.dist) === mine.dist && Number(s.time) === mine.time) li.className = 'mine';
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = i + 1;
      const name = document.createElement('span'); name.className = 'who'; name.textContent = s.name;
      const score = document.createElement('span'); score.className = 'score';
      score.textContent = `${Number(s.dist).toFixed(1)}m · ${Number(s.time).toFixed(1)}초`;
      li.append(rank, name, score);
      ol.append(li);
    });
  }

  // card: 패널 카드, run: 이번 판 기록 {dist, time} (시작 화면이면 없음)
  function mount(card, mode, run) {
    if (!enabled()) return;
    const box = document.createElement('section');
    box.className = 'board';
    box.innerHTML = `
      <h2>${mode === 'hard' ? '하드' : '일반'} 랭킹 TOP 10</h2>
      ${run ? `<form class="board-form">
        <input id="board-name" maxlength="12" placeholder="이름 (12자까지)" autocomplete="nickname" required>
        <button type="submit">기록 등록</button>
      </form>` : ''}
      <ol></ol>
      <p class="board-msg" role="status"></p>`;
    card.insertBefore(box, card.querySelector('#go'));
    const ol = box.querySelector('ol'), msg = box.querySelector('.board-msg');
    const refresh = mine => top(mode).then(list => render(ol, list, mine)).catch(e => (msg.textContent = e.message));
    msg.textContent = '랭킹 불러오는 중…';
    refresh().then(() => { if (msg.textContent === '랭킹 불러오는 중…') msg.textContent = ''; });

    const form = box.querySelector('form');
    if (!form) return;
    const input = form.querySelector('input');
    input.value = savedName();
    if (run.dist < 1) { form.hidden = true; msg.textContent = '1m 이상 가야 기록을 올릴 수 있어요.'; return; }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = input.value.trim().slice(0, 12);
      if (!name) return;
      const btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = '올리는 중…';
      const row = { name, mode, dist: Math.round(run.dist * 10) / 10, time: Math.round(run.time * 10) / 10 };
      try {
        await submit(row);
        saveName(name);
        form.hidden = true;
        msg.textContent = `${name}님 기록이 등록됐어요.`;
        refresh(row);
      } catch (err) {
        btn.disabled = false; btn.textContent = '기록 등록';
        msg.textContent = err.message + ' 잠시 뒤 다시 눌러 주세요.';
      }
    });
  }

  const css = document.createElement('style');
  css.textContent = `
    .card { max-height: calc(100% - 32px); overflow-y: auto; }
    .board { display: grid; gap: 8px; border-top: 2px dashed rgba(58, 36, 22, .25); padding-top: 12px; }
    .board h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: 18px; }
    .board-form { display: flex; gap: 8px; }
    .board-form[hidden] { display: none; }
    .board-form input { flex: 1; min-width: 0; font: inherit; font-size: 15px; padding: 8px 10px; border: 2px solid var(--ink); border-radius: 6px; background: #fff; color: var(--ink); }
    .board-form button { font-family: var(--display); font-size: 15px; padding: 8px 12px; border: 0; border-radius: 6px; background: var(--ink); color: var(--paper); cursor: pointer; box-shadow: none; }
    .board ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 196px; overflow-y: auto; font-size: 14px; }
    .board li { display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; padding: 3px 6px; border-radius: 4px; font-variant-numeric: tabular-nums; }
    .board li:nth-child(-n+3) .rank { color: var(--ember); }
    .board li.mine { background: rgba(208, 83, 47, .15); }
    .board li.empty { display: block; opacity: .7; }
    .board .rank { font-family: var(--display); }
    .board .who { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .board-msg { margin: 0; font-size: 13px; opacity: .75; }
    .board-msg:empty { display: none; }`;
  document.head.append(css);

  return { mount, enabled };
})();
