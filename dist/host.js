const app = document.querySelector('#host-app');
const state = { config: null, timer: null, timerEnd: 0, lightsTimers: [], soundTimers: [], effectContexts: [], voiceAudio: null, voiceObjectUrl: null, fireworksAudio: null, thudAudio: null };
const iconById = { welcome: '♪', note815: '♫', lights: '◐', shanta: '♪', news: '▤', inspector1: '◉', joshi: '✉', inspector2: '◉', letter: '✎', reveal: '✦' };
const voiceProfiles = {
  dhanraj: { languages: ['en-IN', 'en-GB', 'en-US'], names: [/rishi/i, /daniel/i, /aarav/i], rate: 0.86, pitch: 0.78 },
  pappu: { languages: ['hi-IN', 'en-IN', 'en-GB'], names: [/hemant/i, /hindi/i, /rishi/i], rate: 1.03, pitch: 0.98 },
  shanta: { languages: ['hi-IN', 'en-IN', 'en-GB'], names: [/aditi/i, /lekha/i, /hindi/i], rate: 0.91, pitch: 1.16 },
  inspector: { languages: ['en-IN', 'en-GB', 'en-US'], names: [/alex/i, /daniel/i, /rishi/i], rate: 0.92, pitch: 0.88 },
  joshi: { languages: ['en-IN', 'en-GB', 'en-US'], names: [/aarav/i, /daniel/i, /alex/i], rate: 0.98, pitch: 0.95 },
};

function b64(value) {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function decrypt(blob, password) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(blob.salt), iterations: blob.iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const ciphertext = new Uint8Array([...b64(blob.data), ...b64(blob.tag)]);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv), tagLength: 128 }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(clear));
}

function openBreakGlass() {
  const modal = document.createElement('section');
  modal.className = 'breakglass-backdrop';
  modal.innerHTML = `<div class="breakglass-dialog" role="dialog" aria-modal="true" aria-labelledby="breakglass-title"><button class="breakglass-close" id="breakglass-close" aria-label="Close">×</button><div class="eyebrow">Emergency access</div><h2 id="breakglass-title">Break glass</h2><p>Enter the code from the printed envelope. This opens the solution.</p><form id="breakglass-form"><input id="breakglass-code" type="password" autocomplete="off" placeholder="Break-glass code" aria-label="Break-glass code"><button class="emergency-action">Open solution</button></form><div id="breakglass-error" class="error"></div><article id="breakglass-result" class="breakglass-result" hidden></article></div></section>`;
  document.body.append(modal);
  document.querySelector('#breakglass-close').addEventListener('click', () => modal.remove());
  document.querySelector('#breakglass-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector('#breakglass-error');
    error.textContent = 'Opening the emergency file...';
    try {
      const response = await fetch('./content/emergency.json', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const code = document.querySelector('#breakglass-code').value.trim().toLowerCase();
      const payload = await decrypt(await response.json(), code);
      const result = document.querySelector('#breakglass-result');
      result.hidden = false;
      result.textContent = plainText(payload.text);
      error.textContent = '';
    } catch {
      error.textContent = 'That code did not open the emergency file.';
    }
  });
  document.querySelector('#breakglass-code').focus();
}

function plainText(value) {
  return String(value).replaceAll('\u2014', ',').replaceAll('\u2013', '-').replace(/^\s*#{1,6}\s*/gm, '').replace(/^\s*[-*]\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
}

function login() {
  stopVoiceClip();
  app.innerHTML = `<section class="login-wrap"><div class="login"><div class="login-mark">🪔</div><div class="eyebrow">Private host page</div><h1>Host console</h1><p>Enter the host code to open the pacing controls.</p><form id="host-form"><input id="host-code" type="password" autocomplete="current-password" autocapitalize="none" placeholder="Host code" aria-label="Host code"><button class="primary">Unlock console</button></form><div id="host-error" class="error"></div></div></section>`;
  document.querySelector('#host-form').addEventListener('submit', unlock);
}

async function unlock(event) {
  event.preventDefault();
  const input = document.querySelector('#host-code');
  const error = document.querySelector('#host-error');
  error.textContent = 'Opening the console...';
  try {
    const response = await fetch('./content/host.json', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    state.config = await decrypt(await response.json(), input.value.trim().toLowerCase());
    dashboard();
  } catch {
    error.textContent = 'That code did not open the console. Check it and try again.';
  }
}

function dashboard() {
  const { config } = state;
  const completed = new Set(JSON.parse(localStorage.getItem('last-diya-host-done') || '[]'));
  app.innerHTML = `<main class="layout"><header class="header"><div><div class="eyebrow">Mehra Haveli · Sunday, 8 November</div><h1>Host console</h1><p>Your pacing controls for the night.</p></div><div class="head-actions"><span class="badge">Private host page</span><button id="host-lock" class="text-button">Lock console</button></div></header><div class="notice"><span>🪔</span><div><b>Host view</b>This console keeps the schedule and cue prompts in one place. It does not send cues to player phones, so players enter each act code on their own devices.</div></div><div class="grid"><div><section class="panel"><h2>Cue buttons</h2><p class="sub">Voice prompts use your browser’s built-in speech. Recordings play here on the host device.</p><div class="cue-grid">${config.cues.map((cue) => `<button class="cue" data-cue="${escapeHtml(cue.id)}"><span class="cue-icon">${iconById[cue.id] || '•'}</span><span><b>${escapeHtml(cue.title)}</b><small>${escapeHtml(cue.detail)}</small></span></button>`).join('')}${renderVoiceCueButtons(config.voiceLibrary)}</div></section><section class="panel sound-panel"><h2>Sound effects</h2><p class="sub">Preview the theatrical sounds here, or use the lights-out cue for the timed sequence.</p><div class="sound-grid"><button class="cue sound-cue" data-sound="fireworks"><span class="cue-icon">✳</span><span><b>Firecracker volley</b><small>Play the firework loop until stopped.</small></span></button><button class="cue sound-cue" data-sound="power"><span class="cue-icon">ϟ</span><span><b>Power cut and thud</b><small>Short electric drop followed by the impact.</small></span></button><button class="cue sound-cue" data-sound="scream"><span class="cue-icon">◖</span><span><b>Scream cue</b><small>Play the synthesized scream effect.</small></span></button></div><button class="sound-stop" id="stop-sounds">Stop sound effects</button></section><p class="footnote">The lights-out cue runs the full visual timing sequence. Keep the room lights under your control.</p></div><div><section class="panel"><h2>Act codes</h2><p class="sub">Announce each code when the group is ready. The suffix makes each code unique.</p><div class="codes">${Object.entries(config.actCodes).map(([act, code], index) => `<div class="code-card"><div><small>Act ${index + 1}</small><div class="code-value"><span>${escapeHtml(code)}</span></div></div><button class="copy" data-copy="${escapeHtml(code)}">Copy</button></div>`).join('')}</div></section><section class="panel show-panel"><h2>Run of show</h2><p class="sub">Times at left follow the story clock. Timers use the stated real-time durations.</p><div class="timeline">${config.timeline.map((event) => `<div class="event"><span class="event-time">${escapeHtml(event.time)}</span><label class="event-main"><input type="checkbox" data-done="${escapeHtml(event.id)}" ${completed.has(event.id) ? 'checked' : ''}><span><b>${escapeHtml(event.title)}</b><p>${escapeHtml(event.detail)}</p></span></label><button class="start" data-minutes="${event.minutes}" data-name="${escapeHtml(event.title)}">Start ${event.minutes} min</button></div>`).join('')}</div></section><section class="timer"><div class="timer-readout"><small id="timer-label">Timer ready</small><strong id="timer-readout-value">00:00</strong></div><div class="timer-controls"><label>Minutes<input id="timer-minutes" type="number" min="1" max="240" value="20" inputmode="numeric"></label><label>Timer name<input id="timer-name" type="text" maxlength="40" placeholder="Custom timer" value="Custom timer"></label><div class="timer-actions"><button id="timer-start">Start timer</button><button id="timer-stop" disabled>Stop timer</button></div></div></section></div></div></main>`;
  app.querySelector('.layout').insertAdjacentHTML('beforeend', '<section class="emergency"><div><b>Emergency reveal</b><p>Use only if the printed break-glass code is needed.</p></div><button id="breakglass-open">Enter break-glass code</button></section>');
  document.querySelector('#host-lock').addEventListener('click', () => { stopVoiceClip(); state.config = null; stopTimer(); clearLightsCue(); stopSoundEffects(); login(); });
  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(button.dataset.copy); toast('Code copied.'); }
    catch { toast('Select the code to copy it.'); }
  }));
  document.querySelectorAll('[data-cue]').forEach((button) => button.addEventListener('click', () => runCue(button.dataset.cue)));
  document.querySelectorAll('[data-voice-play]').forEach((button) => button.addEventListener('click', () => playVoiceClip(Number(button.dataset.voicePlay))));
  document.querySelectorAll('[data-voice-stop]').forEach((button) => button.addEventListener('click', stopVoiceClip));
  document.querySelectorAll('[data-sound]').forEach((button) => button.addEventListener('click', () => runSoundCue(button.dataset.sound)));
  document.querySelectorAll('[data-minutes]').forEach((button) => button.addEventListener('click', () => startTimer(Number(button.dataset.minutes), button.dataset.name)));
  document.querySelectorAll('[data-done]').forEach((checkbox) => checkbox.addEventListener('change', () => {
    if (checkbox.checked) completed.add(checkbox.dataset.done); else completed.delete(checkbox.dataset.done);
    localStorage.setItem('last-diya-host-done', JSON.stringify([...completed]));
  }));
  document.querySelector('#timer-start').addEventListener('click', () => {
    const minutes = Number(document.querySelector('#timer-minutes').value);
    const name = document.querySelector('#timer-name').value.trim() || 'Custom timer';
    startTimer(minutes, name);
  });
  document.querySelector('#timer-stop').addEventListener('click', stopTimer);
  document.querySelector('#stop-sounds').addEventListener('click', stopSoundEffects);
  document.querySelector('#breakglass-open').addEventListener('click', openBreakGlass);
  tickTimer();
}

function escapeHtml(value = '') {
  return String(value).replaceAll('\u2014', ',').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function renderVoiceCueButtons(clips = []) {
  const entries = Array.isArray(clips) ? clips : [];
  if (!entries.length) return '';
  return `<div class="cue-group-label">Voice recordings</div>${entries.map((clip, index) => `<div class="cue voice-cue"><span class="cue-icon">♫</span><span class="voice-cue-name"><b>${escapeHtml(clip.label || `Voice recording ${index + 1}`)}</b><small>Host playback</small></span><span class="voice-actions"><button class="voice-play" data-voice-play="${index}" aria-label="Play ${escapeHtml(clip.label || `voice recording ${index + 1}`)}">Play</button><button class="voice-stop" data-voice-stop="${index}" aria-label="Stop ${escapeHtml(clip.label || `voice recording ${index + 1}`)}" disabled>Stop</button></span></div>`).join('')}`;
}

function playVoiceClip(index) {
  const clip = state.config?.voiceLibrary?.[index];
  if (!clip) { toast('This recording is not available.'); return; }
  stopVoiceClip();
  const objectUrl = URL.createObjectURL(new Blob([b64(clip.data)], { type: clip.type }));
  const audio = new Audio(objectUrl);
  state.voiceObjectUrl = objectUrl;
  state.voiceAudio = audio;
  const stopButton = document.querySelector(`[data-voice-stop="${index}"]`);
  if (stopButton) stopButton.disabled = false;
  const failed = () => {
    if (state.voiceAudio !== audio) return;
    stopVoiceClip();
    toast('This recording could not be played.');
  };
  audio.addEventListener('ended', stopVoiceClip, { once: true });
  audio.addEventListener('error', failed, { once: true });
  audio.play().catch(failed);
}

function stopVoiceClip() {
  const audio = state.voiceAudio;
  state.voiceAudio = null;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
  }
  if (state.voiceObjectUrl) URL.revokeObjectURL(state.voiceObjectUrl);
  state.voiceObjectUrl = null;
  document.querySelectorAll('[data-voice-stop]').forEach((button) => { button.disabled = true; });
}

function runCue(id) {
  if (id === 'lights') { runLightsCue(); return; }
  if (id === 'news' || id === 'reveal') {
    const screen = id === 'news' ? 'breaking' : 'reveal';
    const opened = window.open(`./tv.html?mode=${screen}`, '_blank');
    if (opened) opened.opener = null;
    if (!opened) toast(`Open tv.html?mode=${screen} on the TV.`);
    return;
  }
  const cue = state.config.cues.find((item) => item.id === id);
  if (!cue) return;
  if (cue.speech) speakCue(cue);
  toast(cue.detail);
  const event = state.config.timeline.find((item) => item.id === id);
  if (event) startTimer(event.minutes, event.title);
}

function runSoundCue(id) {
  stopSoundEffects();
  if (id === 'fireworks') playFirecrackerVolley();
  else if (id === 'power') {
    playPowerCutTone();
    state.soundTimers.push(setTimeout(playThunk, 180));
  } else if (id === 'scream') playScreamCue();
}

function runLightsCue() {
  clearLightsCue();
  playFirecrackerVolley();
  const overlay = document.createElement('div');
  overlay.className = 'dark-cue';
  overlay.innerHTML = '<div><strong id="lights-title">Firecrackers</strong><p id="lights-subtitle">Start the volley, then wait for the thunk.</p><button id="lights-cancel">Cancel sequence</button></div>';
  document.body.append(overlay);
  document.querySelector('#lights-cancel').addEventListener('click', clearLightsCue);
  window.addEventListener('keydown', onEscape);
  const update = (delay, title, subtitle, dark = false) => state.lightsTimers.push(setTimeout(() => {
    if (!document.body.contains(overlay)) return;
    overlay.querySelector('#lights-title').textContent = title;
    overlay.querySelector('#lights-subtitle').textContent = subtitle;
    overlay.style.background = dark ? '#000' : '#050403';
  }, delay));
  update(2200, 'Thunk', 'Cut the room lights now.');
  state.lightsTimers.push(setTimeout(() => { stopEffectAudio('fireworksAudio'); playThunk(); }, 2200));
  update(4000, '20', 'Seconds of darkness. Bring the room lights back after the scream.', true);
  for (let second = 19; second >= 1; second--) update(5000 + (19 - second) * 1000, String(second), 'Seconds of darkness.', true);
  update(24000, 'Scream', 'Bring the room lights back up now.', false);
  state.lightsTimers.push(setTimeout(playScreamCue, 24000));
  state.lightsTimers.push(setTimeout(clearLightsCue, 29000));
}

function speakCue(cue) {
  if (!('speechSynthesis' in window)) { toast('Voice playback is not available in this browser.'); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cue.speech);
  const voices = window.speechSynthesis.getVoices();
  const profile = voiceProfile(cue.voice);
  utterance.voice = profile.names.map((pattern) => voices.find((voice) => pattern.test(voice.name))).find(Boolean)
    || profile.languages.map((language) => voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase())).find(Boolean)
    || voices.find((voice) => /^en/i.test(voice.lang))
    || null;
  if (utterance.voice) utterance.lang = utterance.voice.lang;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  window.speechSynthesis.speak(utterance);
}

function voiceProfile(speaker = '') {
  const name = String(speaker).toLowerCase();
  if (name.includes('shanta')) return voiceProfiles.shanta;
  if (name.includes('pappu')) return voiceProfiles.pappu;
  if (name.includes('qureshi') || name.includes('inspector')) return voiceProfiles.inspector;
  if (name.includes('joshi')) return voiceProfiles.joshi;
  return voiceProfiles.dhanraj;
}

function audioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function playFirecrackerVolley() {
  playEffectAsset('./audio/fireworks-loop.ogg', 'fireworksAudio', playFirecrackerFallback, true);
}

function playFirecrackerFallback() {
  try {
    const context = audioContext();
    if (!context) return;
    trackEffectContext(context, 1800);
    for (let burst = 0; burst < 5; burst++) {
      const length = Math.floor(context.sampleRate * 0.11);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = 'highpass';
      filter.frequency.value = 650;
      gain.gain.setValueAtTime(0.16, context.currentTime + burst * 0.26);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + burst * 0.26 + 0.1);
      source.connect(filter); filter.connect(gain); gain.connect(context.destination);
      source.start(context.currentTime + burst * 0.26);
    }
  } catch { /* Sound is optional on browsers that block audio. */ }
}

function playThunk() {
  playEffectAsset('./audio/heavy-thud.wav', 'thudAudio', playThunkFallback);
}

function playThunkFallback() {
  try {
    const context = audioContext();
    if (!context) return;
    trackEffectContext(context, 500);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(110, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(42, context.currentTime + 0.34);
    gain.gain.setValueAtTime(0.22, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.42);
  } catch { /* Sound is optional on browsers that block audio. */ }
}

function playPowerCutTone() {
  try {
    const context = audioContext();
    if (!context) return;
    trackEffectContext(context, 450);
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(720, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(48, context.currentTime + 0.24);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, context.currentTime + 0.25);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.27);
    oscillator.connect(filter); filter.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.29);
  } catch { /* Sound is optional on browsers that block audio. */ }
}

function playEffectAsset(source, stateKey, fallback, loop = false) {
  stopEffectAudio(stateKey);
  let audio;
  try {
    audio = new Audio(source);
    audio.volume = 0.55;
    audio.loop = loop;
  } catch {
    fallback();
    return;
  }
  state[stateKey] = audio;
  const failed = () => {
    if (state[stateKey] !== audio) return;
    stopEffectAudio(stateKey);
    fallback();
  };
  audio.addEventListener('error', failed, { once: true });
  audio.play().catch(failed);
}

function stopEffectAudio(stateKey) {
  const audio = state[stateKey];
  state[stateKey] = null;
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

function stopTheatricsAudio() {
  stopEffectAudio('fireworksAudio');
  stopEffectAudio('thudAudio');
}

function playScreamCue() {
  try {
    const context = audioContext();
    if (!context) return;
    trackEffectContext(context, 1300);
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(390, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(920, context.currentTime + 0.42);
    oscillator.frequency.exponentialRampToValueAtTime(540, context.currentTime + 1.05);
    filter.type = 'bandpass';
    filter.frequency.value = 1050;
    filter.Q.value = 2.2;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.065, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.065, context.currentTime + 0.62);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.1);
    oscillator.connect(filter); filter.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 1.12);
  } catch { /* The visual scream cue remains if browser audio is blocked. */ }
}

function onEscape(event) { if (event.key === 'Escape') clearLightsCue(); }
function clearLightsTimers() { state.lightsTimers.forEach(clearTimeout); state.lightsTimers = []; }
function trackEffectContext(context, duration) {
  state.effectContexts.push(context);
  const timer = setTimeout(() => {
    state.soundTimers = state.soundTimers.filter((item) => item !== timer);
    closeEffectContext(context);
  }, duration);
  state.soundTimers.push(timer);
}

function closeEffectContext(context) {
  state.effectContexts = state.effectContexts.filter((item) => item !== context);
  if (context.state !== 'closed') context.close().catch(() => {});
}

function stopSoundEffects() {
  state.soundTimers.forEach(clearTimeout);
  state.soundTimers = [];
  stopTheatricsAudio();
  [...state.effectContexts].forEach(closeEffectContext);
}

function clearLightsCue() { clearLightsTimers(); stopSoundEffects(); window.removeEventListener('keydown', onEscape); document.querySelector('.dark-cue')?.remove(); }

function startTimer(minutes, name) {
  const duration = Math.floor(Number(minutes));
  if (!Number.isFinite(duration) || duration < 1 || duration > 240) {
    toast('Choose a timer from 1 to 240 minutes.');
    return;
  }
  clearInterval(state.timer);
  state.timerEnd = Date.now() + duration * 60_000;
  document.querySelector('#timer-label').textContent = name || 'Timer';
  document.querySelector('#timer-stop').disabled = false;
  tickTimer();
  state.timer = setInterval(tickTimer, 1000);
}

function tickTimer() {
  const readout = document.querySelector('#timer-readout-value');
  if (!readout || !state.timerEnd) return;
  const left = Math.max(0, Math.ceil((state.timerEnd - Date.now()) / 1000));
  readout.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  if (!left) {
    clearInterval(state.timer);
    state.timer = null;
    state.timerEnd = 0;
    document.querySelector('#timer-stop').disabled = true;
    document.querySelector('#timer-label').textContent = 'Timer finished';
    toast('Timer finished.');
  }
}

function stopTimer() {
  clearInterval(state.timer);
  state.timer = null;
  state.timerEnd = 0;
  const label = document.querySelector('#timer-label');
  const readout = document.querySelector('#timer-readout-value');
  const stop = document.querySelector('#timer-stop');
  if (label) label.textContent = 'Timer stopped';
  if (readout) readout.textContent = '00:00';
  if (stop) stop.disabled = true;
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 3500);
}

login();
