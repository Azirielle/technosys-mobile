// TechnoSys prototype behaviour: time-in confirmation, job card, tab bar, skeletons, inbox. Demo data only.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Live clock and date
  const clock = $('#clock');
  const tickClock = () => { if (!timedIn) clock.textContent = fmt(new Date()); };
  $('#today').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  // Staggered arrival (motion #4)
  function arrive(root) {
    $$('.stag', root).forEach((el, i) => { el.classList.remove('in'); el.style.setProperty('--d', Math.min(i, 6) * 40 + 'ms'); });
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.stag', root).forEach((el) => el.classList.add('in'))));
  }

  // Press feedback (motion #1)
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.qa, .tab, .btn, .bell, .card.job, .tbtn, .notif, .iconbtn, .day, .techy-spot');
    if (!t) return;
    t.classList.add('pressed');
    const up = () => { t.classList.remove('pressed'); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  });

  // Toast (success message)
  let toastTimer;
  function toast(title, text) {
    $('#toastTitle').textContent = title; $('#toastText').textContent = text;
    const t = $('#toast'); t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // Time in / time out (the confirmation sequence)
  let timedIn = false, busy = false, timeInAt, workTimer;
  const btn = $('#tbtn'), pill = $('#tcPill'), card = $('#timecard');
  async function toggleTime() {
    if (busy) return; busy = true;
    if (currentTab !== 'home') switchTab('home');
    btn.classList.add('busy'); $('#checking').classList.add('show');
    await wait(950);                                   // checking location (ring draws)
    $('#checking').classList.remove('show');
    btn.classList.remove('busy'); btn.classList.add('done');   // green circle + check + burst
    await wait(900);
    timedIn = !timedIn;
    btn.classList.remove('done');
    if (timedIn) {
      timeInAt = new Date();
      $('#tlabel').textContent = 'Time out'; btn.classList.add('out');
      pill.className = 'pill ok'; $('#tcPillText').textContent = 'Timed in · ' + fmt(timeInAt);
      card.classList.add('on');
      $('#jobPill').className = 'pill ok small'; $('#jobPillText').textContent = 'In progress';
      const worked = () => { const m = Math.floor((Date.now() - timeInAt) / 60000); clock.textContent = Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; $('#shiftBar').style.width = Math.max(3, Math.min(100, m / 480 * 100)) + '%'; };
      worked(); clock.classList.remove('tick'); void clock.offsetWidth; clock.classList.add('tick');
      $('#tcSub').textContent = 'Worked so far · Batangas beach resort';
      window.techy && window.techy.timedIn(fmt(timeInAt));
      workTimer = setInterval(worked, 30000);
      toast('Timed in at ' + fmt(timeInAt), 'Have a safe day at Batangas beach resort.');
    } else {
      clearInterval(workTimer);
      $('#tlabel').textContent = 'Time in'; btn.classList.remove('out');
      pill.className = 'pill info'; $('#tcPillText').textContent = 'Timed out · ' + fmt(new Date());
      card.classList.remove('on');
      $('#jobPill').className = 'pill ok small'; $('#jobPillText').textContent = 'Done';
      $('#tcSub').textContent = 'Shift done · see you tomorrow';
      window.techy && window.techy.timedOut();
      tickClock(); clock.classList.remove('tick'); void clock.offsetWidth; clock.classList.add('tick');
      toast('Timed out at ' + fmt(new Date()), 'Your hours are saved. HR sees them in your DTR.');
    }
    busy = false;
  }
  btn.addEventListener('click', toggleTime);
  window.toggleTime = toggleTime;

  // Today's job: expand details
  const job = $('#job');
  const toggleJob = () => job.setAttribute('aria-expanded', job.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
  job.addEventListener('click', (e) => { if (!e.target.closest('.btn')) toggleJob(); });
  job.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleJob(); } });

  // Bottom bar with sliding indicator (motion #6); other tabs show skeletons first (motion #9)
  let currentTab = 'home';
  const indicator = $('#indicator');
  function moveIndicator(tabBtn) {
    const nav = $('#nav').getBoundingClientRect(), r = tabBtn.getBoundingClientRect();
    indicator.style.transform = `translateX(${r.left - nav.left}px)`;
  }
  const CONTENT = {
    jobs: `<h2 class="label stag">This week</h2>
      <div class="card list stag"><div class="li"><span class="chip"><i class="ti ti-air-conditioning"></i></span><div class="grow"><b>Batangas beach resort</b><span class="ink2 small">Today · 9:00 AM</span></div><span class="st info">Upcoming</span></div>
      <div class="li"><span class="chip"><i class="ti ti-air-conditioning"></i></span><div class="grow"><b>Lopez residence</b><span class="ink2 small">Wed · 1:00 PM</span></div><span class="st info">Upcoming</span></div>
      <div class="li"><span class="chip"><i class="ti ti-building"></i></span><div class="grow"><b>Pacita HQ, office duty</b><span class="ink2 small">Fri · 8:00 AM</span></div><span class="st info">Upcoming</span></div></div>`,
    dtr: `<div class="cutoff stag"><button aria-label="Earlier cut-off"><i class="ti ti-chevron-left"></i></button><div style="text-align:center"><b>Nov 1 – 15</b><div class="ink2 small">Cut-off · 11 workdays</div></div><button aria-label="Later cut-off"><i class="ti ti-chevron-right"></i></button></div>
      <div class="sum">
        <div class="card stag"><div class="n">86.5 h</div><div class="k">Worked</div></div>
        <div class="card stag"><div class="n">3.0 h</div><div class="k">Overtime <span class="st info">approved</span></div></div>
        <div class="card stag"><div class="n">4.5 h</div><div class="k">Night shift <span class="ink2">(10 PM–6 AM)</span></div></div>
        <div class="card stag"><div class="n"><span class="st error" style="font-size:24px">2</span> · 0</div><div class="k">Lates · absences</div></div>
      </div>
      <div class="card stag" style="margin-top:10px"><b style="font-size:14px">Where you worked</b>
        <div class="mix"><span style="flex:7"></span><span style="flex:2"></span><span style="flex:2"></span></div>
        <div class="legend"><span><i class="ti ti-map-pin"></i> On-site 7</span><span><i class="ti ti-truck"></i> Out of town 2</span><span><i class="ti ti-building"></i> Office HQ 2</span></div></div>
      <h2 class="label stag">Days</h2>
      ${[
        ['14', 'Fri', '8:05 AM – no time-out', '—', '<span class="st pending">HR checking</span>', 'site', 'Lopez residence', 'You forgot to time out; you said you left at 5:00 PM. HR will confirm it.'],
        ['13', 'Thu', '8:00 AM – 5:00 PM', '8.0 h', '', 'hq', 'Pacita HQ, office duty', 'Timed in at the office.'],
        ['12', 'Wed', '8:27 AM – 5:04 PM', '7.6 h', '<span class="st error">Late 12 min</span>', 'site', 'Santos residence', 'Late is counted after the 15-minute grace (from 8:15).'],
        ['11', 'Tue', '7:52 AM – 9:40 PM', '12.8 h', '<span class="st info">OT 3.0 h</span>', 'town', 'Calamba plant, out of town', 'Overtime counts only up to what HR approved (3.0 h).'],
        ['8', 'Sat', '6:00 PM – 2:30 AM', '7.5 h', '<span class="st info">Night 4.5 h</span>', 'site', 'Mall chiller, night work', 'Night shift hours are the hours between 10 PM and 6 AM.'],
      ].map(([d, wd, t, h, s, kind, job, why]) => `<article class="day stag" aria-expanded="false" tabindex="0">
        <div class="row"><div class="d"><b>${d}</b><span>${wd}</span></div><div class="grow"><div class="t">${t}</div>
        <div class="meta"><span class="tag"><i class="ti ${kind === 'hq' ? 'ti-building' : kind === 'town' ? 'ti-truck' : 'ti-map-pin'}"></i>${kind === 'hq' ? 'Office HQ' : kind === 'town' ? 'Out of town' : 'On-site'}</span>${s}</div></div><span class="h">${h}</span></div>
        <div class="expand"><div class="expand-in"><div class="why"><b>${job}</b><br>${why}</div></div></div></article>`).join('')}`,
    me: `<div class="card stag"><div class="row"><span class="chip" style="border-radius:50%;font-size:14px;font-weight:700">RS</span><div class="grow"><b>Ramon Santos</b><span class="ink2 small">Senior technician · 0917 123 4501</span></div></div></div>
      <h2 class="label stag">My work</h2><div class="card list stag"><div class="li"><span class="chip"><i class="ti ti-clock-hour-4"></i></span><div class="grow">My hours</div><i class="ti ti-chevron-right ink2"></i></div>
      <div class="li"><span class="chip"><i class="ti ti-tool"></i></span><div class="grow">My tools</div><i class="ti ti-chevron-right ink2"></i></div>
      <div class="li"><span class="chip"><i class="ti ti-book"></i></span><div class="grow">Handbook and forms</div><span class="st info">2 to read</span></div></div>`,
  };
  const SKELETON = `<div class="sk" style="height:18px;width:40%;margin:4px 4px 12px"></div><div class="sk" style="height:76px;margin-bottom:10px"></div><div class="sk" style="height:76px;margin-bottom:10px"></div><div class="sk" style="height:76px"></div>`;
  async function switchTab(name) {
    if (name === currentTab) return;
    currentTab = name;
    $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
    moveIndicator($(`.tab[data-tab="${name}"]`));
    $$('.screen:not(.push)').forEach((s) => s.classList.toggle('active', s.dataset.tab === name));
    const screen = $(`.screen[data-tab="${name}"]`);
    if (name === 'home') return arrive(screen);
    const box = $('.loadable', screen);
    box.innerHTML = SKELETON;
    await wait(650);                                    // pretend network
    if (currentTab !== name) return;
    box.style.opacity = 0; box.innerHTML = CONTENT[box.dataset.kind];
    requestAnimationFrame(() => { box.style.transition = 'opacity 150ms'; box.style.opacity = 1; arrive(box); });
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  // DTR days open to explain the numbers
  document.addEventListener('click', (e) => {
    const day = e.target.closest('.day'); if (!day) return;
    day.setAttribute('aria-expanded', day.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
  });

  // Palette switch (notes panel)
  $$('.pal').forEach((b) => b.addEventListener('click', () => {
    $('#phone').dataset.p = b.dataset.p;
    $$('.pal').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
  }));

  // Inbox (pushed screen)
  const NOTIFS = [
    { icon: 'ti-circle-check', title: 'Leave approved', text: 'HR approved your vacation leave for Dec 2. Enjoy your day off.', when: '10 min ago', status: '<span class="st ok">Approved</span>' },
    { icon: 'ti-speakerphone', title: 'Office closed on Bonifacio Day', text: 'Pacita HQ is closed on Monday, Nov 30. Jobs that day are moved.', when: '2 h ago', status: '' },
    { icon: 'ti-tool', title: 'Vacuum pump due back today', text: 'Please return it to the warehouse before 5:00 PM.', when: 'Yesterday', status: '<span class="st error">Due today</span>' },
  ];
  let unread = new Set([0, 1, 2]), filter = 'all';
  function renderInbox() {
    const list = $('#notifs');
    const items = NOTIFS.map((n, i) => ({ ...n, i })).filter((n) => filter === 'all' || unread.has(n.i));
    list.innerHTML = items.map((n) => `<article class="notif stag ${unread.has(n.i) ? '' : 'read'}" data-i="${n.i}">
      <span class="chip"><i class="ti ${n.icon}"></i></span><div class="grow"><b>${n.title}</b><p>${n.text}</p>
      <div class="row between"><span class="when">${n.when}</span>${n.status}</div></div><span class="unread"></span></article>`).join('');
    $('#empty').classList.toggle('show', items.length === 0);
    $('#unreadCount').textContent = unread.size || '';
    $('#badge').textContent = unread.size; $('#badge').classList.toggle('gone', unread.size === 0);
    $('#bell').setAttribute('aria-label', unread.size ? `Inbox, ${unread.size} new` : 'Inbox');
    arrive(list);
  }
  $('#notifs').addEventListener('click', async (e) => {
    const n = e.target.closest('.notif'); if (!n) return;
    unread.delete(+n.dataset.i); n.classList.add('read');
    if (filter === 'unread') { n.classList.add('leaving'); await wait(220); }
    renderInbox();
  });
  const openInbox = () => { $('#s-inbox').classList.add('active'); renderInbox(); };
  $('#bell').addEventListener('click', openInbox);
  $('#inboxBack').addEventListener('click', () => $('#s-inbox').classList.remove('active'));
  $('#markRead').addEventListener('click', () => { unread.clear(); $$('.notif').forEach((n) => n.classList.add('read')); setTimeout(renderInbox, 260); });
  function setFilter(f) { filter = f; $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.f === f)); $('#seg').classList.toggle('right', f === 'unread'); renderInbox(); }
  $$('#seg button').forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.f)));
  $('#seeAll').addEventListener('click', () => setFilter('all'));

  // Start
  tickClock(); setInterval(tickClock, 15000);
  requestAnimationFrame(() => { moveIndicator($('.tab.on')); arrive($('#s-home')); });
  setTimeout(() => $('#bell').classList.add('ring'), 900);
})();
