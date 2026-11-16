// Techy overlay: docked at the screen edge on every tab, mostly tucked away. It slides out only when it has
// something useful to say (where you are, what's due) or to react (time in / time out), then tucks back.
// Tap it to ask a question (opens Ask Techy in the app). Drag it to the other edge if it's in the way.
(function () {
  const dock = document.getElementById('techyDock');
  const svg = document.getElementById('techySvg');
  const bubble = document.getElementById('bubble');
  const spot = document.getElementById('techy');
  if (!dock) return;
  let hideTimer, moodTimer, tuckTimer;

  function mood(name, backTo, ms) {
    svg.classList.remove('mood-ready', 'mood-cheer', 'mood-wave', 'mood-worry', 'mood-rest');
    void svg.getBoundingClientRect();                 // restart the animation
    svg.classList.add('mood-' + name);
    clearTimeout(moodTimer);
    if (backTo) moodTimer = setTimeout(() => mood(backTo), ms || 2200);
  }

  // Slide out for a while, then tuck back to the edge
  function peekOut(ms) {
    dock.classList.remove('tucked');
    clearTimeout(tuckTimer);
    tuckTimer = setTimeout(() => { bubble.classList.remove('show'); setTimeout(() => dock.classList.add('tucked'), 250); }, ms || 4400);
  }

  function say(text, tone, ms) {
    peekOut((ms || 4200) + 200);
    bubble.textContent = text;
    bubble.className = 'bubble' + (tone ? ' ' + tone : '');
    setTimeout(() => bubble.classList.add('show'), 180);  // after Techy has slid out
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => bubble.classList.remove('show'), ms || 4200);
  }

  // Blink every 3–6 s, like it's alive
  (function blink() {
    setTimeout(() => { svg.classList.add('blink'); setTimeout(() => { svg.classList.remove('blink'); blink(); }, 140); }, 3000 + Math.random() * 3000);
  })();

  // Tap: short, useful lines (in the app this opens "Ask Techy")
  const tips = [
    ['Ask me about leave, your hours or tools.', null, 'wave'],
    ['Vacuum pump is due back today.', 'worry', 'worry'],
  ];
  let tip = 0, dragged = false;
  spot.addEventListener('click', () => {
    if (dragged) { dragged = false; return; }
    const [text, tone, m] = tips[tip++ % tips.length];
    mood(m, 'ready', 2600);
    say(text, tone);
  });

  // Drag to the other edge: follows the finger, then snaps to the nearest side
  let startX = null, baseX = 0;
  spot.addEventListener('pointerdown', (e) => { startX = e.clientX; baseX = 0; spot.setPointerCapture(e.pointerId); });
  spot.addEventListener('pointermove', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) < 6) return;
    dragged = true;
    dock.classList.add('dragging'); dock.classList.remove('tucked');
    bubble.classList.remove('show');
    dock.style.transform = `translateX(${dx}px)`;
  });
  spot.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    startX = null;
    if (!dragged) return;
    const phone = dock.parentElement.getBoundingClientRect(), r = dock.getBoundingClientRect();
    const side = r.left + r.width / 2 < phone.left + phone.width / 2 ? 'left' : 'right';
    dock.classList.remove('dragging', 'left', 'right'); dock.classList.add(side);
    dock.style.transform = '';
    peekOut(1400);
    setTimeout(() => { dragged = false; }, 50);
  });

  let timedIn = false;
  window.techy = {
    // The success message says the words; Techy only reacts (no second message saying the same thing)
    timedIn() { timedIn = true; bubble.classList.remove('show'); peekOut(2600); mood('cheer', 'ready', 2400); },
    timedOut() { timedIn = false; bubble.classList.remove('show'); peekOut(2600); mood('wave', 'rest', 2400); },
  };

  // First useful line after Home arrives, then it tucks away
  setTimeout(() => { mood('wave', 'ready', 1800); say("You're at the site · job at 9:00"); }, 1200);
})();
