import { api } from '../api.js';
import { h, toast } from '../ui.js';
import { state, go } from '../state.js';
import { createMascot } from '../mascot.js';

function brand() {
  return h('div', { class: 'brand auth-brand' }, h('span', { class: 'logo' }, 'L'), 'LearnEng');
}

// Landing layout: Lingo + selling points on a gradient panel, the form beside it.
function landing(form, title, sub) {
  const m = createMascot({ size: 210 }); setTimeout(() => m.wave(), 500); m.el.style.cursor = 'pointer'; m.el.onclick = () => { m.wave(); m.cheer(); };
  return h('div', { class: 'landing' },
    h('aside', { class: 'landing-hero' }, h('div', { class: 'hero-brand' }, h('span', { class: 'logo' }, 'L'), 'LearnEng'), m.el,
      h('h1', {}, title), h('p', {}, sub),
      h('ul', { class: 'perks' }, ['🎯 Shaxsiy traektoriya: CEFR va IELTS maqsadingizga qadar', '🤖 AI baholash va jonli speaking suhbatdoshlar', '📚 Har kuni 50+ yangi so\'z, 15 xil mashq', '🦉 Lingo — o\'zbekcha gapiradigan ingliz tili do\'stingiz'].map((t) => h('li', {}, t)))),
    h('section', { class: 'landing-form' }, form));
}

export async function loginView() {
  const email = h('input', { type: 'email', id: 'em', autocomplete: 'username', required: true });
  const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
  const form = h('form', { class: 'card stack', onsubmit: async (e) => {
    e.preventDefault();
    try { state.me = await api.post('/api/auth/login', { email: email.value, password: pw.value }); go(state.me.user.role === 'teacher' ? '#/t' : '#/'); }
    catch (err) { toast(err.message, true); }
  } },
  h('h2', {}, 'Tizimga kirish'),
  h('div', { class: 'field' }, h('label', { for: 'em' }, 'Email'), email),
  h('div', { class: 'field' }, h('label', { for: 'pw' }, 'Parol'), pw),
  h('button', { class: 'btn lg', type: 'submit' }, 'Kirish'),
  h('p', { class: 'muted' }, "Hisobingiz yo'qmi? ", h('a', { href: '#/register' }, "Ro'yxatdan o'tish")));
  return landing(form, "Ingliz tilini o'zbekcha qulaylik bilan o'rganing", 'Diagnostika → shaxsiy reja → har kuni natija. Boshlash uchun tizimga kiring.');
}

export async function registerView() {
  let role = 'student';
  const name = h('input', { type: 'text', id: 'nm', autocomplete: 'name', required: true });
  const email = h('input', { type: 'email', id: 'em2', autocomplete: 'username', required: true });
  const pw = h('input', { type: 'password', id: 'pw2', autocomplete: 'new-password', minlength: 8, required: true });
  const invite = h('input', { type: 'text', id: 'inv', placeholder: 'Masalan: 3F9A12BC', maxlength: 12 });
  const tcode = h('input', { type: 'text', id: 'tc', placeholder: 'Agar berilgan bo\'lsa' });
  const inviteField = h('div', { class: 'field' }, h('label', { for: 'inv' }, "O'qituvchi kodi (ixtiyoriy)"), invite, h('small', {}, "O'qituvchingiz bergan kod. Keyinroq profil sahifasida ham kiritish mumkin."));
  const tField = h('div', { class: 'field', style: { display: 'none' } }, h('label', { for: 'tc' }, "O'qituvchi ro'yxatdan o'tish kodi"), tcode);
  const btns = h('div', { class: 'pill-btns' });
  const setRole = (r) => {
    role = r; inviteField.style.display = r === 'student' ? '' : 'none'; tField.style.display = r === 'teacher' ? '' : 'none';
    [...btns.children].forEach((b) => b.classList.toggle('on', b.dataset.r === r));
  };
  for (const [r, t] of [['student', "Men o'quvchiman"], ['teacher', "Men o'qituvchiman"]]) btns.append(h('button', { type: 'button', class: 'pill', 'data-r': r, onclick: () => setRole(r) }, t));
  setRole('student');
  const form = h('form', { class: 'card stack', onsubmit: async (e) => {
    e.preventDefault();
    try {
      state.me = await api.post('/api/auth/register', { name: name.value, email: email.value, password: pw.value, role, inviteCode: invite.value, teacherSignupCode: tcode.value });
      go(role === 'teacher' ? '#/t' : '#/diagnostic');
    } catch (err) { toast(err.message, true); }
  } },
  h('h2', {}, "Ro'yxatdan o'tish"), btns,
  h('div', { class: 'field' }, h('label', { for: 'nm' }, 'Ism-familiya'), name),
  h('div', { class: 'field' }, h('label', { for: 'em2' }, 'Email'), email),
  h('div', { class: 'field' }, h('label', { for: 'pw2' }, 'Parol (kamida 8 belgi)'), pw),
  inviteField, tField,
  h('button', { class: 'btn lg', type: 'submit' }, "Ro'yxatdan o'tish"),
  h('p', { class: 'muted' }, 'Hisobingiz bormi? ', h('a', { href: '#/login' }, 'Kirish')));
  return landing(form, "LearnEng'ga xush kelibsiz!", "Bir daqiqada hisob oching — keyin ~1 soatlik diagnostika sizning darajangizni aniqlaydi.");
}
