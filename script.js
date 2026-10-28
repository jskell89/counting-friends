(() => {
  const THEMES = [
    { id: 'kittens', name: 'Kittens', item: '🐱', holder: 'basket', holders: 'baskets' },
    { id: 'cupcakes', name: 'Cupcakes', item: '🧁', holder: 'box', holders: 'boxes' },
    { id: 'unicorns', name: 'Unicorns', item: '🦄', holder: 'rainbow', holders: 'rainbows' },
    { id: 'puppies', name: 'Puppies', item: '🐶', holder: 'bus', holders: 'buses' },
    { id: 'bunnies', name: 'Bunnies', item: '🐰', holder: 'burrow', holders: 'burrows' },
    { id: 'pandas', name: 'Pandas', item: '🐼', holder: 'treehouse', holders: 'treehouses' },
    { id: 'dinosaurs', name: 'Dinosaurs', item: '🦕', holder: 'nest', holders: 'nests' },
    { id: 'butterflies', name: 'Butterflies', item: '🦋', holder: 'garden', holders: 'gardens' },
    { id: 'beavers', name: 'Beavers', item: '🦫', holder: 'raft', holders: 'rafts' },
    { id: 'bananas', name: 'Bananas', item: '🍌', holder: 'bunch', holders: 'bunches' },
    { id: 'flowers', name: 'Flowers', item: '🌷', holder: 'bouquet', holders: 'bouquets' },
    { id: 'hearts', name: 'Hearts', item: '💖', holder: 'jar', holders: 'jars' },
    { id: 'bows', name: 'Bows', item: '🎀', holder: 'gift box', holders: 'gift boxes' },
    { id: 'mix', name: 'Mix it up!', item: '🎲', holder: 'box', holders: 'boxes', noun: 'friends' }
  ];
  const MIX = THEMES.filter(t => t.id !== 'mix').map(t => t.item);
  const TILE_COLORS = ['#FFC2DD', '#FFE08A', '#C7B8FF', '#B6F0D2', '#BDE6FF', '#FFD0B5', '#F6C1FF'];
  const PAD_COLORS = ['#FF5FA2', '#FF9F1C', '#2FCB8A', '#2BA8E0', '#7B4FD6'];
  const SPEEDS = [2400, 1600, 950];

  const $ = id => document.getElementById(id);
  const els = {
    start: $('start'), game: $('game'), finale: $('finale'), friends: $('friends'),
    path: $('path'), avatar: $('avatar'), bubble: $('bubble'), rods: $('rods'), frame: $('frame'),
    tensDigit: $('tensDigit'), onesDigit: $('onesDigit'), word: $('word'),
    tensLabel: $('tensLabel'), onesLabel: $('onesLabel'),
    controls: $('controls'), padWrap: $('padWrap'), pad: $('pad'),
    goBtn: $('goBtn'), oneBtn: $('oneBtn'), soundBtn: $('soundBtn')
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const S = { theme: null, n: 0, tensShown: 0, rods: [], frame: [], playing: false, timer: null,
              busy: false, asking: false, target: 0, wasPlaying: false, speed: 1, sound: true };

  // ---------- words ----------
  const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const TENS = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  function word(n) {
    if (n === 100) return 'one hundred';
    if (n < 20) return ONES[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  }
  const noun = () => S.theme.noun || S.theme.name.toLowerCase();
  const holderWord = k => (k === 1 ? S.theme.holder : S.theme.holders);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- sound ----------
  // Let sounds play on iPhone even when the ring/silent switch is on silent (Safari 17+)
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, at, dur, type = 'triangle', vol = 0.18) {
    const a = audio(); if (!a || !S.sound) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319];
  const sfx = {
    pop: d => tone(SCALE[d % 10], 0, 0.16),
    full: () => [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.18, 'sine', 0.14)),
    whoosh: () => { for (let i = 0; i < 8; i++) tone(400 + i * 90, i * 0.06, 0.1, 'sine', 0.06); },
    yay: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.1, 0.3, 'triangle', 0.18)),
    hmm: () => { tone(392, 0, 0.22, 'sine', 0.14); tone(330, 0.2, 0.32, 'sine', 0.14); },
    tap: () => tone(660, 0, 0.08, 'sine', 0.1),
    fanfare: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.14, i === 6 ? 0.8 : 0.22, 'triangle', 0.2))
  };

  // ---------- speech ----------
  const synth = window.speechSynthesis || null;
  let voice = null;
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices().filter(v => /^en/i.test(v.lang));
    const pref = ['Samantha', 'Google US English', 'Karen', 'Moira', 'Tessa', 'Victoria'];
    voice = pref.map(p => vs.find(v => v.name.includes(p))).find(Boolean)
      || vs.find(v => v.default) || vs.find(v => v.lang === 'en-US') || vs[0] || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  // iPhone Safari only allows speech after it has been started once from a tap,
  // so the first tap anywhere speaks a silent word to unlock it.
  let speechUnlocked = false;
  function unlockSpeech() {
    if (speechUnlocked || !synth) return;
    speechUnlocked = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    synth.speak(u);
  }
  let speakTimer = null, lastUtterance = null;
  function speak(text) {
    if (!synth || !S.sound) return;
    clearTimeout(speakTimer);
    const go = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 1.25; u.lang = 'en-US';
      if (voice) u.voice = voice;
      lastUtterance = u; // keep a reference so Safari doesn't drop it mid-sentence
      synth.speak(u);
    };
    // Safari often swallows speech that starts right after cancel(), so wait a moment
    if (synth.speaking || synth.pending) { synth.cancel(); speakTimer = setTimeout(go, 90); }
    else go();
  }

  function say(text, spoken) {
    els.bubble.textContent = text;
    els.avatar.classList.remove('hop'); void els.avatar.offsetWidth; els.avatar.classList.add('hop');
    if (spoken !== false) speak(spoken || text);
  }

  // ---------- building the board ----------
  function itemFor() { return S.theme.id === 'mix' ? MIX[Math.floor(Math.random() * MIX.length)] : S.theme.item; }

  function buildFriends() {
    THEMES.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'friend';
      b.style.background = TILE_COLORS[i % TILE_COLORS.length];
      b.innerHTML = `<span class="em" aria-hidden="true">${t.item}</span><span class="nm">${t.name}</span>`;
      b.addEventListener('click', () => startGame(t));
      els.friends.appendChild(b);
    });
  }

  function buildFrame() {
    els.frame.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const c = document.createElement('div'); c.className = 'cell';
      els.frame.appendChild(c);
    }
  }
  function setCell(i, emoji, animate) {
    const c = els.frame.children[i];
    c.innerHTML = emoji ? `<span class="${animate ? 'pop' : ''}">${emoji}</span>` : '';
  }

  function makeRod(items) {
    const r = document.createElement('div'); r.className = 'rod';
    r.innerHTML = items.map(e => `<span>${e}</span>`).join('');
    return r;
  }
  function renderRods() {
    els.rods.innerHTML = '';
    if (!S.rods.length) {
      els.rods.innerHTML = `<div class="empty">Full ${S.theme.holders} go here!</div>`;
      return;
    }
    S.rods.forEach(items => els.rods.appendChild(makeRod(items)));
  }

  function buildPad(withTen) {
    els.pad.innerHTML = '';
    const nums = withTen ? [1,2,3,4,5,6,7,8,9,10] : [0,1,2,3,4,5,6,7,8,9];
    nums.forEach((n, i) => {
      const b = document.createElement('button');
      b.textContent = n;
      b.style.background = PAD_COLORS[i % PAD_COLORS.length];
      b.setAttribute('aria-label', 'Answer ' + n);
      b.addEventListener('click', () => { sfx.tap(); answer(n); });
      els.pad.appendChild(b);
    });
  }

  function renderPath(justGot) {
    els.path.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const s = document.createElement('div');
      s.className = 'stop';
      if (S.tensShown >= i) {
        s.classList.add('got');
        s.textContent = S.theme.id === 'mix' ? MIX[(i * 3) % MIX.length] : S.theme.item;
        s.setAttribute('aria-label', `${i * 10}, got it`);
        if (i === justGot && !reduceMotion) s.animate([{ transform: 'scale(0) rotate(-90deg)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' });
      } else {
        s.textContent = i * 10;
        if (i === S.tensShown + 1) s.classList.add('next');
      }
      els.path.appendChild(s);
    }
  }

  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 230); }

  function renderAll() {
    els.onesDigit.textContent = S.n % 10;
    els.tensDigit.textContent = S.tensShown;
    els.tensDigit.classList.remove('ask');
    els.word.textContent = word(S.n);
    for (let i = 0; i < 10; i++) setCell(i, S.frame[i], false);
    els.frame.classList.remove('full');
    renderRods(); renderPath();
    showPad(false);
  }

  // ---------- flow ----------
  function startGame(theme) {
    audio();
    S.theme = theme;
    resetState();
    els.avatar.textContent = theme.item;
    els.tensLabel.textContent = 'full ' + theme.holders;
    els.onesLabel.textContent = noun();
    els.start.hidden = true; els.finale.hidden = true; els.game.hidden = false;
    window.scrollTo(0, 0);
    say(`Let’s count ${noun()}! Press Go!`);
  }

  function resetState() {
    pause();
    Object.assign(S, { n: 0, tensShown: 0, rods: [], frame: [], busy: false, asking: false, target: 0, wasPlaying: false });
    buildFrame(); renderAll();
  }

  function play() {
    if (S.playing || S.asking || S.busy || S.n >= 100) return;
    S.playing = true; updateControls();
    loop();
  }
  function loop() {
    if (!S.playing) return;
    tick();
    if (S.playing) S.timer = setTimeout(loop, SPEEDS[S.speed]);
  }
  function pause() {
    S.playing = false; clearTimeout(S.timer); S.timer = null; updateControls();
  }
  function updateControls() {
    els.goBtn.textContent = S.playing ? '⏸ Stop' : '▶ Go';
    els.goBtn.classList.toggle('stop-mode', S.playing);
    els.oneBtn.disabled = S.playing;
  }

  function tick() {
    if (S.busy || S.asking || S.n >= 100) return;
    if (S.n % 10 === 9) { rollover(); return; }
    S.n++;
    const e = itemFor();
    S.frame.push(e);
    setCell(S.frame.length - 1, e, true);
    els.onesDigit.textContent = S.n % 10; bump(els.onesDigit);
    els.word.textContent = word(S.n);
    sfx.pop(S.n % 10);
    speak(word(S.n));
    const ones = S.n % 10;
    if (ones === 1 && S.n < 10) say(`One ${S.theme.id === 'mix' ? 'friend' : noun().replace(/ies$/, 'y').replace(/s$/, '')}!`, false);
    else if (ones === 5) say(`Halfway to a full ${S.theme.holder}!`, false);
    else if (ones === 8) say(`Almost full… what happens next?`, false);
    else if (ones === 1) say(`A new ${S.theme.holder} starts filling up!`, false);
  }

  async function rollover() {
    S.busy = true;
    S.wasPlaying = S.playing;
    pause();
    // the 10th one drops in and the frame is full
    const e = itemFor();
    S.frame.push(e);
    setCell(9, e, true);
    els.frame.classList.add('full');
    sfx.full();
    say(`Ten ${noun()}! That fills a ${S.theme.holder}!`);
    await wait(2000);

    // bundle them up and send them to the tens side
    await flyBundle(S.frame.slice());
    S.rods.push(S.frame.slice());
    S.frame = [];
    for (let i = 0; i < 10; i++) setCell(i, null);
    els.frame.classList.remove('full');
    els.onesDigit.textContent = 0; bump(els.onesDigit);

    // now she figures out the tens digit
    S.target = S.rods.length;
    S.asking = true;
    els.tensDigit.textContent = '?';
    els.tensDigit.classList.add('ask');
    els.word.textContent = '…';
    buildPad(S.target === 10);
    showPad(true);
    say(`How many ${S.theme.holders} are there now?`);
    S.busy = false;
  }

  function flyBundle(items) {
    const empty = els.rods.querySelector('.empty');
    if (empty) empty.remove();
    const rod = makeRod(items);
    rod.style.visibility = 'hidden';
    els.rods.appendChild(rod);
    if (reduceMotion) { rod.style.visibility = ''; return Promise.resolve(); }

    sfx.whoosh();
    const fr = els.frame.getBoundingClientRect();
    const tr = rod.getBoundingClientRect();
    const fx = fr.left + fr.width / 2, fy = fr.top + fr.height / 2;
    const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;

    // the frame's items shrink together into the middle
    [...els.frame.querySelectorAll('.cell span')].forEach(sp => {
      const r = sp.getBoundingClientRect();
      sp.animate([{ transform: 'none', opacity: 1 },
                  { transform: `translate(${fx - (r.left + r.width / 2)}px, ${fy - (r.top + r.height / 2)}px) scale(0.3)`, opacity: 0 }],
                 { duration: 500, easing: 'ease-in', fill: 'forwards' });
    });

    const flyer = makeRod(items);
    flyer.classList.add('flyer');
    Object.assign(flyer.style, { left: tr.left + 'px', top: tr.top + 'px', width: tr.width + 'px' });
    flyer.style.fontSize = getComputedStyle(els.rods).fontSize;
    els.rods.closest('.board').appendChild(flyer);
    const anim = flyer.animate([
      { transform: `translate(${fx - tx}px, ${fy - ty}px) rotate(-90deg) scale(1.3)`, opacity: 0 },
      { transform: `translate(${fx - tx}px, ${fy - ty}px) rotate(-90deg) scale(1.3)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${(fx - tx) / 2}px, ${(fy - ty) / 2 - 80}px) rotate(-30deg) scale(1.2)`, offset: 0.7 },
      { transform: 'none', opacity: 1 }
    ], { duration: 1500, easing: 'ease-in-out' });
    return anim.finished.then(() => { rod.style.visibility = ''; flyer.remove(); });
  }

  function showPad(on) {
    els.padWrap.hidden = !on;
    els.controls.hidden = on;
    els.pad.classList.remove('wait');
    if (on) { const b = els.pad.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
  }

  async function answer(v) {
    if (!S.asking || S.busy) return;
    if (v === S.target) {
      S.asking = false;
      S.tensShown = v;
      S.n = v * 10;
      els.tensDigit.classList.remove('ask');
      els.tensDigit.textContent = v === 10 ? '10' : v;
      bump(els.tensDigit);
      els.word.textContent = word(S.n);
      sfx.yay();
      confetti(els.tensDigit, 26);
      renderPath(v);
      showPad(false);
      const n = S.n;
      if (v === 10) {
        say(`Yes! Ten ${S.theme.holders}! That’s one hundred!`);
        setTimeout(finale, 2200);
        return;
      }
      say(`Yes! ${cap(word(v))} ${holderWord(v)} is ${n}!`, `Yes! ${word(v)} ${holderWord(v)}. ${word(n)}!`);
      if (S.wasPlaying) setTimeout(() => { if (!S.asking && !S.playing && S.n === n) play(); }, 3000);
    } else {
      S.busy = true;
      els.pad.classList.add('wait');
      sfx.hmm();
      say(`Hmm, not quite! Let’s count the ${S.theme.holders} together.`);
      await wait(2600);
      const rods = [...els.rods.querySelectorAll('.rod')];
      for (let i = 0; i < rods.length; i++) {
        rods[i].classList.add('lit');
        sfx.pop(i);
        say(cap(word(i + 1)) + '…', word(i + 1));
        await wait(900);
        rods[i].classList.remove('lit');
      }
      say(`So how many ${S.theme.holders}?`);
      els.pad.classList.remove('wait');
      S.busy = false;
    }
  }

  function finale() {
    const sq = $('square'); sq.innerHTML = '';
    S.rods.flat().forEach((e, i) => {
      const s = document.createElement('span'); s.textContent = e;
      s.style.animationDelay = (i * 18) + 'ms';
      sq.appendChild(s);
    });
    $('finaleText').textContent = `10 ${S.theme.holders} of 10 ${noun()} makes 100 ${noun()}!`;
    els.finale.hidden = false;
    sfx.fanfare();
    speak(`One hundred! You counted all the way to one hundred! Ten ${S.theme.holders} of ten ${noun()}!`);
    setTimeout(() => confetti(document.querySelector('.hundred'), 60), 200);
  }

  function confetti(anchor, count) {
    if (reduceMotion) return;
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const pieces = S.theme.id === 'mix' ? MIX : [S.theme.item, '💖', '✨', '⭐', S.theme.item];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'confetti';
      p.textContent = pieces[i % pieces.length];
      document.body.appendChild(p);
      const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 220;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 80;
      p.animate([
        { transform: `translate(${cx}px, ${cy}px) scale(0.4)`, opacity: 1 },
        { transform: `translate(${cx + dx}px, ${cy + dy}px) scale(1.2) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${cx + dx * 1.1}px, ${cy + dy + 160}px) scale(1) rotate(${Math.random() * 540}deg)`, opacity: 0 }
      ], { duration: 1400 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.4,1)' }).finished.then(() => p.remove());
    }
  }

  // ---------- wiring ----------
  els.goBtn.addEventListener('click', () => { audio(); S.playing ? pause() : play(); });
  els.oneBtn.addEventListener('click', () => { audio(); tick(); });
  document.querySelectorAll('.speeds button').forEach(b => b.addEventListener('click', () => {
    S.speed = Number(b.dataset.speed);
    document.querySelectorAll('.speeds button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  }));
  els.soundBtn.addEventListener('click', () => {
    S.sound = !S.sound;
    if (!S.sound && synth) synth.cancel();
    els.soundBtn.textContent = S.sound ? '🔊 Sound on' : '🔇 Sound off';
    els.soundBtn.setAttribute('aria-pressed', S.sound);
  });
  $('resetBtn').addEventListener('click', () => { resetState(); say('Let’s count again from zero!'); });
  $('changeBtn').addEventListener('click', goHome);
  $('newFriendBtn').addEventListener('click', goHome);
  $('againBtn').addEventListener('click', () => { els.finale.hidden = true; resetState(); say(`Let’s count ${noun()} again!`); });
  function goHome() {
    pause(); if (synth) synth.cancel();
    S.busy = false; S.asking = false;
    els.finale.hidden = true; els.game.hidden = true; els.start.hidden = false;
    window.scrollTo(0, 0);
  }
  document.addEventListener('keydown', e => {
    if (!S.asking || S.busy || els.game.hidden) return;
    if (/^[0-9]$/.test(e.key)) {
      const v = Number(e.key);
      answer(S.target === 10 && v === 0 ? 10 : v);
    }
  });

  ['touchend', 'click'].forEach(ev => document.addEventListener(ev, () => { unlockSpeech(); audio(); }, { capture: true, passive: true }));

  buildFriends();
})();
