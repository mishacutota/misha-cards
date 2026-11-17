/* Интерфейс MISHA CARDS — коллекционная игра без настоящих денег. */
(function () {
  'use strict';

  const SESSION_KEY = 'misha-bank-session-v1';
  const CARDS = window.BANK_CARDS;
  const store = window.BankStore;
  const el = (id) => document.getElementById(id);
  const state = { key: null, user: null, send: {}, mode: 'login', nextDailyAt: 0 };
  const number = (value) => new Intl.NumberFormat('ru-RU').format(value);
  let toastTimer = null;
  let dailyTimer = null;

  function toast(message, isError) {
    const node = el('toast');
    node.textContent = message;
    node.classList.toggle('error', Boolean(isError));
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 2800);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.switch-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    el('auth-submit').textContent = mode === 'login' ? 'Войти' : 'Создать коллекцию';
    el('auth-pin').value = '';
    el('auth-error').textContent = '';
  }

  function handleAuth(event) {
    event.preventDefault();
    const nick = el('auth-nick').value.trim();
    const pin = el('auth-pin').value.trim();
    const result = state.mode === 'login' ? store.login(nick, pin) : store.register(nick, pin);
    if (!result.ok) {
      el('auth-error').textContent = result.error;
      return;
    }
    try { localStorage.setItem(SESSION_KEY, result.key); } catch (_) { /* приватный режим */ }
    state.key = result.key;
    state.user = store.getUser(result.key);
    state.nextDailyAt = result.daily ? result.daily.nextAt : state.user.lastDailyAt + 86400000;
    el('auth-pin').value = '';
    enterGame();
    if (result.daily && result.daily.issued) {
      const drop = describeCards(result.daily.cards);
      toast(`🎁 Ежедневный дроп: ${drop}`);
    } else {
      toast(state.mode === 'register' ? `Добро пожаловать, ${result.user.nick}!` : `С возвращением, ${result.user.nick}!`);
    }
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) { /* ignore */ }
    clearInterval(dailyTimer);
    state.key = null;
    state.user = null;
    state.send = {};
    el('screen-bank').classList.add('hidden');
    el('screen-auth').classList.remove('hidden');
    el('auth-pin').value = '';
    el('auth-error').textContent = '';
    setMode('login');
  }

  function enterGame() {
    el('screen-auth').classList.add('hidden');
    el('screen-bank').classList.remove('hidden');
    state.send = {};
    el('to-nick').value = '';
    renderAll();
    switchTab('wallet');
    clearInterval(dailyTimer);
    dailyTimer = setInterval(renderDaily, 30000);
  }

  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.panel !== tab));
  }

  function renderHeader() {
    if (!state.user) return;
    el('user-nick').textContent = state.user.nick;
    el('user-avatar').textContent = state.user.nick.slice(0, 1).toUpperCase();
    el('user-since').textContent = 'играет с ' + new Date(state.user.createdAt).toLocaleDateString('ru-RU');
    const sparks = store.total(state.user.inventory);
    el('top-balance').textContent = `${number(sparks)} ✨`;
    el('wallet-balance').textContent = number(sparks);
    el('wallet-count').textContent = String(store.countCards(state.user.inventory));
  }

  function describeCards(inventory) {
    return CARDS.filter(card => inventory[card.id] > 0)
      .map(card => `${card.emoji} ${card.name}${inventory[card.id] > 1 ? ` ×${inventory[card.id]}` : ''}`)
      .join(', ') || 'тираж закончился';
  }

  function renderDaily() {
    if (!state.user) return;
    const remaining = Math.max(0, state.nextDailyAt - Date.now());
    const canDrop = !remaining;
    el('daily-banner').classList.toggle('daily-ready', canDrop);
    el('daily-title').textContent = canDrop ? 'Ежедневный дроп готов!' : 'Следующие карточки скоро';
    el('daily-sub').textContent = canDrop ? 'Зайди снова, чтобы получить новые карточки' : 'Карточки появляются автоматически при входе';
    if (canDrop) {
      el('daily-timer').textContent = '🎁 готово';
    } else {
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      el('daily-timer').textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  function cardTile(card, amount) {
    return `
      <article class="card-tile rarity-${card.rarityKey}" style="--card-bg:${card.bg};--card-glow:${card.glow}">
        <span class="card-orbit card-orbit-a" aria-hidden="true"></span>
        <span class="card-orbit card-orbit-b" aria-hidden="true"></span>
        <div class="card-top">
          <span class="card-rarity">${escapeHtml(card.rarity)}</span>
          <span class="card-qty">×${amount}</span>
        </div>
        <div class="card-art" aria-hidden="true">${card.emoji}</div>
        <div class="card-copy">
          <div class="card-name">${escapeHtml(card.name)}</div>
          <div class="card-tag">${escapeHtml(card.tag)}</div>
        </div>
        <div class="card-foot"><span>${number(card.spark)} ✨</span><span>MISHA CARDS</span></div>
      </article>`;
  }

  function renderWallet() {
    const owned = CARDS.filter(card => state.user.inventory[card.id] > 0);
    el('wallet-grid').innerHTML = owned.length
      ? owned.map(card => cardTile(card, state.user.inventory[card.id])).join('')
      : '<div class="empty">Пока пустая полка — ежедневные карточки уже скоро! ✨</div>';

    const history = store.getHistory(state.key);
    if (!history.length) {
      el('history-list').innerHTML = '<li class="hist-item"><div class="hist-main"><strong>Пока пусто</strong><small>Здесь появятся дропы и подарки</small></div></li>';
      return;
    }
    el('history-list').innerHTML = history.map(item => {
      const score = store.total(item.cards);
      let label = item.memo;
      if (item.type === 'out') label = `🎁 → ${item.peer}`;
      if (item.type === 'in') label = `🎁 ← ${item.peer}`;
      if (item.type === 'daily') label = '🎁 Ежедневный дроп';
      const sign = item.type === 'out' ? '−' : '+';
      return `
        <li class="hist-item ${item.type === 'out' ? 'out' : 'in'}">
          <div class="hist-main">
            <strong>${escapeHtml(label)}</strong>
            <small>${escapeHtml(describeCards(item.cards))} · ${new Date(item.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
          </div>
          <span class="hist-amount">${sign}${number(score)} ✨</span>
        </li>`;
    }).join('');
  }

  function renderSend() {
    const owned = CARDS.filter(card => state.user.inventory[card.id] > 0);
    if (!owned.length) {
      el('send-rows').innerHTML = '<div class="empty">Пока нечего дарить — дождись ежедневного дропа! 🎁</div>';
      el('send-total-value').textContent = '0';
      el('send-total-count').textContent = 'ничего не выбрано';
      el('btn-send').disabled = true;
      return;
    }
    el('send-rows').innerHTML = owned.map(card => {
      const picked = state.send[card.id] || 0;
      const have = state.user.inventory[card.id];
      return `
        <div class="send-row ${picked ? 'picked' : ''}" data-card="${card.id}">
          <div class="send-mini rarity-${card.rarityKey}" style="--card-bg:${card.bg}">${card.emoji}</div>
          <div class="send-info">
            <strong>${escapeHtml(card.name)} <span class="rarity-label">${escapeHtml(card.rarity)}</span></strong>
            <small>${have} шт · ${number(card.spark)} ✨ за карточку</small>
          </div>
          <div class="stepper">
            <button type="button" data-act="minus" aria-label="Меньше" ${picked <= 0 ? 'disabled' : ''}>−</button>
            <span class="stepper-val">${picked}</span>
            <button type="button" data-act="plus" aria-label="Больше" ${picked >= have ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
    }).join('');
    updateSendTotals();
  }

  function updateSendTotals() {
    const spark = CARDS.reduce((sum, card) => sum + (state.send[card.id] || 0) * card.spark, 0);
    const count = store.countCards(state.send);
    el('send-total-value').textContent = number(spark);
    el('send-total-count').textContent = count ? `${count} карточек · ${number(spark)} ✨` : 'ничего не выбрано';
    const recipient = store.findUser(el('to-nick').value);
    el('btn-send').disabled = !count || !recipient || recipient.key === state.key;
    updateRecipientHint(recipient);
  }

  function updateRecipientHint(recipient) {
    const hint = el('send-hint');
    const note = el('send-note');
    const raw = el('to-nick').value.trim();
    if (!raw) { hint.textContent = ''; note.textContent = ''; return; }
    if (!recipient) {
      hint.textContent = 'Игрок с таким ником не найден в этом браузере.';
      note.textContent = 'Проверь ник. Подарки доступны только между профилями в этой коллекции.';
      return;
    }
    if (recipient.key === state.key) {
      hint.textContent = 'Это твоя коллекция 🙂 Выбери другого игрока.';
      note.textContent = '';
      return;
    }
    hint.textContent = `${recipient.nick} · ${number(store.countCards(recipient.inventory))} карточек в коллекции`;
    note.textContent = '';
  }

  function changeAmount(cardId, delta) {
    const have = state.user.inventory[cardId] || 0;
    const next = Math.max(0, Math.min(have, (state.send[cardId] || 0) + delta));
    if (next) state.send[cardId] = next;
    else delete state.send[cardId];
    renderSend();
  }

  function doTransfer() {
    const result = store.transfer(state.key, el('to-nick').value.trim(), state.send);
    if (!result.ok) { toast(result.error, true); return; }
    state.user = store.getUser(state.key);
    state.send = {};
    renderAll();
    toast(`🎁 Карточки отправлены игроку ${result.recipient}!`);
  }

  function renderBank() {
    const stock = store.getStock();
    el('supply-list').innerHTML = CARDS.map(card => {
      const left = stock[card.id];
      const minted = card.limit - left;
      const percent = Math.round((minted / card.limit) * 100);
      return `
        <div class="supply-item rarity-row rarity-${card.rarityKey}">
          <div class="supply-head">
            <span>${card.emoji} ${escapeHtml(card.name)} <small class="rarity-label">${escapeHtml(card.rarity)}</small></span>
            <span>${left} / ${card.limit} в тираже</span>
          </div>
          <div class="bar" role="img" aria-label="выдано ${percent}%"><i style="width:${percent}%;background:${card.glow}"></i></div>
        </div>`;
    }).join('');

    const top = store.getLeaderboard();
    el('leaderboard').innerHTML = top.length
      ? top.map((row, index) => `
          <li class="${row.key === state.key ? 'me' : ''}">
            <span class="lb-rank">${index + 1}</span>
            <span class="lb-nick">${escapeHtml(row.nick)}</span>
            <span class="lb-sum">${number(row.value)} ✨</span>
          </li>`).join('')
      : '<li><span class="lb-nick muted">Пока один ты</span></li>';
  }

  function renderAll() {
    renderHeader();
    renderDaily();
    renderWallet();
    renderSend();
    renderBank();
  }

  function makeDemo() {
    const result = store.createDemoUsers();
    if (!result.created) toast('Демо-игроки уже созданы', true);
    else toast(`Создано игроков: ${result.created}. Можно дарить им карточки!`);
    renderAll();
  }

  function exportJson() {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'misha-cards-backup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Резервная копия коллекции выгружена');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = store.importData(String(reader.result || ''));
      if (!result.ok) { toast(result.error, true); return; }
      const session = store.findUser(state.user ? state.user.nick : '');
      if (session) {
        state.key = session.key;
        state.user = store.getUser(session.key);
        renderAll();
        toast('Коллекция загружена');
      } else {
        logout();
        toast('Данные загружены. Войди под своим ником');
      }
    };
    reader.readAsText(file);
  }

  function bind() {
    document.querySelectorAll('.switch-btn').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
    el('auth-form').addEventListener('submit', handleAuth);
    el('btn-logout').addEventListener('click', logout);
    document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    el('send-rows').addEventListener('click', event => {
      const button = event.target.closest('button[data-act]');
      if (!button) return;
      const row = button.closest('[data-card]');
      if (row) changeAmount(row.dataset.card, button.dataset.act === 'plus' ? 1 : -1);
    });
    el('to-nick').addEventListener('input', event => {
      event.target.value = event.target.value.replace(/\s/g, '');
      updateSendTotals();
    });
    el('btn-send').addEventListener('click', doTransfer);
    el('btn-demo').addEventListener('click', makeDemo);
    el('btn-export').addEventListener('click', exportJson);
    el('import-file').addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      if (file) importJson(file);
      event.target.value = '';
    });
  }

  function boot() {
    bind();
    setMode('login');
    let savedKey = null;
    try { savedKey = localStorage.getItem(SESSION_KEY); } catch (_) { /* ignore */ }
    const user = savedKey ? store.getUser(savedKey) : null;
    if (savedKey && user) {
      state.key = savedKey;
      const result = store.login(user.nick, '');
      /* Сессия остаётся локальной; не запрашиваем ПИН повторно при перезагрузке. */
      if (result.ok) {
        state.user = store.getUser(savedKey);
        state.nextDailyAt = result.daily.nextAt;
        enterGame();
      } else {
        /* Восстанавливаем сессию без повторной проверки ПИН; ежедневный дроп выдаётся один раз. */
        store.claimDaily(savedKey);
        state.user = store.getUser(savedKey);
        state.nextDailyAt = state.user.lastDailyAt + 86400000;
        enterGame();
      }
    } else {
      el('screen-auth').classList.remove('hidden');
      el('screen-bank').classList.add('hidden');
    }
  }

  boot();
})();
