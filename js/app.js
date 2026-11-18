/* Интерфейс MISHA CARDS — коллекционная игра без настоящих денег. */
(function () {
  'use strict';

  const SESSION_KEY = 'misha-bank-session-v1';
  const CARDS = window.BANK_CARDS;
  const store = window.BankStore;
  const el = (id) => document.getElementById(id);
  const state = { key: null, user: null, send: {}, adminSend: {}, adminTargetKey: '', adminAmounts: {}, mode: 'login', nextDailyAt: 0, busy: false, isAdmin: false, lastRecipient: '', netDown: false };
  const number = (value) => new Intl.NumberFormat('ru-RU').format(value);
  let toastTimer = null;
  let dailyTimer = null;
  let syncTimer = null;
  let searchTimer = null;
  let lastSyncAt = 0;

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

  function setBusy(value) {
    state.busy = value;
    const submit = el('auth-submit');
    if (submit) submit.disabled = value;
    const send = el('btn-send');
    if (send) send.disabled = value || send.disabled;
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.switch-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    el('auth-submit').textContent = mode === 'login' ? 'Войти' : 'Создать коллекцию';
    el('auth-pin').value = '';
    el('auth-error').textContent = '';
  }

  async function handleAuth(event) {
    event.preventDefault();
    if (state.busy) return;
    const nick = el('auth-nick').value.trim();
    const pin = el('auth-pin').value.trim();
    setBusy(true);
    const result = state.mode === 'login' ? await store.login(nick, pin) : await store.register(nick, pin);
    setBusy(false);
    if (!result.ok) {
      el('auth-error').textContent = result.error;
      return;
    }
    try { localStorage.setItem(SESSION_KEY, result.key); } catch (_) { /* приватный режим */ }
    state.key = result.key;
    state.user = store.getUser(result.key);
    state.nextDailyAt = result.daily ? result.daily.nextAt : state.user.lastDailyAt + 86400000;
    state.isAdmin = (result.key === 'admin');
    el('auth-pin').value = '';
    await enterGame();
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
    clearInterval(syncTimer);
    document.removeEventListener('visibilitychange', handleVisibility);
    lastSyncAt = 0;
    state.key = null;
    state.user = null;
    state.send = {};
    state.adminSend = {};
    state.isAdmin = false;
    el('screen-bank').classList.add('hidden');
    el('screen-auth').classList.remove('hidden');
    el('auth-pin').value = '';
    el('auth-error').textContent = '';
    setMode('login');
  }

  async function enterGame() {
    el('screen-auth').classList.add('hidden');
    el('screen-bank').classList.remove('hidden');
    state.send = {};
    state.adminSend = {};
    el('to-nick').value = '';
    updateAdminVisibility();
    if (state.isAdmin) {
      try { await store.purgeTestAccounts(); } catch (_) { /* ignore */ }
    }
    await syncFromServer(true);
    renderAll();
    switchTab('wallet');
    clearInterval(dailyTimer);
    dailyTimer = setInterval(() => { renderDaily(); tryAutoDaily(); }, 15000);
    clearInterval(syncTimer);
    syncTimer = setInterval(() => { if (document.visibilityState === 'visible') syncFromServer(false); }, 30000);
    document.removeEventListener('visibilitychange', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  function updateAdminVisibility() {
    const tab = el('tab-admin');
    if (tab) tab.classList.toggle('hidden', !state.isAdmin);
    if (!state.isAdmin && document.querySelector('.tab.active') && document.querySelector('.tab.active').dataset.tab === 'admin') {
      switchTab('wallet');
    }
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible' && state.key) syncFromServer(false);
  }

  async function tryAutoDaily() {
    if (!state.key || state.busy) return;
    const user = store.getUser(state.key);
    if (!user) return;
    if (Date.now() - (user.lastDailyAt || 0) < 86400000) return;
    state.busy = true;
    const result = await store.claimDaily(state.key);
    state.busy = false;
    if (result && result.ok) {
      state.user = store.getUser(state.key);
      state.nextDailyAt = result.daily ? result.daily.nextAt : state.user.lastDailyAt + 86400000;
      renderAll();
      if (result.daily && result.daily.issued) toast(`🎁 Новый ежедневный дроп: ${describeCards(result.daily.cards)}`);
    }
  }

  async function syncFromServer(force) {
    if (!state.key || state.busy) return;
    const now = Date.now();
    if (!force && now - lastSyncAt < 30000) return;
    lastSyncAt = now;
    const prevInventory = state.user ? JSON.stringify(state.user.inventory) : null;
    const ok = await store.pull();
    state.user = store.getUser(state.key);
    if (!ok) {
      state.netDown = true;
      updateOfflineState();
    } else {
      state.netDown = false;
      updateOfflineState();
    }
    if (state.user) {
      if (prevInventory && JSON.stringify(state.user.inventory) !== prevInventory) {
        toast('✨ Баланс обновлён');
      }
      state.nextDailyAt = state.user.lastDailyAt + 86400000;
      renderAll();
    } else {
      toast('Твой профиль удалён или не найден', true);
      logout();
    }
  }

  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.panel !== tab));
    if (tab === 'admin') renderAdmin();
  }

  function renderHeader() {
    if (!state.user) return;
    el('user-nick').textContent = state.user.nick;
    el('user-avatar').textContent = state.user.nick.slice(0, 1).toUpperCase();
    el('user-since').textContent = 'с нами с ' + new Date(state.user.createdAt).toLocaleDateString('ru-RU');
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
    el('daily-sub').textContent = canDrop ? 'Новые карточки появятся автоматически' : 'Карточки появляются автоматически при входе';
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
        <div class="card-art"><span class="card-emoji">${card.emoji}</span></div>
        <div class="card-copy">
          <div class="card-name">${escapeHtml(card.name)}</div>
        </div>
        <div class="card-foot"><span>${number(card.spark)} ✨</span><span>MISHA CARDS</span></div>
      </article>`;
  }

  function renderWallet() {
    if (!state.user) return;
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

  function renderRecentRecipients() {
    const box = el('recent-recipients');
    if (!box) return;
    const list = (state.user && Array.isArray(state.user.recentRecipients)) ? state.user.recentRecipients : [];
    if (!list.length) { box.innerHTML = ''; box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = '<span class="recent-label">Недавние получатели:</span>' + list.map(nik =>
      `<button type="button" class="recent-chip" data-nick="${escapeHtml(nik)}">${escapeHtml(nik)}</button>`
    ).join('');
  }

  function renderNickSuggestions() {
    const box = el('nick-suggestions');
    if (!box) return;
    const raw = el('to-nick').value.trim().toLowerCase();
    if (!raw) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const users = store.getUsers().filter(u => u.key !== state.key);
    const matches = users.filter(u => u.nick.toLowerCase().startsWith(raw) || u.nick.toLowerCase().includes(raw)).slice(0, 8);
    if (!matches.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML = matches.map(u =>
      `<li class="nick-suggestion" data-nick="${escapeHtml(u.nick)}">${escapeHtml(u.nick)}</li>`
    ).join('');
  }

  function renderSend() {
    if (!state.user) return;
    renderRecentRecipients();
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
          <div class="send-mini rarity-${card.rarityKey}" style="--card-bg:${card.bg}"><span class="send-emoji">${card.emoji}</span></div>
          <div class="send-info">
            <strong>${escapeHtml(card.name)}</strong>
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
    const recipient = store.findUser(el('to-nick').value.trim());
    el('btn-send').disabled = state.busy || !count || !recipient || recipient.key === state.key;
    updateRecipientHint(recipient);
  }

  async function searchRecipient() {
    if (!state.key) return;
    const raw = el('to-nick').value.trim();
    if (!raw) { updateSendTotals(); return; }
    const hint = el('send-hint');
    let recipient = store.findUser(raw);
    if (!recipient) {
      if (hint) hint.textContent = 'Ищем игрока в общей коллекции…';
      await store.pull();
      state.user = store.getUser(state.key);
      recipient = store.findUser(raw);
    }
    if (recipient && recipient.key !== state.key) {
      if (hint) hint.textContent = '';
    } else if (recipient && recipient.key === state.key) {
      if (hint) hint.textContent = 'Это твоя коллекция 🙂 Выбери другого игрока.';
    } else {
      if (hint) hint.textContent = 'Игрок с таким ником не найден в общей коллекции.';
    }
    updateSendTotals();
  }

  function updateRecipientHint(recipient) {
    const hint = el('send-hint');
    const note = el('send-note');
    const raw = el('to-nick').value.trim();
    if (!raw) { hint.textContent = ''; note.textContent = ''; return; }
    if (!recipient) {
      hint.textContent = 'Игрок с таким ником не найден в общей коллекции.';
      note.textContent = 'Проверь ник. Подарки доступны всем игрокам, которые зарегистрировались.';
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

  async function doTransfer() {
    if (state.busy) return;
    const count = store.countCards(state.send);
    if (!count) { toast('Выбери карточки для подарка', true); return; }
    // pull fresh so recipient lookup is accurate across browsers
    await store.pull();
    state.user = store.getUser(state.key);
    const raw = el('to-nick').value.trim();
    const recipient = store.findUser(raw);
    if (!recipient || recipient.key === state.key) { toast('Проверь ник получателя', true); updateSendTotals(); return; }
    // запоминаем ник для следующего перевода
    state.lastRecipient = raw;
    setBusy(true);
    el('btn-send').disabled = true;
    const result = await store.transfer(state.key, raw, state.send);
    setBusy(false);
    if (!result.ok) { toast(result.error, true); updateSendTotals(); return; }
    state.user = store.getUser(state.key);
    state.send = {};
    el('to-nick').value = '';
    renderAll();
    toast(`🎁 Карточки отправлены игроку ${recipient.nick}!`);
  }

  function renderBank() {
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

  function renderAdmin() {
    const users = store.getUsers().filter(u => u.key !== 'admin');
    const sel = el('admin-target');
    const prev = state.adminTargetKey;
    sel.innerHTML = '<option value="">— выбери игрока —</option>' +
      users.map(u => `<option value="${escapeHtml(u.key)}">${escapeHtml(u.nick)}</option>`).join('');
    if (prev && users.some(u => u.key === prev)) sel.value = prev;
    else if (users.length) { sel.value = users[0].key; state.adminTargetKey = users[0].key; }
    else { sel.value = ''; state.adminTargetKey = ''; }
    state.adminTargetKey = sel.value;

    const profile = el('admin-profile');
    const rows = el('admin-card-rows');
    if (!state.adminTargetKey) {
      profile.innerHTML = '<div class="empty">Выбери игрока, чтобы увидеть его коллекцию</div>';
      rows.innerHTML = '';
      return;
    }
    const user = store.getUser(state.adminTargetKey);
    if (!user) {
      profile.innerHTML = '<div class="empty">Игрок не найден</div>';
      rows.innerHTML = '';
      return;
    }
    profile.innerHTML = `
      <div class="admin-profile-card">
        <div class="admin-profile-main">
          <div class="avatar">${escapeHtml(user.nick.slice(0, 1).toUpperCase())}</div>
          <div class="admin-profile-meta">
            <strong>${escapeHtml(user.nick)}</strong>
            <span class="muted small">с нами с ${new Date(user.createdAt).toLocaleDateString('ru-RU')} · ${store.countCards(user.inventory)} карточек · ${number(store.total(user.inventory))} ✨</span>
          </div>
        </div>
        <button type="button" class="btn danger small" data-del-user="${escapeHtml(state.adminTargetKey)}">Удалить профиль</button>
      </div>`;

    rows.innerHTML = CARDS.map(card => {
      const have = user.inventory[card.id] || 0;
      const amount = state.adminAmounts[card.id] || 0;
      return `
        <div class="admin-card-row" data-card="${card.id}">
          <div class="send-mini rarity-${card.rarityKey}" style="--card-bg:${card.bg}"><span class="send-emoji">${card.emoji}</span></div>
          <div class="send-info">
            <strong>${escapeHtml(card.name)}</strong>
            <small>у игрока: ${have} шт · ${number(card.spark)} ✨ за карточку</small>
          </div>
          <div class="admin-actions">
            <input class="admin-amount" type="number" min="1" step="1" inputmode="numeric" data-card="${card.id}" value="${amount || ''}" placeholder="0" />
            <button type="button" class="btn primary small" data-act="add" data-card="${card.id}">Добавить</button>
            <button type="button" class="btn ghost small" data-act="remove" data-card="${card.id}">Забрать</button>
          </div>
        </div>`;
    }).join('');
  }

  async function doDeleteUser(key) {
    if (state.busy) return;
    if (!window.confirm('Удалить этого игрока? Действие нельзя отменить.')) return;
    setBusy(true);
    const result = await store.deleteUser(key);
    setBusy(false);
    if (!result.ok) { toast(result.error, true); return; }
    toast('Пользователь удалён');
    if (state.adminTargetKey === key) state.adminTargetKey = '';
    state.adminAmounts = {};
    renderAdmin();
    renderBank();
  }

  async function doAdjustCard(cardId, mode) {
    if (state.busy) return;
    const amount = Number(state.adminAmounts[cardId] || 0);
    if (!Number.isInteger(amount) || amount <= 0) { toast('Укажи количество карточек', true); return; }
    const target = state.adminTargetKey;
    if (!target) { toast('Выбери игрока', true); return; }
    setBusy(true);
    const result = await store.adjustUserCards(target, cardId, amount, mode);
    setBusy(false);
    if (!result.ok) { toast(result.error, true); return; }
    if (mode === 'remove' && result.removedMax) toast(`Забрано ${result.adjusted} (максимум)`);
    else toast(mode === 'add' ? 'Карточки добавлены' : 'Карточки забраны');
    state.adminAmounts[cardId] = 0;
    if (state.key) state.user = store.getUser(state.key);
    renderAdmin();
    renderBank();
  }

  async function doClearHistory() {
    if (state.busy || !state.key) return;
    if (!window.confirm('Очистить всю историю? Действие нельзя отменить.')) return;
    setBusy(true);
    const result = await store.clearHistory(state.key);
    setBusy(false);
    if (!result.ok) { toast(result.error, true); return; }
    toast('История очищена');
    renderWallet();
  }

  function renderAll() {
    renderHeader();
    renderWallet();
    renderSend();
    renderBank();

    if (state.isAdmin && document.querySelector('[data-panel="admin"]:not(.hidden)')) renderAdmin();
    // запоминаем ник при открытии экрана подарка
    if (state.key && !el('to-nick').value && state.lastRecipient) {
      el('to-nick').value = state.lastRecipient;
    }
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

  async function importJson(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      const result = await store.importData(String(reader.result || ''));
      setBusy(false);
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
      renderNickSuggestions();
      updateSendTotals();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(searchRecipient, 900);
    });
    el('to-nick').addEventListener('focus', () => {
      store.pull().then(() => { state.user = store.getUser(state.key); renderNickSuggestions(); });
    });
    el('to-nick').addEventListener('blur', () => {
      setTimeout(() => { const b = el('nick-suggestions'); if (b) b.classList.add('hidden'); }, 150);
    });
    el('btn-send').addEventListener('click', doTransfer);
    const refresh = el('btn-refresh');
    if (refresh) refresh.addEventListener('click', () => syncFromServer(true));

    const sug = el('nick-suggestions');
    if (sug) sug.addEventListener('click', event => {
      const item = event.target.closest('.nick-suggestion');
      if (!item) return;
      el('to-nick').value = item.dataset.nick;
      const b = el('nick-suggestions'); if (b) { b.classList.add('hidden'); b.innerHTML = ''; }
      updateSendTotals();
      searchRecipient();
    });
    const recent = el('recent-recipients');
    if (recent) recent.addEventListener('click', event => {
      const chip = event.target.closest('.recent-chip');
      if (!chip) return;
      el('to-nick').value = chip.dataset.nick;
      updateSendTotals();
      searchRecipient();
    });

    const adminRows = el('admin-card-rows');
    if (adminRows) {
      adminRows.addEventListener('click', event => {
        const button = event.target.closest('button[data-act][data-card]');
        if (!button) return;
        doAdjustCard(button.dataset.card, button.dataset.act);
      });
      adminRows.addEventListener('input', event => {
        const input = event.target.closest('input.admin-amount[data-card]');
        if (!input) return;
        const value = Math.max(0, parseInt(input.value, 10) || 0);
        state.adminAmounts[input.dataset.card] = value;
        if (String(value) !== input.value) input.value = value ? String(value) : '';
      });
    }

    const adminTarget = el('admin-target');
    if (adminTarget) adminTarget.addEventListener('change', () => {
      state.adminTargetKey = adminTarget.value;
      state.adminAmounts = {};
      renderAdmin();
    });

    const panelAdmin = el('panel-admin');
    if (panelAdmin) panelAdmin.addEventListener('click', event => {
      const button = event.target.closest('button[data-del-user]');
      if (button) doDeleteUser(button.dataset.delUser);
    });

    const btnClearHistory = el('btn-clear-history');
    if (btnClearHistory) btnClearHistory.addEventListener('click', doClearHistory);
  }

  let booted = false;
  let bound = false;

  function updateOfflineState() {
    const overlay = el('offline-overlay');
    if (!overlay) return;
    const online = navigator.onLine !== false && !state.netDown;
    overlay.classList.toggle('hidden', online);
  }

  async function boot() {
    if (navigator.onLine === false) {
      state.netDown = true;
      updateOfflineState();
      setTimeout(boot, 2000);
      return;
    }
    if (booted) return;
    if (!bound) { bound = true; bind(); }
    booted = true;
    setMode('login');
    const ok = await store.pull();

    if (!ok) {
      state.netDown = true;
      booted = false;
      updateOfflineState();
      setTimeout(boot, 3000);
      return;
    }
    state.netDown = false;
    updateOfflineState();
    let savedKey = null;
    try { savedKey = localStorage.getItem(SESSION_KEY); } catch (_) { /* ignore */ }
    const user = savedKey ? store.getUser(savedKey) : null;
    if (savedKey && user) {
      state.key = savedKey;
      state.isAdmin = (savedKey === 'admin');
      const result = await store.claimDaily(savedKey);
      state.user = store.getUser(savedKey);
      if (!state.user) { logout(); return; }
      state.nextDailyAt = (result && result.daily) ? result.daily.nextAt : state.user.lastDailyAt + 86400000;
      await enterGame();
      if (result && result.daily && result.daily.issued) {
        toast(`🎁 Ежедневный дроп: ${describeCards(result.daily.cards)}`);
      }
    } else {
      el('screen-auth').classList.remove('hidden');
      el('screen-bank').classList.add('hidden');
    }
  }

  updateOfflineState();
  window.addEventListener('online', () => {
    state.netDown = false;
    updateOfflineState();
    if (!booted) boot();
    else if (state.key) syncFromServer(true);
  });
  window.addEventListener('offline', () => {
    state.netDown = true;
    updateOfflineState();
  });
  boot();
  setInterval(updateOfflineState, 3000);
})();
