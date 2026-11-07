const app = document.querySelector('#app');
const roles = ['rohan', 'tara', 'rajiv', 'kabir'];
const roleInfo = {
  rohan: { name: 'Rohan', initials: 'R', greeting: 'The house is ready. Almost.' },
  tara: { name: 'Tara', initials: 'T', greeting: 'One last thing before the aarti.' },
  rajiv: { name: 'Rajiv', initials: 'R', greeting: 'A quiet evening. Let us hope.' },
  kabir: { name: 'Kabir', initials: 'K', greeting: 'Home looks smaller than I remember.' },
};
const appLabels = { inbox: 'Inbox', chats: 'Chats', gallery: 'Gallery', instagram: 'Instagram', hotseat: 'Inspector questions' };
const state = { player: null, playerCode: '', openApp: 'home', openedAddendum: false, acts: {}, busy: false, deliveryTimers: [] };

function bytes(b64) {
  const raw = atob(b64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function decryptBlob(blob, password) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes(blob.salt), iterations: blob.iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const cipher = new Uint8Array([...bytes(blob.data), ...bytes(blob.tag)]);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(blob.iv), tagLength: 128 }, key, cipher);
  return JSON.parse(new TextDecoder().decode(clear));
}

async function readEncrypted(name) {
  const response = await fetch(`./content/${name}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Content unavailable');
  return response.json();
}

function escapeHtml(value = '') {
  return String(value).replaceAll('\u2014', ',').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function login() {
  app.innerHTML = `<section class="login-wrap"><div class="login"><div class="login-mark">🪔</div><div class="eyebrow">Mehra Haveli · Diwali night</div><h1>Come on in</h1><p>Your phone is ready. Choose your character and enter the code you were sent.</p><form id="login-form"><select id="player-role" aria-label="Choose your character"><option value="" selected disabled>Your character</option><option value="rohan">Rohan</option><option value="tara">Tara</option><option value="rajiv">Rajiv</option><option value="kabir">Kabir</option></select><input id="player-code" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" placeholder="Your character code" aria-label="Character code"><button class="primary" type="submit">Unlock phone</button></form><div class="error" id="login-error"></div><p class="hint">Each phone holds its own little corner of the story.</p></div></section>`;
  document.querySelector('#login-form').addEventListener('submit', unlockPlayer);
}

async function unlockPlayer(event) {
  event.preventDefault();
  if (state.busy) return;
  state.busy = true;
  const role = document.querySelector('#player-role').value;
  const code = document.querySelector('#player-code').value.trim().toLowerCase();
  const error = document.querySelector('#login-error');
  if (!role) { error.textContent = 'Choose your character first.'; state.busy = false; return; }
  error.textContent = 'Opening your phone...';
  try {
    const bundle = await decryptBlob(await readEncrypted(role), code);
    state.player = bundle;
    state.playerCode = code;
    state.openApp = 'home';
    home();
    notify(`Welcome back, ${bundle.displayName}.`);
  } catch {
    error.textContent = 'That code did not open this phone. Check the character and code.';
  }
  state.busy = false;
}

function shell(content, active = '') {
  const p = state.player;
  app.innerHTML = `<div class="phone"><div class="status"><span>7:00</span><span>◉ ◉ ▰</span></div><header class="topbar"><div><div class="eyebrow">Mehra Haveli</div><div class="brand">${escapeHtml(p.displayName)}'s phone</div></div><div class="toolbar"><button class="text-button" id="lock-phone">Lock</button><div class="avatar">${escapeHtml(p.displayName[0])}</div></div></header><section class="screen">${content}</section><nav class="bottom-nav">${[['home','⌂','Home'],['inbox','✉','Inbox'],['chats','◌','Chats'],['gallery','▧','Gallery']].map(([key, icon, label]) => `<button class="${active === key ? 'active' : ''}" data-view="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}</nav></div>`;
  document.querySelector('#lock-phone').addEventListener('click', () => { state.deliveryTimers.forEach(clearTimeout); state.deliveryTimers = []; window.speechSynthesis?.cancel(); state.player = null; state.playerCode = ''; state.openedAddendum = false; state.acts = {}; login(); });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
}

function home() {
  const p = state.player;
  const addendum = state.openedAddendum
    ? `<div class="addendum"><div class="addendum-top"><span class="pill">For your eyes only</span><button class="addendum-close" id="close-addendum" type="button">Close note</button></div><p>${escapeHtml(p.nightAddendum)}</p></div>`
    : `<button class="primary" id="open-addendum">Open your night addendum</button>`;
  const unlocked = Object.entries(state.acts).map(([act, payload]) => `<div class="item"><div class="item-head"><span>${escapeHtml(act.replace('act', 'Act '))} is here</span><span class="item-meta">${payload.messages.length} new</span></div>${payload.inPerson ? `<div class="in-person"><span class="pill">Shanta Bai said this in person</span><p>${escapeHtml(payload.inPerson)}</p></div>` : ''}${payload.messages.map((message) => `<p>${escapeHtml(message)}</p>`).join('')}</div>`).join('');
  const instagram = p.role === 'tara' ? '<button class="app-icon" data-view="instagram"><span class="glyph g-insta">◎</span><small>Instagram</small></button>' : '';
  const hotSeat = state.acts.act2 ? '<button class="text-button hotseat-link" id="open-hotseat">Open inspector questions</button>' : '';
  const revealWord = state.acts.act3 ? `<div class="reveal-word"><span>Keep this for the final reveal</span><strong>${escapeHtml(state.acts.act3.revealWord)}</strong></div>` : '';
  shell(`<div class="hello"><div class="diya">🪔</div><div class="eyebrow" style="color:#f2d9c5">Diwali night</div><h1>${escapeHtml(roleInfo[p.role].greeting)}</h1><p>The family is gathering downstairs. Keep your phone close.</p></div><div class="section-title"><h2>Your apps</h2><span>Tap to open</span></div><div class="app-grid"><button class="app-icon" data-view="inbox"><span class="glyph g-mail">✉</span><small>Inbox</small></button><button class="app-icon" data-view="chats"><span class="glyph g-chat">◌</span><small>Chats</small></button><button class="app-icon" data-view="gallery"><span class="glyph g-gallery">▧</span><small>Gallery</small></button>${instagram}</div><div class="section-title"><h2>Before everyone arrives</h2><span>Private</span></div>${addendum}<div class="section-title"><h2>Unlock an act</h2><span>Enter the code announced by Rohan</span></div><div class="unlock"><input id="act-code" autocomplete="off" autocapitalize="characters" placeholder="Act code" aria-label="Act code"><button id="unlock-act">Open</button></div><div id="act-error" class="item-meta" style="margin:8px 4px 0"></div>${hotSeat}${revealWord}${unlocked ? `<div class="section-title"><h2>New arrivals</h2><span>Unlocked</span></div><div class="card">${unlocked}</div>` : ''}`);
  document.querySelector('#open-addendum')?.addEventListener('click', () => { state.openedAddendum = true; home(); notify('Your private note is open.'); });
  document.querySelector('#close-addendum')?.addEventListener('click', () => { state.openedAddendum = false; home(); notify('Night addendum closed.'); });
  document.querySelector('#unlock-act').addEventListener('click', unlockAct);
  document.querySelector('#open-hotseat')?.addEventListener('click', () => showView('hotseat'));
  document.querySelectorAll('.app-icon').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
}

async function unlockAct() {
  if (state.busy) return;
  const input = document.querySelector('#act-code');
  const error = document.querySelector('#act-error');
  const code = input.value.trim().toUpperCase();
  state.busy = true;
  error.textContent = 'Checking the code...';
  for (const act of ['act1', 'act2', 'act3']) {
    if (state.acts[act]) continue;
    try {
      const payload = await decryptBlob(await readEncrypted(act), code);
      const personal = await decryptBlob(await readEncrypted(`${state.player.role}-${act}`), `${state.playerCode}|${code}`);
      const messages = payload.content.split(/\n\s*\n/).map((message) => message.trim()).filter(Boolean);
      if (act === 'act1' && personal.privateDrop) messages.push(personal.privateDrop);
      if (act === 'act2' && personal.privateDrop) messages.push(personal.privateDrop);
      if (act === 'act2' && personal.sealedClue) messages.push(personal.sealedClue);
      if (act === 'act3' && personal.sharedClue) messages.push(personal.sharedClue);
      if (act === 'act3' && personal.privateClue) messages.push(personal.privateClue);
      state.acts[act] = { ...payload, messages: [], inPerson: personal.inPerson || '', hotSeatQuestions: personal.hotSeatQuestions || [], revealWord: personal.revealWord || '', fallbackClue: personal.fallbackClue || '' };
      state.busy = false;
      home();
      if (act === 'act2') showBreakingNewsPrompt();
      messages.forEach((message, index) => state.deliveryTimers.push(setTimeout(() => {
        if (!state.player || !state.acts[act]) return;
        state.acts[act].messages.push(message);
        ping();
        if (state.openApp === 'home') home();
        else showView(state.openApp);
        notify(`${act.replace('act', 'Act ')} message arrived.`);
      }, 800 + index * 1150)));
      if (act === 'act3' && !personal.privateClue && personal.fallbackClue) {
        state.deliveryTimers.push(setTimeout(() => {
          if (!state.player || !state.acts.act3) return;
          state.acts.act3.messages.push(state.acts.act3.fallbackClue);
          ping();
          if (state.openApp === 'home') home(); else showView(state.openApp);
          notify('A private clue is now shared with everyone.');
        }, 180_000));
      }
      return;
    } catch { /* Try the next act bundle. */ }
  }
  error.textContent = 'That code did not unlock an act. Try again.';
  state.busy = false;
}

function showBreakingNewsPrompt() {
  document.querySelector('.breaking-news-prompt')?.remove();
  const prompt = document.createElement('section');
  prompt.className = 'breaking-news-prompt';
  prompt.innerHTML = '<div class="breaking-news-card" role="dialog" aria-modal="true" aria-labelledby="breaking-news-title"><span class="breaking-news-live">LIVE BULLETIN</span><h2 id="breaking-news-title">BREAKING NEWS</h2><p>The TV bulletin is ready.</p><button id="open-breaking-news" type="button">Open breaking news</button><button id="later-breaking-news" class="breaking-news-later" type="button">Later</button></div></section>';
  document.body.append(prompt);
  document.querySelector('#open-breaking-news').addEventListener('click', () => {
    location.href = './tv.html?mode=breaking&return=phone';
  });
  document.querySelector('#later-breaking-news').addEventListener('click', () => prompt.remove());
}

function cardItem(title, body, meta = '') {
  return `<article class="item"><div class="item-head"><span>${escapeHtml(title)}</span><span class="item-meta">${escapeHtml(meta)}</span></div><p>${escapeHtml(body)}</p></article>`;
}

function listStarter(type) {
  const items = (state.player.starterItems || []).filter((item) => item.type === type);
  if (!items.length) return `<div class="item-meta" style="padding:14px 2px">Nothing new here yet.</div>`;
  return items.map((item, i) => cardItem(item.title, item.detail, i === 0 ? 'Tonight' : 'Earlier')).join('');
}

function renderInbox() {
  const items = (state.player.starterItems || []).filter((item) => item.type === 'inbox');
  const rows = items.map((item) => {
    const email = item.email || { from: 'Saved sender', subject: item.title, body: item.detail, timestamp: 'Saved' };
    return `<button class="mail-row" type="button" data-phone-item="${escapeHtml(item.id)}" data-phone-kind="email"><span class="mail-avatar">${escapeHtml(email.from.slice(0, 1))}</span><span class="mail-copy"><span class="mail-top"><b>${escapeHtml(email.from)}</b><small>${escapeHtml(email.timestamp)}</small></span><strong>${escapeHtml(email.subject)}</strong><span class="mail-preview">${escapeHtml(email.body)}</span></span></button>`;
  }).join('');
  const updates = Object.entries(state.acts).flatMap(([act, payload]) => payload.messages.map((message, index) => cardItem(`${act.replace('act', 'Act ')} update ${index + 1}`, message, 'Just now'))).join('');
  return `${rows || '<div class="item-meta" style="padding:14px 2px">Nothing new here yet.</div>'}${updates ? `<div class="section-title"><h2>New arrivals</h2><span>Tonight</span></div>${updates}` : ''}`;
}

function renderChats() {
  const chats = (state.player.starterItems || []).filter((item) => item.type === 'chats');
  if (!chats.length) return '<div class="item-meta" style="padding:14px 2px">Nothing new here yet.</div>';
  return chats.map((item) => {
    const thread = item.thread || { participants: [item.title], messages: [{ sender: item.title, text: chatText(item.detail), kind: item.voice ? 'voice' : 'text' }] };
    const last = thread.messages.at(-1);
    return `<button class="thread-row" type="button" data-phone-item="${escapeHtml(item.id)}" data-phone-kind="chat"><span class="thread-avatar">${escapeHtml((thread.participants[1] || item.title).slice(0, 1))}</span><span class="thread-copy"><span class="thread-top"><b>${escapeHtml(thread.participants[1] || item.title)}</b><small>${escapeHtml(thread.timestamp || 'Earlier')}</small></span><span class="thread-preview">${last?.kind === 'voice' ? '♪ Voice note' : escapeHtml(last?.text || item.detail)}</span></span><span class="thread-chevron">›</span></button>`;
  }).join('');
}

function renderPhoneArtifact(itemId, kind) {
  let item = (state.player.starterItems || []).find((entry) => entry.id === itemId);
  if (!item && kind === 'gallery') {
    const match = itemId.match(/^(act[123])-evidence-(\d+)$/);
    if (match) {
      const act = match[1];
      const evidenceIndex = Number(match[2]);
      const evidence = (state.acts[act]?.messages || []).filter((message) => /crime-scene photo|two more boxes|box of sugar-free/i.test(message))[evidenceIndex];
      if (evidence) item = {
        id: itemId,
        title: `${act.replace('act', 'Act ')} evidence`,
        detail: evidence,
        caption: evidence,
        art: /box/i.test(evidence) ? 'box' : 'photo',
        collection: `${act.replace('act', 'Act ')} evidence`,
        timestamp: 'Unlocked this evening',
      };
    }
  }
  if (!item) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'phone-dialog';
  let content = '';
  if (kind === 'email') {
    const email = item.email || { from: 'Saved sender', to: state.player.displayName, subject: item.title, body: item.detail, timestamp: 'Saved' };
    content = `<div class="email-paper"><div class="email-app-label">MEHRA MAIL <span>${email.kind === 'reminder' ? 'REMINDER' : 'INBOX'}</span></div><h2>${escapeHtml(email.subject)}</h2><div class="email-address"><span class="mail-avatar">${escapeHtml(email.from.slice(0, 1))}</span><div><b>${escapeHtml(email.from)}</b><small>To ${escapeHtml(email.to)} · ${escapeHtml(email.timestamp)}</small></div></div><div class="email-body">${escapeHtml(email.body)}</div>${email.attachment ? `<div class="attachment"><span>▤</span><div><b>${escapeHtml(email.attachment)}</b><small>Saved attachment</small></div><span>›</span></div>` : ''}</div>`;
  } else if (kind === 'chat') {
    const thread = item.thread || { participants: [item.title], messages: [{ sender: item.title, text: chatText(item.detail), kind: item.voice ? 'voice' : 'text' }] };
    content = `<div class="chat-paper"><div class="chat-contact"><span class="thread-avatar">${escapeHtml((thread.participants[1] || item.title).slice(0, 1))}</span><div><b>${escapeHtml(thread.participants[1] || item.title)}</b><small>WhatsApp · ${escapeHtml(thread.timestamp || 'Earlier')}</small></div></div><div class="chat-date">TODAY</div>${thread.messages.map((message) => `<div class="chat-line ${message.sender === 'You' ? 'mine' : ''}"><span class="chat-sender">${escapeHtml(message.sender)}</span>${message.kind === 'voice' ? `<div class="voice chat-voice"><button class="play" type="button" data-speak="${escapeHtml(message.text)}" aria-label="Read transcript aloud">▶</button><span><b>Generated readout</b><small>Text to speech, not a recording.</small><small>${escapeHtml(message.text)}</small></span></div>` : `<p>${escapeHtml(message.text)}</p>`}<small class="chat-time">${message.kind === 'voice' ? '0:07' : '8:14 PM'}</small></div>`).join('')}</div>`;
  } else {
    content = `<div class="photo-paper"><div class="photo-stage">${renderArt(item.art)}</div><div class="photo-caption"><span>GALLERY · ${escapeHtml(item.collection || 'SAVED')}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.caption || item.detail)}</p><small>${escapeHtml(item.timestamp || 'Saved on this phone')}</small></div></div>`;
  }
  dialog.innerHTML = `<button class="dialog-close" type="button" aria-label="Close">×</button>${content}`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.querySelectorAll('[data-speak]').forEach((button) => button.addEventListener('click', () => {
    speakText(button.dataset.speak);
    notify('Generated speech playing.');
  }));
}

function chatText(detail) {
  const quote = String(detail).match(/[“"]([^”"]+)[”"]/);
  return quote?.[1] || detail;
}

function renderArt(kind = 'document') {
  const art = {
    reel: '<svg viewBox="0 0 120 72" aria-hidden="true"><rect x="38" y="4" width="44" height="64" rx="8" fill="#401f1d"/><rect x="43" y="10" width="34" height="52" rx="3" fill="#e5bd80"/><path d="M60 57V36m0 8L52 33m8 6 9-12" fill="none" stroke="#55734a" stroke-width="3" stroke-linecap="round"/><circle cx="69" cy="26" r="7" fill="#e7d171"/><circle cx="69" cy="26" r="2" fill="#8f583d"/></svg>',
    album: '<svg viewBox="0 0 120 72" aria-hidden="true"><rect x="18" y="8" width="84" height="56" rx="4" fill="#f2dfbf"/><rect x="24" y="13" width="32" height="42" fill="#ac7652"/><rect x="64" y="13" width="32" height="42" fill="#b7996d"/><circle cx="40" cy="29" r="8" fill="#e4b48b"/><path d="M27 52c2-12 7-16 13-16s11 4 13 16" fill="#543b37"/><circle cx="80" cy="29" r="8" fill="#ddb08a"/><path d="M67 52c2-12 7-16 13-16s11 4 13 16" fill="#714039"/></svg>',
    photo: '<svg viewBox="0 0 120 72" aria-hidden="true"><rect x="24" y="5" width="72" height="62" rx="3" fill="#fff4df"/><rect x="29" y="10" width="62" height="42" fill="#b69470"/><circle cx="47" cy="28" r="8" fill="#d7a780"/><path d="M34 49c2-12 7-16 13-16s11 4 13 16" fill="#46332d"/><circle cx="73" cy="27" r="8" fill="#bb805e"/><path d="M65 48c1-10 4-14 9-15" fill="none" stroke="#322720" stroke-width="4" stroke-linecap="round"/><path d="M72 55h18" stroke="#d8c7ae" stroke-width="3"/></svg>',
    paper: '<svg viewBox="0 0 120 72" aria-hidden="true"><path d="M38 4h43l10 10v54H38z" fill="#fff8e9"/><path d="M81 4v12h10" fill="#dfcdb5"/><path d="M48 26h32M48 34h32M48 42h22M48 51h32" stroke="#b6a28b" stroke-width="3" stroke-linecap="round"/><circle cx="72" cy="53" r="7" fill="#b34e3c" opacity=".8"/></svg>',
    sign: '<svg viewBox="0 0 120 72" aria-hidden="true"><path d="M27 13h66v42H27z" fill="#47352a" stroke="#e0bd83" stroke-width="3"/><path d="M39 26h42M39 34h42M45 43h30" stroke="#ddc79d" stroke-width="3" stroke-linecap="round"/><path d="M60 55v13" stroke="#d7b879" stroke-width="4"/></svg>',
    box: '<svg viewBox="0 0 120 72" aria-hidden="true"><path d="M31 26 60 11l29 15v36L60 69 31 62z" fill="#9e4c36"/><path d="M31 26 60 41l29-15M60 41v28" fill="none" stroke="#e9c985" stroke-width="3"/><circle cx="50" cy="50" r="5" fill="#f1dbad"/><circle cx="64" cy="55" r="5" fill="#e6c38f"/><circle cx="72" cy="46" r="5" fill="#f1dbad"/></svg>',
    document: '<svg viewBox="0 0 120 72" aria-hidden="true"><path d="M39 5h43l10 10v53H39z" fill="#fff5e3"/><path d="M82 5v12h10M49 28h33M49 36h33M49 44h24M49 53h31" fill="none" stroke="#ad987f" stroke-width="3" stroke-linecap="round"/></svg>',
  };
  return art[kind] || art.document;
}

function showView(view) {
  if (view === 'home') { state.openApp = 'home'; home(); return; }
  state.openApp = view;
  const p = state.player;
  const heading = appLabels[view] || 'Gallery';
  let body = '';
  if (view === 'hotseat') {
    const questions = state.acts.act2?.hotSeatQuestions || [];
    body = `<div class="locked">Keep this screen open during your three minute hot seat.</div><div class="card hotseat-card">${questions.map((question, index) => `<article class="item"><div class="item-head"><span>Question ${index + 1}</span><span class="item-meta">Inspector Qureshi</span></div><p>${escapeHtml(question)}</p></article>`).join('')}</div>`;
  } else if (view === 'inbox') {
    body = `<div class="section-title"><h2>All mail</h2><span>${(p.starterItems || []).filter((item) => item.type === 'inbox').length} saved</span></div><div class="card mail-list">${renderInbox()}</div>`;
  } else if (view === 'chats') {
    const chats = (p.starterItems || []).filter((item) => item.type === 'chats');
    body = `<div class="section-title"><h2>Recent chats</h2><span>${chats.length} thread${chats.length === 1 ? '' : 's'}</span></div><div class="card chat-list">${renderChats()}${Object.entries(state.acts).flatMap(([act, item]) => item.messages.map((message) => `<div class="message">${escapeHtml(message)}</div>`)).join('')}</div>`;
  } else {
    const isInsta = view === 'instagram';
    const gallery = (p.starterItems || []).filter((item) => item.type === 'gallery' && (!isInsta || /reel|instagram|post/i.test(item.detail)));
    const actImages = Object.entries(state.acts).flatMap(([act, data]) => data.messages.filter((message) => /crime-scene photo|two more boxes|box of sugar-free/i.test(message)).map((message, index) => ({ title: `${act.replace('act', 'Act ')} evidence`, detail: message, art: /box/i.test(message) ? 'box' : 'photo', id: `${act}-evidence-${index}` })));
    const allGallery = isInsta ? gallery : [...gallery, ...actImages];
    body = `<div class="section-title"><h2>${isInsta ? '@TaraTastes' : 'Recent memories'}</h2><span>${isInsta ? 'Instagram' : `${allGallery.length} saved items`}</span></div>${allGallery.length ? `<div class="gallery-grid">${allGallery.map((item) => `<button class="gallery-tile" type="button" data-phone-item="${escapeHtml(item.id)}" data-phone-kind="gallery"><span class="gallery-art">${renderArt(item.art)}</span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail.slice(0, 70))}</small></button>`).join('')}</div>` : `<div class="locked">${isInsta ? 'No posts queued yet.' : 'Your photos and documents will show here.'}</div>`}<div class="section-title"><h2>${isInsta ? 'Reel draft' : 'Your dossier'}</h2><span>Private document</span></div><article class="card document">${isInsta ? (gallery.map((item) => escapeHtml(item.detail)).join('\n\n') || 'A Diwali reel is waiting to be posted.') : escapeHtml(p.dossier)}</article>${Object.entries(state.acts).map(([act, item]) => `<div class="section-title"><h2>${escapeHtml(act.replace('act', 'Act '))}</h2></div><article class="card document">${item.messages.map(escapeHtml).join('\n\n')}</article>`).join('')}`;
  }
  shell(`<div class="eyebrow">Your phone</div><h1 style="font:600 28px 'Playfair Display',serif;margin:5px 0 18px">${heading}</h1>${body}`, view);
  document.querySelectorAll('[data-phone-item]').forEach((button) => button.addEventListener('click', () => renderPhoneArtifact(button.dataset.phoneItem, button.dataset.phoneKind)));
}

function notify(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.append(toast);
  if ('vibrate' in navigator) navigator.vibrate(80);
  setTimeout(() => toast.remove(), 2600);
}

function ping() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    setTimeout(() => context.close(), 200);
  } catch { /* Sound is optional on browsers that block audio. */ }
  if ('vibrate' in navigator) navigator.vibrate(55);
}

function speakText(text) {
  if (!text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => /^en-IN$/i.test(voice.lang)) || voices.find((voice) => /^en/i.test(voice.lang)) || null;
  window.speechSynthesis.speak(utterance);
}

login();
