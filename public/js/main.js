import { api, ApiError } from './api.js';
import { h, mount, toast, loading, $ } from './ui.js';
import { state, refreshMe, go } from './state.js';
import { stopAudio } from './audio.js';
import { loginView, registerView } from './views/auth.js';
import { diagnosticView } from './views/diagnostic.js';
import { goalView } from './views/goal.js';
import { homeView } from './views/home.js';
import { trajectoryView } from './views/trajectory.js';
import { lessonView } from './views/lesson.js';
import { readingTrainerView, listeningTrainerView, speakingTrainerView } from './views/trainers.js';
import { progressView } from './views/progress.js';
import { profileView } from './views/profile.js';
import { teacherHomeView, teacherStudentView, teacherMaterialsView } from './views/teacher.js';

const S = 'student', T = 'teacher';
const routes = [
  [/^\/login$/, null, loginView], [/^\/register$/, null, registerView],
  [/^\/$/, S, homeView], [/^\/diagnostic$/, S, diagnosticView], [/^\/goal$/, S, goalView],
  [/^\/trajectory(?:\/(\d{4}-\d{2}-\d{2}))?$/, S, trajectoryView], [/^\/task\/(\d+)$/, S, lessonView],
  [/^\/trainer\/reading$/, S, readingTrainerView], [/^\/trainer\/listening$/, S, listeningTrainerView], [/^\/trainer\/speaking(?:\/(\d+))?$/, S, speakingTrainerView],
  [/^\/progress$/, S, progressView], [/^\/profile$/, S, profileView],
  [/^\/t$/, T, teacherHomeView], [/^\/t\/student\/(\d+)(?:\/(\w+))?$/, T, teacherStudentView], [/^\/t\/materials$/, T, teacherMaterialsView], [/^\/t\/profile$/, T, profileView],
];

const NAV_S = [
  ['/', '🏠', 'Bosh sahifa'], ['/trajectory', '🗓️', 'Traektoriya (bugungi dars)'], ['sep', 'Trenajyorlar'],
  ['/trainer/reading', '📖', 'Reading trenajyor'], ['/trainer/listening', '🎧', 'Listening trenajyor'], ['/trainer/speaking', '🎤', 'Speaking trenajyor'],
  ['sep', 'Natijalar'], ['/progress', '📈', 'Progress va tahlil'], ['/profile', '👤', 'Profil'],
];
const NAV_T = [['/t', '👥', "O'quvchilar"], ['/t/materials', '📚', 'Materiallar'], ['/t/profile', '👤', 'Profil']];

const root = document.getElementById('app');
let view = null;

function shell(content) {
  const nav = (state.me.user.role === 'teacher' ? NAV_T : NAV_S);
  const cur = location.hash.slice(1) || '/';
  const side = h('aside', { class: 'sidebar', id: 'side' },
    h('div', { class: 'brand' }, h('span', { class: 'logo' }, 'L'), 'LearnEng'),
    h('nav', { class: 'nav' }, nav.map((n) => n[0] === 'sep' ? h('div', { class: 'sep' }, n[1]) :
      h('a', { href: '#' + n[0], class: (n[0] === '/' ? cur === '/' : cur.startsWith(n[0])) ? 'active' : '', onclick: () => $('#side').classList.remove('open') }, n[1], ' ', n[2]))),
    h('div', { class: 'me' }, h('b', {}, state.me.user.name), h('div', { class: 'muted' }, state.me.user.role === 'teacher' ? "O'qituvchi" : "O'quvchi"),
      !state.me.ai && h('div', { class: 'badge warn', style: { marginTop: '8px' }, title: ".env faylida GEMINI_API_KEY ni kiriting" }, "AI ulanmagan"),
      h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn secondary sm', onclick: logout }, 'Chiqish'))));
  return h('div', { class: 'layout' }, side,
    h('div', {}, h('div', { class: 'topbar' }, h('button', { class: 'btn secondary sm', onclick: () => $('#side').classList.toggle('open'), 'aria-label': 'Menyu' }, '☰'), h('b', {}, 'LearnEng')),
      h('main', { class: 'main', id: 'view' }, content)));
}

async function logout() {
  await api.post('/api/auth/logout').catch(() => {});
  state.me = null; go('#/login');
}

async function render() {
  stopAudio();
  const path = location.hash.slice(1) || '/';
  const hit = routes.map(([re, role, fn]) => [re.exec(path), role, fn]).find(([m]) => m);
  if (!state.me) { try { await refreshMe(); } catch { state.me = null; } }
  if (!hit) { go('#/'); return; }
  const [m, role, fn] = hit;
  if (!state.me) { if (role) { go('#/login'); return; } mount(root, h('div', { class: 'auth' }, await fn({ args: m.slice(1), me: null }))); return; }
  if (!role) { go(state.me.user.role === 'teacher' ? '#/t' : '#/'); return; }
  if (role !== state.me.user.role) { go(state.me.user.role === 'teacher' ? '#/t' : '#/'); return; }
  if (role === S) { // onboarding guard
    await refreshMe();
    const st = state.me.state;
    if (st.diagnostic !== 'done' && path !== '/diagnostic' && path !== '/profile') { go('#/diagnostic'); return; }
    if (st.diagnostic === 'done' && !st.hasGoal && !['/goal', '/diagnostic', '/profile'].includes(path)) { go('#/goal'); return; }
  }
  const token = (view = Symbol());
  const host = shell(loading());
  mount(root, host);
  try {
    const node = await fn({ args: m.slice(1), me: state.me }, m);
    if (token !== view) return;
    mount($('#view'), node);
    window.scrollTo(0, 0);
    document.title = 'LearnEng';
  } catch (e) {
    if (token !== view) return;
    console.error(e);
    mount($('#view'), h('div', { class: 'alert bad' }, e instanceof ApiError ? e.message : "Kutilmagan xato. Sahifani yangilang."));
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('auth-lost', () => { state.me = null; go('#/login'); });
window.addEventListener('unhandledrejection', (e) => { if (e.reason instanceof ApiError) { toast(e.reason.message, true); e.preventDefault(); } });
render();
