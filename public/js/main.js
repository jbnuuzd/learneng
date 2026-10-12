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
import { readingTrainerView, listeningTrainerView, speakingTrainerView, pronunciationTrainerView } from './views/trainers.js';
import { progressView } from './views/progress.js';
import { mockView } from './views/mock.js';
import { profileView } from './views/profile.js';
import { teacherHomeView, teacherStudentView, teacherMaterialsView, teacherWeeklyView } from './views/teacher.js';

const S = 'student', T = 'teacher';
const routes = [
  [/^\/login$/, null, loginView], [/^\/register$/, null, registerView],
  [/^\/$/, S, homeView], [/^\/diagnostic$/, S, diagnosticView], [/^\/goal$/, S, goalView],
  [/^\/trajectory(?:\/(\d{4}-\d{2}-\d{2}))?$/, S, trajectoryView], [/^\/task\/(\d+)$/, S, lessonView],
  [/^\/trainer\/reading$/, S, readingTrainerView], [/^\/trainer\/listening$/, S, listeningTrainerView], [/^\/trainer\/pronunciation$/, S, pronunciationTrainerView], [/^\/trainer\/speaking(?:\/(\d+))?$/, S, speakingTrainerView],
  [/^\/mock(?:\/(\d+))?$/, S, mockView], [/^\/progress$/, S, progressView], [/^\/profile$/, S, profileView],
  [/^\/t$/, T, teacherHomeView], [/^\/t\/student\/(\d+)(?:\/(\w+))?$/, T, teacherStudentView], [/^\/t\/materials$/, T, teacherMaterialsView], [/^\/t\/weekly$/, T, teacherWeeklyView], [/^\/t\/profile$/, T, profileView],
];

const NAV_S = [
  ['/', '🏠', 'Bosh sahifa'], ['/trajectory', '🗓️', 'Traektoriya (bugungi dars)'], ['sep', 'Trenajyorlar'],
  ['/trainer/reading', '📖', 'Reading trenajyor'], ['/trainer/listening', '🎧', 'Listening trenajyor'], ['/trainer/speaking', '🎤', 'Speaking trenajyor'], ['/trainer/pronunciation', '🗣', 'Talaffuz mashqi'],
  ['sep', 'Natijalar'], ['/mock', '📝', 'IELTS mock test'], ['/progress', '📈', 'Progress va tahlil'], ['/profile', '👤', 'Profil'],
];
const NAV_T = [['/t', '👥', "O'quvchilar"], ['/t/weekly', '📊', 'Haftalik hisobot'], ['/t/materials', '📚', 'Materiallar va lug\'at'], ['/t/profile', '👤', 'Profil']];

// ---- theme: auto (system) / light / dark, remembered per browser
const THEMES = [['auto', '🌓 Avto'], ['light', '☀️ Yorug\''], ['dark', '🌙 Tungi']];
const getTheme = () => { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } };
function applyTheme(t) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('theme', t); } catch { /* private mode */ }
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches) ? '#0e1120' : '#4f46e5');
}
applyTheme(getTheme());
const TAB_S = [['/', '🏠', 'Bosh'], ['/trajectory', '🗓️', 'Dars'], ['/trainer/speaking', '🎤', 'Trenajyor'], ['/progress', '📈', 'Progress'], ['/profile', '👤', 'Profil']];

const root = document.getElementById('app');
let view = null;

function shell(content) {
  const nav = (state.me.user.role === 'teacher' ? NAV_T : NAV_S);
  const cur = location.hash.slice(1) || '/';
  const side = h('aside', { class: 'sidebar', id: 'side' },
    h('div', { class: 'brand' }, h('span', { class: 'logo' }, 'L'), 'LearnEng'),
    h('nav', { class: 'nav' }, nav.map((n) => n[0] === 'sep' ? h('div', { class: 'sep' }, n[1]) :
      h('a', { href: '#' + n[0], class: (n[0] === '/' || n[0] === '/t' ? (cur === n[0] || (n[0] === '/t' && cur.startsWith('/t/student'))) : cur.startsWith(n[0])) ? 'active' : '', onclick: () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('show'); } }, h('span', { class: 'ni' }, n[1]), n[2]))),
    h('div', { class: 'me' }, h('div', { class: 'who' }, h('span', { class: 'avatar' }, state.me.user.name.trim().slice(0, 1).toUpperCase()), h('div', {}, h('b', {}, state.me.user.name), h('div', { class: 'muted' }, state.me.user.role === 'teacher' ? "O'qituvchi" : "O'quvchi"))),
      !state.me.ai && h('div', { class: 'badge warn', style: { marginTop: '8px' }, title: ".env faylida GEMINI_API_KEY ni kiriting" }, "AI ulanmagan"),
      h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn secondary sm theme-btn', title: 'Mavzu', onclick: (e) => { const t = THEMES[(THEMES.findIndex(([k]) => k === getTheme()) + 1) % THEMES.length]; applyTheme(t[0]); e.target.textContent = t[1]; } }, THEMES.find(([k]) => k === getTheme())[1])),
      h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn secondary sm', onclick: logout }, 'Chiqish'))));
  const isT = state.me.user.role === 'teacher';
  const tabs = (isT ? NAV_T : TAB_S).filter((n) => n[0] !== 'sep');
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Asosiy menyu' }, tabs.map((n) => h('a', { href: '#' + n[0], class: (n[0] === '/' || n[0] === '/t' ? (cur === n[0] || (n[0] === '/t' && cur.startsWith('/t/student'))) : cur.startsWith(n[0] === '/trainer/speaking' ? '/trainer' : n[0])) ? 'active' : '' }, h('span', {}, n[1]), (n[2].split(' ')[0]).slice(0, 10))));
  const scrim = h('div', { class: 'scrim', id: 'scrim', onclick: () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('show'); } });
  return h('div', { class: 'layout' }, side, scrim, tabbar,
    h('div', {}, h('div', { class: 'topbar' }, h('button', { class: 'btn secondary sm', onclick: () => { $('#side').classList.toggle('open'); $('#scrim').classList.toggle('show'); }, 'aria-label': 'Menyu' }, '☰'), h('b', {}, 'LearnEng')),
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
  if (!state.me) { if (role) { go('#/login'); return; } mount(root, h('div', { class: 'auth-page' }, await fn({ args: m.slice(1), me: null }))); return; }
  if (!role) { go(state.me.user.role === 'teacher' ? '#/t' : '#/'); return; }
  if (role !== state.me.user.role) { go(state.me.user.role === 'teacher' ? '#/t' : '#/'); return; }
  if (role === S) { // onboarding guard
    const pending = state.me.state.diagnostic !== 'done' || !state.me.state.hasGoal;
    if (pending) await refreshMe();          // once onboarding is done there is no need to re-fetch the profile on every page change
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

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
