const app = document.querySelector('#tv-app');
const query = new URLSearchParams(location.search);
const mode = query.get('mode') || 'home';
let revealData = null;
let slideIndex = 0;
let autoTimer = null;

function bytes(value) {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function decrypt(blob, password) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(blob.salt), iterations: blob.iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const ciphertext = new Uint8Array([...bytes(blob.data), ...bytes(blob.tag)]);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(blob.iv), tagLength: 128 }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(clear));
}

function escapeHtml(value = '') {
  return String(value).replaceAll('\u2014', ',').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function home() {
  app.innerHTML = `<section class="home"><div class="home-card"><div class="lamp">🪔</div><div class="eyebrow">Mehra Haveli television</div><h1>Tonight at the haveli</h1><p>Choose the screen for the moment. Keep the reveal screen closed until everyone has made an accusation.</p><div class="home-actions"><a href="./tv.html?mode=breaking">Breaking news</a><a class="secondary" href="./tv.html?mode=reveal">Final reveal</a></div></div></section>`;
}

function breakingNews() {
  app.innerHTML = `<section class="screen"><header class="tv-header"><div class="network">MEHRA NEWS NETWORK</div><div class="live"><i></i>LIVE · OLD DELHI</div></header><div class="news-body"><div class="news-copy"><span class="news-kicker">Breaking news</span><h1>Sweets tycoon Dhanraj Mehra found dead on Diwali night</h1><p>The 68-year-old was found at his family home in Old Delhi. Police are investigating.</p><div class="location">Old Delhi · Sunday night</div></div><figure class="portrait-frame"><div class="portrait-inner"><svg viewBox="0 0 360 450" role="img" aria-label="Illustrated portrait of an older Indian businessman"><defs><linearGradient id="coat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfac68"/><stop offset="1" stop-color="#8b4d36"/></linearGradient><linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a61"/><stop offset="1" stop-color="#9b5f47"/></linearGradient></defs><circle cx="185" cy="163" r="101" fill="#f1bd76" opacity=".2"/><path d="M60 450c12-108 57-151 121-151s108 43 120 151" fill="url(#coat)"/><path d="M135 298l46 66 46-66-18-33h-55z" fill="#f2e2c8"/><path d="M126 132c0-57 27-87 58-87 39 0 59 33 59 88v72c0 48-26 78-60 78-34 0-57-32-57-80z" fill="url(#face)"/><path d="M124 145c-22-58 7-115 69-115 54 0 76 41 65 99-7-27-26-45-48-54-22 22-51 34-86 35z" fill="#e3c890"/><path d="M125 137c-5-47 18-91 69-91 44 0 66 29 67 72-25-1-44-13-59-31-18 27-45 43-77 50z" fill="#b64e3c"/><path d="M141 193c12-9 25-9 38 0M194 193c12-9 25-9 38 0" fill="none" stroke="#53372e" stroke-width="7" stroke-linecap="round"/><path d="M179 207l-9 29 19 2" fill="none" stroke="#7a4938" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M158 253c17 14 38 14 56 0" fill="none" stroke="#63392f" stroke-width="6" stroke-linecap="round"/><path d="M118 181c-9 1-15 11-11 24 3 11 9 17 18 17M248 181c9 1 15 11 11 24-3 11-9 17-18 17" fill="#a9684c"/><circle cx="179" cy="231" r="4" fill="#e9bc85"/><circle cx="188" cy="231" r="4" fill="#e9bc85"/></svg></div><figcaption class="portrait-caption">Dhanraj Mehra</figcaption></figure></div><div class="ticker"><div class="ticker-track"><span>Breaking: Dhanraj Mehra found dead at his family home</span><span>Police are investigating the death of the Mehra Mithai chairman</span><span>Breaking: Dhanraj Mehra found dead at his family home</span><span>Police are investigating the death of the Mehra Mithai chairman</span></div></div><footer class="tv-footer"><span>Mehra News Network · Special bulletin</span><button id="tv-home">Home</button></footer></section>`;
  document.querySelector('#tv-home').addEventListener('click', () => {
    if (query.get('return') === 'phone') {
      const referrerIsLocal = document.referrer && new URL(document.referrer).origin === location.origin;
      if (referrerIsLocal && history.length > 1) history.back();
      else location.href = './index.html';
      return;
    }
    location.href = './tv.html';
  });
  playNewsSting();
}

function revealLogin() {
  const order = [['rajiv', 'Rajiv'], ['tara', 'Tara'], ['rohan', 'Rohan'], ['kabir', 'Kabir']];
  app.innerHTML = `<section class="reveal-screen"><div class="reveal-card"><div class="eyebrow">The Last Diya</div><h1>Four words. One truth.</h1><p>Ask each player for the word on their phone. Enter them in the order of the afternoon visits.</p><form id="reveal-form"><div class="word-fields">${order.map(([key, name]) => `<div class="word-field"><label for="word-${key}">${name}</label><input id="word-${key}" name="${key}" autocomplete="off" autocapitalize="none" spellcheck="false" required></div>`).join('')}</div><button class="reveal-submit">Unlock the reveal</button></form><div class="reveal-error" id="reveal-error"></div></div></section>`;
  document.querySelector('#reveal-form').addEventListener('submit', unlockReveal);
}

async function unlockReveal(event) {
  event.preventDefault();
  const error = document.querySelector('#reveal-error');
  error.textContent = 'Opening the reveal...';
  const words = ['rajiv', 'tara', 'rohan', 'kabir'].map((role) => document.querySelector(`#word-${role}`).value.trim().toLowerCase());
  try {
    const response = await fetch('./content/reveal.json', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    revealData = await decrypt(await response.json(), words.join(' '));
    slideIndex = 0;
    showSlide();
    startRevealMusic();
  } catch {
    error.textContent = 'Those words did not unlock the reveal. Check the spelling and order.';
  }
}

function showSlide() {
  clearTimeout(autoTimer);
  const slides = revealData.slides;
  app.innerHTML = `<section class="slide-wrap"><header class="slide-top"><span>Mehra Haveli · The reveal</span><span class="slide-count">${slideIndex + 1} / ${slides.length}</span></header><div class="slide-text">${escapeHtml(slides[slideIndex])}</div><footer class="slide-actions"><button id="previous-slide" ${slideIndex === 0 ? 'disabled' : ''}>Back</button><button id="next-slide" class="next">${slideIndex === slides.length - 1 ? 'Confession' : 'Next'}</button><button id="auto-slides">Play slides</button></footer></section>`;
  document.querySelector('#previous-slide').addEventListener('click', () => { if (slideIndex > 0) { slideIndex--; showSlide(); } });
  document.querySelector('#next-slide').addEventListener('click', () => {
    if (slideIndex < slides.length - 1) { slideIndex++; showSlide(); }
    else showConfessionPrompt();
  });
  document.querySelector('#auto-slides').addEventListener('click', () => {
    clearTimeout(autoTimer);
    const next = () => {
      if (slideIndex < slides.length - 1) { slideIndex++; showSlide(); autoTimer = setTimeout(next, 6500); }
      else showConfessionPrompt();
    };
    autoTimer = setTimeout(next, 6500);
    toast('Slideshow started. Use Next to move faster.');
  });
  document.removeEventListener('keydown', slideKeys);
  document.addEventListener('keydown', slideKeys);
}

function slideKeys(event) {
  if (!revealData) return;
  if (event.key === 'ArrowRight') {
    if (slideIndex < revealData.slides.length - 1) slideIndex++;
    else { showConfessionPrompt(); return; }
    showSlide();
  }
  if (event.key === 'ArrowLeft' && slideIndex > 0) { slideIndex--; showSlide(); }
}

function showConfessionPrompt() {
  clearTimeout(autoTimer);
  document.removeEventListener('keydown', slideKeys);
  app.innerHTML = `<section class="slide-wrap"><header class="slide-top"><span>Mehra Haveli · After the reveal</span><span class="slide-count">Final moment</span></header><div class="confession-card"><h1>One last thing</h1><p>Ask the person responsible to stand and read their confession.</p><button id="read-confession">Open confession</button><article id="confession-text" hidden></article></div><footer class="tv-footer"><span>The Last Diya</span><button id="restart-reveal">Start again</button></footer></section>`;
  document.querySelector('#read-confession').addEventListener('click', (event) => {
    const article = document.querySelector('#confession-text');
    article.hidden = false;
    article.className = 'confession-card';
    article.innerHTML = `<p>${escapeHtml(revealData.confession)}</p>`;
    event.currentTarget.hidden = true;
  });
  document.querySelector('#restart-reveal').addEventListener('click', revealLogin);
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 2800);
}

function playNewsSting() { playNotes([440, 554, 659], 0.13); }
function startRevealMusic() { playNotes([523, 659, 784, 659, 880], 0.24); }
function playNotes(notes, beat) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * beat;
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + beat * 0.9);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + beat);
    });
    setTimeout(() => context.close(), notes.length * beat * 1000 + 250);
  } catch { /* Browser audio is an optional touch. */ }
}

if (mode === 'breaking') breakingNews();
else if (mode === 'reveal') revealLogin();
else home();
