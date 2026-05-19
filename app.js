(() => {
  'use strict';

  // Résolution robuste pour GitHub Pages, même si l'URL est ouverte sans slash final.
  const SCRIPT_URL = document.currentScript?.src || new URL('src/app.js', window.location.href).href;
  const APP_ROOT = new URL('../', SCRIPT_URL).href;
  const ASSET = (path) => new URL(String(path).replace(/^\.\//, ''), APP_ROOT).href;
  const STORAGE_KEY = 'edenschool.eden5.state';
  const APP = document.getElementById('app');
  const TPL = 'assets/templates/';

  const SFX = {
    click: 'audio/sfx/ui_click_01.wav',
    click2: 'audio/sfx/ui_click_02.wav',
    back: 'audio/sfx/ui_back_01.wav',
    open: 'audio/sfx/ui_open_panel_01.wav',
    close: 'audio/sfx/ui_close_panel_01.wav',
    page: 'audio/sfx/page_transition_01.wav',
    avatar: 'audio/sfx/avatar_select_01.wav',
    correct: 'audio/sfx/quiz_correct_01.wav',
    wrong: 'audio/sfx/quiz_wrong_01.wav',
    validate: 'audio/sfx/exercise_validate_01.wav',
    reward: 'audio/sfx/reward_badge_01.wav',
    complete: 'audio/sfx/mission_complete_01.wav',
    parent: 'audio/sfx/parent_unlock_01.wav',
    toggle: 'audio/sfx/toggle_01.wav'
  };

  const app = {
    manifest: null,
    subjects: {},
    avatars: [],
    badges: [],
    page: 'loading',
    subjectId: 'francais',
    missionId: null,
    mode: null,
    index: 0,
    selectedAnswer: null,
    code: '',
    toastTimer: null,
    audioUnlocked: false,
    music: null,
    state: {
      version: 1,
      profileCreated: false,
      classId: 'cm2',
      avatarId: 'avatar_01',
      xp: 0,
      level: 1,
      settings: { music: true, sfx: true },
      unlockedBadges: [],
      progress: {},
      last: { subjectId: 'francais', missionId: null }
    }
  };

  const subjectPositions = {
    maths:       { x: 18, y: 38, w: 22, h: 13, labelX: 18, labelY: 47.2 },
    francais:   { x: 40, y: 34, w: 22, h: 13, labelX: 50, labelY: 44.6 },
    histoiregeo:{ x: 67, y: 37, w: 24, h: 14, labelX: 78, labelY: 47.3 },
    sciences:   { x: 12, y: 55, w: 23, h: 13, labelX: 16, labelY: 65.2 },
    emc:        { x: 68, y: 55, w: 25, h: 13, labelX: 81, labelY: 65.2 },
    anglais:    { x: 12, y: 74, w: 23, h: 13, labelX: 18, labelY: 84.8 },
    arts:       { x: 68, y: 74, w: 25, h: 13, labelX: 80, labelY: 84.9 }
  };

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      app.state = merge(app.state, parsed);
    } catch (err) {
      console.warn('Sauvegarde locale illisible.', err);
    }
  }

  function merge(base, incoming) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    Object.keys(incoming || {}).forEach(k => {
      if (incoming[k] && typeof incoming[k] === 'object' && !Array.isArray(incoming[k]) && base[k]) out[k] = merge(base[k], incoming[k]);
      else out[k] = incoming[k];
    });
    return out;
  }

  async function fetchJson(path) {
    const res = await fetch(ASSET(path), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Impossible de charger ${path}`);
    return res.json();
  }

  async function init() {
    loadState();
    app.manifest = await fetchJson('data/classes/cm2/manifest.json');
    const [avatars, badges] = await Promise.all([
      fetchJson('data/atlases/avatars.json'),
      fetchJson('data/atlases/badges.json')
    ]);
    app.avatars = avatars.items;
    app.badges = badges.items;
    await Promise.all(app.manifest.subjects.map(async s => {
      app.subjects[s.id] = await fetchJson(`data/classes/cm2/${s.id}.json`);
    }));
    if (!app.state.last.missionId) {
      const first = app.subjects[app.manifest.defaultSubject].missions[0];
      app.state.last = { subjectId: app.manifest.defaultSubject, missionId: first.id };
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(ASSET('service-worker.js')).catch(() => {});
    }
    go(app.state.profileCreated ? 'home' : 'createProfile');
  }

  function stage({ template, bg = null, home = false, bottom = false, className = '' }) {
    const wrap = document.createElement('section');
    wrap.className = `stage ${className}`;
    wrap.setAttribute('role', 'application');
    if (bg) wrap.append(img(bg, 'scene-bg', ''));
    if (template) wrap.append(img(template, home ? 'home-overlay' : 'template', ''));
    if (bottom) wrap.append(bottomBar());
    APP.replaceChildren(wrap);
    return wrap;
  }

  function img(path, cls, alt) {
    const i = document.createElement('img');
    i.src = ASSET(path);
    i.className = cls;
    i.alt = alt || '';
    i.decoding = 'async';
    i.draggable = false;
    return i;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function cssBox(node, x, y, w, h) {
    Object.assign(node.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
    return node;
  }

  function hot(parent, x, y, w, h, label, fn, sfx = 'click') {
    const b = document.createElement('button');
    b.className = 'hotspot';
    b.type = 'button';
    b.setAttribute('aria-label', label);
    cssBox(b, x, y, w, h);
    b.addEventListener('click', () => { play(sfx); fn(); });
    parent.append(b);
    return b;
  }

  function button(parent, x, y, w, h, label, fn, small = false) {
    const b = el('button', `button${small ? ' small' : ''}`, label);
    b.type = 'button';
    cssBox(b, x, y, w, h);
    b.addEventListener('click', () => { play('click'); fn(); });
    parent.append(b);
    return b;
  }

  function text(parent, cls, x, y, w, h, html) {
    const n = el('div', cls);
    cssBox(n, x, y, w, h);
    n.innerHTML = html;
    parent.append(n);
    return n;
  }

  function title(parent, value) {
    const t = el('div', 'top-title', value);
    parent.append(t);
    return t;
  }

  function smallTop(parent, value) {
    const t = el('div', 'top-small', value);
    parent.append(t);
    return t;
  }

  function bottomBar() {
    const bar = el('nav', 'bottom-bar');
    const items = [
      ['Accueil', () => go('home'), 'click'],
      ['Matières', () => go('roadmap'), 'click'],
      ['Progression', () => go('profile'), 'click'],
      ['Profil', () => go('profile'), 'click'],
      ['Menu', () => go('settings'), 'click']
    ];
    items.forEach(([label, fn, sfx]) => {
      const b = el('button', 'bottom-hit');
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.addEventListener('click', () => { play(sfx); fn(); });
      bar.append(b);
    });
    return bar;
  }

  function go(page, opts = {}) {
    Object.assign(app, opts);
    app.page = page;
    app.selectedAnswer = null;
    play(page === 'home' || page === 'roadmap' ? 'page' : 'open');
    render();
  }

  function currentSubject() { return app.subjects[app.subjectId] || app.subjects[app.manifest.defaultSubject]; }
  function currentMission() {
    const subj = currentSubject();
    return subj.missions.find(m => m.id === app.missionId) || subj.missions[0];
  }
  function missionKey(subjectId = app.subjectId, missionId = app.missionId) { return `${subjectId}.${missionId}`; }
  function progressFor(subjectId, missionId) { return app.state.progress[missionKey(subjectId, missionId)] || {}; }

  function render() {
    if (!app.manifest) return;
    const routes = {
      createProfile, home, roadmap, subjectHome, mission, lesson, quiz, exercises, result, profile, settings, avatarSelect, parentGate, parentControl
    };
    (routes[app.page] || home)();
  }

  function createProfile() {
    const s = stage({ template: `${TPL}Bootpage.webp`, className: 'create-profile' });
    const av = findAvatar(app.state.avatarId);
    if (av) s.append(Object.assign(img(av.file, 'selected-avatar', 'Avatar choisi'), { ariaHidden: true }));
    text(s, 'start-hint', 15, 68.5, 70, 4, app.state.avatarId ? 'Avatar sélectionné' : 'Choisis un avatar pour commencer');
    hot(s, 24, 70.5, 52, 7.7, 'Choisir avatar', () => go('avatarSelect', { mode: 'profileCreate' }), 'avatar');
    hot(s, 24, 81.4, 52, 7.7, 'Commencer', () => {
      app.state.profileCreated = true;
      save();
      go('home');
    }, 'complete');
  }

  function home() {
    const s = stage({ template: `${TPL}Homepage.webp`, bg: 'assets/ui/Background1.webp', home: true, bottom: true, className: 'home' });
    const last = ensureLastMission();
    text(s, 'panel-text', 38, 2.6, 25, 5, `Bonjour`);
    text(s, 'panel-text', 54, 19, 34, 5, `Niv. ${app.state.level} · ${app.state.xp} XP`);
    const daily = dailyMission();
    text(s, 'panel-text', 30, 40.7, 46, 4.5, daily.mission.title);
    text(s, 'panel-text', 31, 64.6, 38, 4, `${completionRate()}% complété`);
    hot(s, 47, 26, 41, 8, 'Reprendre la mission', () => openMission(last.subjectId, last.missionId), 'click2');
    hot(s, 6, 38, 88, 13, 'Mission du jour', () => openMission(daily.subjectId, daily.mission.id), 'open');
    hot(s, 6, 55, 88, 11, 'Progression', () => go('profile'), 'open');
    hot(s, 6, 71, 88, 11, 'Compétence à revoir', () => openMission(daily.subjectId, daily.mission.id), 'open');
  }

  function roadmap() {
    const s = stage({ template: `${TPL}RoadMap.webp`, className: 'subject-map' });
    app.manifest.subjects.forEach(meta => {
      const pos = subjectPositions[meta.id];
      if (!pos) return;
      const b = el('button', 'subject-hot');
      b.type = 'button';
      b.setAttribute('aria-label', meta.label);
      cssBox(b, pos.x, pos.y, pos.w, pos.h);
      b.addEventListener('click', () => { play('open'); go('subjectHome', { subjectId: meta.id }); });
      s.append(b);
      const lab = el('div', 'subject-label', meta.label);
      Object.assign(lab.style, { left: `${pos.labelX}%`, top: `${pos.labelY}%` });
      s.append(lab);
    });
    hot(s, 41, 52, 20, 11, 'Académie Eden', () => go('home'), 'click');
  }

  function subjectHome() {
    const subj = currentSubject();
    const s = stage({ template: `${TPL}Matierehomepage.webp`, bg: 'assets/ui/Background2.webp', className: 'subject-home' });
    title(s, subj.label);
    smallTop(s, `${subjectCompletion(subj.id)}%`);
    hot(s, 5.2, 7, 11, 7.5, 'Retour', () => go('roadmap'), 'back');
    text(s, 'panel-text', 18, 18, 64, 5, `<strong>Progression</strong><br>${subj.description}`);
    const list = el('div', 'mission-list');
    s.append(list);
    subj.missions.forEach((m, i) => {
      const p = progressFor(subj.id, m.id);
      const row = el('button', 'mission-row');
      row.type = 'button';
      row.setAttribute('aria-label', `Ouvrir ${m.title}`);
      const badge = img(findBadgeFile(m.reward.badge), 'badge-img', '');
      row.append(badge);
      const body = el('div');
      body.innerHTML = `<strong>${m.title}</strong><br><span>${m.subtitle}</span><div class="progress-bar"><i style="width:${missionPercent(p)}%"></i></div>`;
      row.append(body);
      row.append(el('div', 'state', p.completed ? 'Terminé' : 'Ouvrir'));
      row.addEventListener('click', () => openMission(subj.id, m.id));
      list.append(row);
    });
  }

  function openMission(subjectId, missionId) {
    app.subjectId = subjectId;
    app.missionId = missionId;
    app.state.last = { subjectId, missionId };
    save();
    go('mission');
  }

  function mission() {
    const subj = currentSubject(), m = currentMission(), p = progressFor();
    const s = stage({ template: `${TPL}Missionpage.webp`, className: 'mission' });
    title(s, subj.label);
    smallTop(s, `${missionPercent(p)}%`);
    hot(s, 5, 6.7, 11, 7.6, 'Retour', () => go('subjectHome'), 'back');
    text(s, 'panel-text', 12, 19, 76, 10, `<div class="panel-heading">${m.title}</div>${m.subtitle}`);
    text(s, 'panel-text', 14, 37, 32, 7, `<span class="stat-value">${m.estimatedTime}</span>`);
    text(s, 'panel-text', 54, 37, 32, 7, `<span class="stat-value">${m.difficulty}</span>`);
    hot(s, 11, 49, 37, 20, 'Leçon', () => go('lesson'), 'open');
    hot(s, 52, 49, 37, 20, 'Quiz', () => go('quiz', { index: 0 }), 'open');
    hot(s, 11, 72, 37, 20, 'Exercices', () => go('exercises', { index: 0 }), 'open');
    hot(s, 52, 72, 37, 20, 'Résultat', () => go('result'), 'open');
  }

  function lesson() {
    const subj = currentSubject(), m = currentMission();
    const s = stage({ template: `${TPL}Lessonpage.webp`, className: 'lesson' });
    title(s, subj.label);
    hot(s, 5, 6.7, 11, 7.6, 'Retour', () => go('mission'), 'back');
    text(s, 'panel-text', 12, 18.3, 76, 7, `<strong>${m.title}</strong><br>${m.subtitle}`);
    text(s, 'panel-text scroll-text', 12, 34.2, 76, 29.2, `<div class="body-copy">${escapeHtml(m.lesson.content)}</div>`);
    text(s, 'panel-text scroll-text', 12, 70, 76, 9.2, `<div class="body-copy"><strong>À retenir :</strong> ${escapeHtml(m.lesson.remember)}</div>`);
    hot(s, 13, 83.3, 74, 8.2, 'Commencer le quiz', () => go('quiz', { index: 0 }), 'click2');
  }

  function quiz() {
    const subj = currentSubject(), m = currentMission();
    const items = m.quiz;
    const item = items[app.index] || items[0];
    const s = stage({ template: `${TPL}Quizpage.webp`, className: 'quiz' });
    title(s, subj.label);
    smallTop(s, `${app.index + 1}/${items.length}`);
    hot(s, 5, 6.7, 11, 7.6, 'Retour', () => go('mission'), 'back');
    text(s, 'panel-text', 12, 17.8, 76, 7, `<strong>${m.title}</strong>`);
    text(s, 'panel-text scroll-text', 13, 35.8, 74, 15, `<div class="panel-heading">${escapeHtml(item.prompt)}</div>`);
    const boxes = [[11,54.8,37,13.2],[52,54.8,37,13.2],[11,71.5,37,13.2],[52,71.5,37,13.2]];
    item.choices.forEach((choice, i) => {
      const b = el('button', 'answer-card', `${'ABCD'[i]}. ${choice}`);
      b.type = 'button';
      cssBox(b, ...boxes[i]);
      b.addEventListener('click', () => selectAnswer(b, i));
      s.append(b);
    });
    hot(s, 25, 87.5, 50, 8, 'Valider', () => validateQuiz(item, items.length), 'validate');
  }

  function exercises() {
    const subj = currentSubject(), m = currentMission();
    const items = m.exercises;
    const item = items[app.index] || items[0];
    const s = stage({ template: `${TPL}Exercicepage.webp`, className: 'exercise' });
    title(s, subj.label);
    smallTop(s, `${app.index + 1}/${items.length}`);
    hot(s, 5, 6.7, 11, 7.6, 'Retour', () => go('mission'), 'back');
    text(s, 'panel-text scroll-text', 13, 30.2, 74, 20, `<div class="panel-heading">${escapeHtml(item.instruction)}</div>`);
    const boxes = [[11,57,37,10.8],[52,57,37,10.8],[11,70.8,37,10.8],[52,70.8,37,10.8]];
    item.choices.forEach((choice, i) => {
      const b = el('button', 'answer-card', `${'ABCD'[i]}. ${choice}`);
      b.type = 'button';
      cssBox(b, ...boxes[i]);
      b.addEventListener('click', () => selectAnswer(b, i));
      s.append(b);
    });
    hot(s, 25, 87.5, 50, 8, 'Valider', () => validateExercise(item, items.length), 'validate');
  }

  function selectAnswer(node, idx) {
    play('click2');
    app.selectedAnswer = idx;
    [...document.querySelectorAll('.answer-card')].forEach(n => n.classList.remove('selected'));
    node.classList.add('selected');
  }

  function validateQuiz(item, total) {
    if (app.selectedAnswer === null) { toast('Choisis une réponse.'); return; }
    const ok = app.selectedAnswer === item.answer;
    play(ok ? 'correct' : 'wrong');
    document.querySelectorAll('.answer-card').forEach((n, i) => {
      if (i === item.answer) n.classList.add('correct');
      else if (i === app.selectedAnswer) n.classList.add('wrong');
    });
    updateProgress('quiz', ok);
    setTimeout(() => {
      if (app.index + 1 < total) go('quiz', { index: app.index + 1 });
      else { toast(item.explanation); setTimeout(() => go('exercises', { index: 0 }), 800); }
    }, 650);
  }

  function validateExercise(item, total) {
    if (app.selectedAnswer === null) { toast('Choisis une réponse.'); return; }
    const ok = app.selectedAnswer === item.answer;
    play(ok ? 'correct' : 'wrong');
    document.querySelectorAll('.answer-card').forEach((n, i) => {
      if (i === item.answer) n.classList.add('correct');
      else if (i === app.selectedAnswer) n.classList.add('wrong');
    });
    updateProgress('exercise', ok);
    setTimeout(() => {
      if (app.index + 1 < total) go('exercises', { index: app.index + 1 });
      else { toast(item.explanation); setTimeout(() => completeMission(), 800); }
    }, 650);
  }

  function updateProgress(kind, ok) {
    const k = missionKey();
    const m = currentMission();
    const p = app.state.progress[k] || { quizCorrect: 0, quizTotal: 0, exerciseCorrect: 0, exerciseTotal: 0, completed: false };
    if (kind === 'quiz') { p.quizTotal = Math.min(m.quiz.length, (p.quizTotal || 0) + 1); if (ok) p.quizCorrect = (p.quizCorrect || 0) + 1; }
    if (kind === 'exercise') { p.exerciseTotal = Math.min(m.exercises.length, (p.exerciseTotal || 0) + 1); if (ok) p.exerciseCorrect = (p.exerciseCorrect || 0) + 1; }
    app.state.progress[k] = p;
    save();
  }

  function completeMission() {
    const k = missionKey();
    const m = currentMission();
    const p = app.state.progress[k] || {};
    const already = !!p.completed;
    p.completed = true;
    p.completedAt = new Date().toISOString();
    app.state.progress[k] = p;
    if (!already) {
      app.state.xp += m.reward.xp;
      app.state.level = 1 + Math.floor(app.state.xp / 250);
      if (!app.state.unlockedBadges.includes(m.reward.badge)) app.state.unlockedBadges.push(m.reward.badge);
      play('complete');
    }
    save();
    go('result');
  }

  function result() {
    const subj = currentSubject(), m = currentMission(), p = progressFor();
    const s = stage({ template: `${TPL}Resultpage.webp`, className: 'result' });
    title(s, 'Résultat');
    const score = scoreFor(p, m);
    text(s, 'panel-text', 12, 20, 76, 15, `<div class="stat-value">${score}%</div><br>${m.title}<br>XP mission : ${m.reward.xp}`);
    text(s, 'panel-text', 10, 48.5, 38, 12, `<div class="stat-value">${p.quizCorrect || 0}/${m.quiz.length}</div><br>bonnes réponses`);
    text(s, 'panel-text', 52, 48.5, 38, 12, `<div class="stat-value">${p.exerciseCorrect || 0}/${m.exercises.length}</div><br>exercices réussis`);
    text(s, 'panel-text scroll-text', 12, 68.2, 76, 10, `<div class="body-copy">${escapeHtml(m.lesson.remember)}</div>`);
    const row = el('div', 'result-badge-row');
    row.append(img(findBadgeFile(m.reward.badge), 'badge-img', 'Badge débloqué'));
    s.append(row);
    hot(s, 31, 90, 38, 7, 'Terminer', () => go('subjectHome'), 'reward');
  }

  function profile() {
    const s = stage({ template: `${TPL}Profilpage.webp`, bg: 'assets/ui/Background2.webp', bottom: true, className: 'profile' });
    const av = findAvatar(app.state.avatarId);
    if (av) s.append(img(av.file, 'profile-avatar', 'Avatar'));
    text(s, 'panel-text', 13, 15.8, 74, 8, `<div class="panel-heading">Profil CM2</div>Progression locale Eden5`);
    text(s, 'panel-text', 14, 44, 33, 8, `<span class="stat-value">${app.state.level}</span>`);
    text(s, 'panel-text', 54, 44, 33, 8, `<span class="stat-value">${app.state.xp}</span>`);
    text(s, 'panel-text', 13, 63.1, 74, 5, `<div class="progress-bar"><i style="width:${completionRate()}%"></i></div><br>${completionRate()}% des missions terminées`);
    const badges = el('div', 'profile-badges');
    const unlocked = app.state.unlockedBadges.slice(-8);
    if (!unlocked.length) badges.append(el('div', '', 'Aucun badge pour le moment'));
    unlocked.forEach(id => badges.append(img(findBadgeFile(id), 'badge-img', id)));
    s.append(badges);
    hot(s, 13, 88, 74, 7, 'Changer avatar', () => go('avatarSelect', { mode: 'profileEdit' }), 'avatar');
  }

  function settings() {
    const s = stage({ template: `${TPL}Settingpage.webp`, className: 'settings' });
    const music = el('button', `settings-control ${app.state.settings.music ? 'on' : ''}`);
    cssBox(music, 70, 28.5, 14, 4.7);
    music.setAttribute('aria-label', 'Activer ou désactiver la musique');
    music.addEventListener('click', () => { app.state.settings.music = !app.state.settings.music; save(); play('toggle'); syncMusic(); render(); });
    s.append(music);
    const sfx = el('button', `settings-control ${app.state.settings.sfx ? 'on' : ''}`);
    cssBox(sfx, 70, 36, 14, 4.7);
    sfx.setAttribute('aria-label', 'Activer ou désactiver les sons');
    sfx.addEventListener('click', () => { app.state.settings.sfx = !app.state.settings.sfx; save(); render(); });
    s.append(sfx);
    hot(s, 68, 52, 16, 5, 'Modifier pseudo', () => toast('Pseudo désactivé pour Eden5 : profil sans prénom.'), 'click');
    hot(s, 68, 60, 16, 5, 'Changer avatar', () => go('avatarSelect', { mode: 'profileEdit' }), 'avatar');
    hot(s, 28, 81.5, 44, 7.5, 'Ouvrir parents', () => go('parentGate'), 'parent');
  }

  function avatarSelect() {
    const s = stage({ template: null, bg: 'assets/ui/Background2.webp', className: 'avatar-select' });
    text(s, 'overlay-title', 8, 7, 84, 7, 'Choisir avatar');
    button(s, 6, 7, 18, 5, 'Retour', () => go(app.mode === 'profileCreate' ? 'createProfile' : 'profile'), true);
    const grid = el('div', 'avatar-grid');
    app.avatars.forEach(a => {
      const card = el('button', `avatar-card ${app.state.avatarId === a.id ? 'selected' : ''}`);
      card.type = 'button';
      card.setAttribute('aria-label', a.id);
      card.append(img(a.file, 'avatar-img', a.id));
      card.addEventListener('click', () => {
        app.state.avatarId = a.id;
        save();
        play('avatar');
        go(app.mode === 'profileCreate' ? 'createProfile' : 'profile');
      });
      grid.append(card);
    });
    s.append(grid);
  }

  function parentGate() {
    const s = stage({ template: null, bg: 'assets/ui/Background2.webp', className: 'parent-gate' });
    text(s, 'overlay-title', 8, 8, 84, 7, 'Accès parents');
    button(s, 6, 7, 18, 5, 'Retour', () => go('settings'), true);
    const box = el('div', 'code-box');
    box.innerHTML = `<h2>Code parent</h2><div class="code-display">${'•'.repeat(app.code.length)}</div>`;
    const keypad = el('div', 'keypad');
    ['1','2','3','4','5','6','7','8','9','Effacer','0','OK'].forEach(v => {
      const k = el('button', '', v);
      k.type = 'button';
      k.addEventListener('click', () => handleCode(v));
      keypad.append(k);
    });
    box.append(keypad);
    s.append(box);
  }

  function handleCode(value) {
    play('click2');
    if (value === 'Effacer') app.code = app.code.slice(0, -1);
    else if (value === 'OK') {
      if (app.code === app.manifest.parentsCode) { app.code = ''; play('parent'); go('parentControl'); return; }
      app.code = ''; toast('Code incorrect.');
    } else if (app.code.length < 5) app.code += value;
    render();
  }

  function parentControl() {
    const s = stage({ template: null, bg: 'assets/ui/Background2.webp', className: 'parent-control' });
    text(s, 'overlay-title', 8, 7, 84, 7, 'Contrôle parents');
    button(s, 6, 7, 18, 5, 'Retour', () => go('settings'), true);
    const panel = el('section', 'parent-panel');
    panel.innerHTML = `<h2>Suivi local</h2>`;
    const stats = [
      ['Classe active', app.manifest.classLabel],
      ['XP total', app.state.xp],
      ['Niveau', app.state.level],
      ['Missions terminées', `${completedMissions()}/${totalMissions()}`],
      ['Badges débloqués', app.state.unlockedBadges.length],
      ['Sauvegarde', 'localStorage'],
      ['Firebase', 'Stub présent pour version définitive']
    ];
    stats.forEach(([a,b]) => {
      const row = el('div', 'parent-stat');
      row.innerHTML = `<strong>${a}</strong><span>${b}</span>`;
      panel.append(row);
    });
    const reset = el('button', 'button small', 'Réinitialiser la sauvegarde locale');
    reset.style.position = 'static'; reset.style.marginTop = '20px'; reset.style.width = '100%';
    reset.addEventListener('click', () => {
      if (confirm('Réinitialiser la progression locale ?')) {
        localStorage.removeItem(STORAGE_KEY); location.reload();
      }
    });
    panel.append(reset);
    s.append(panel);
  }

  function findAvatar(id) { return app.avatars.find(a => a.id === id) || app.avatars[0]; }
  function findBadgeFile(id) { const b = app.badges.find(x => x.id === id); return b ? b.file : 'assets/badges/badge_01.webp'; }

  function ensureLastMission() {
    const subj = app.subjects[app.state.last.subjectId] ? app.state.last.subjectId : app.manifest.defaultSubject;
    const m = app.subjects[subj].missions.find(x => x.id === app.state.last.missionId) || app.subjects[subj].missions[0];
    return { subjectId: subj, missionId: m.id };
  }

  function dailyMission() {
    const ids = app.manifest.subjects.map(s => s.id);
    const day = Math.floor(Date.now() / 86400000);
    const subjectId = ids[day % ids.length];
    const missions = app.subjects[subjectId].missions;
    return { subjectId, mission: missions[day % missions.length] };
  }

  function totalMissions() { return Object.values(app.subjects).reduce((n, s) => n + s.missions.length, 0); }
  function completedMissions() { return Object.values(app.state.progress).filter(p => p.completed).length; }
  function completionRate() { return Math.round((completedMissions() / Math.max(1, totalMissions())) * 100); }
  function subjectCompletion(subjectId) {
    const subj = app.subjects[subjectId];
    const done = subj.missions.filter(m => progressFor(subjectId, m.id).completed).length;
    return Math.round((done / Math.max(1, subj.missions.length)) * 100);
  }
  function missionPercent(p) {
    if (!p) return 0;
    if (p.completed) return 100;
    const q = Math.min(50, ((p.quizTotal || 0) / 2) * 50);
    const e = Math.min(50, ((p.exerciseTotal || 0) / 2) * 50);
    return Math.round(q + e);
  }
  function scoreFor(p, m) {
    const total = m.quiz.length + m.exercises.length;
    const ok = (p.quizCorrect || 0) + (p.exerciseCorrect || 0);
    return Math.round((ok / Math.max(1,total)) * 100);
  }

  function play(name) {
    unlockAudio();
    if (!app.state.settings.sfx) return;
    const path = SFX[name] || SFX.click;
    const a = new Audio(ASSET(path));
    a.volume = 0.55;
    a.play().catch(() => {});
  }

  function unlockAudio() {
    if (app.audioUnlocked) return;
    app.audioUnlocked = true;
    syncMusic();
  }

  function syncMusic() {
    if (!app.audioUnlocked) return;
    if (!app.music) {
      app.music = new Audio(ASSET('audio/music/ambient_loop.wav'));
      app.music.loop = true;
      app.music.volume = 0.18;
    }
    if (app.state.settings.music) app.music.play().catch(() => {});
    else app.music.pause();
  }

  function toast(message) {
    const stageNode = document.querySelector('.stage');
    if (!stageNode) return;
    clearTimeout(app.toastTimer);
    const old = stageNode.querySelector('.toast');
    if (old) old.remove();
    const t = el('div', 'toast', message);
    stageNode.append(t);
    app.toastTimer = setTimeout(() => t.remove(), 1800);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  window.EdenSchool = {
    exportSave: () => JSON.parse(JSON.stringify(app.state)),
    importSave: (state) => { app.state = merge(app.state, state); save(); render(); },
    reset: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); }
  };

  init().catch(err => {
    console.error(err);
    APP.innerHTML = `<div style="color:white;padding:24px;font-family:sans-serif">Erreur de chargement Eden5 : ${escapeHtml(err.message)}</div>`;
  });
})();
