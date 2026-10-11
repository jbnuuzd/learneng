import { api } from '../api.js';
import { h, toast, toneBadge, TONE_LABEL } from '../ui.js';
import { state, refreshMe, go } from '../state.js';

export async function profileView() {
  await refreshMe();
  const me = state.me, u = me.user;
  const mats = u.role === 'student' ? await api.get('/api/materials').catch(() => []) : [];
  const code = h('input', { type: 'text', placeholder: "O'qituvchi kodi", maxlength: 12 });
  return h('div', {},
    h('h1', {}, 'Profil'),
    h('div', { class: 'card' }, h('table', { class: 't' }, h('tbody', {}, [['Ism', u.name], ['Email', u.email], ['Rol', u.role === 'teacher' ? "O'qituvchi" : "O'quvchi"]].map(([k, v]) => h('tr', {}, h('td', { class: 'muted' }, k), h('td', {}, h('b', {}, v))))))),
    u.role === 'student' ? h('div', {},
      h('div', { class: 'card' }, h('h2', {}, 'Fikr-mulohaza uslubi'), h('p', {}, "Mashg'ulotlardan keyingi AI fikr-mulohazasi uslubini o'qituvchingiz belgilaydi. Bugun: ", toneBadge(me.today.tone)),
        h('ul', { class: 'muted' }, Object.entries(me.tones).map(([k, v]) => h('li', {}, h('b', {}, v.label), ' — ', v.uz)))),
      h('div', { class: 'card' }, h('h2', {}, "O'qituvchi"), u.teacher ? h('p', {}, h('b', {}, u.teacher.name), ` (${u.teacher.email})`) : h('div', { class: 'row' }, code, h('button', { class: 'btn', onclick: async () => { try { await api.post('/api/me/teacher', { inviteCode: code.value }); toast('Ulandi ✓'); go('#/profile'); } catch (e) { toast(e.message, true); } } }, 'Ulanish'))),
      mats.length ? h('div', { class: 'card' }, h('h2', {}, 'Materiallar'), mats.map((m) => h('div', { class: 'row between q' }, h('div', {}, h('b', {}, m.title), m.description && h('div', { class: 'muted' }, m.description)), h('a', { class: 'btn secondary sm', href: `/api/materials/${m.id}/download` }, '⬇ Yuklab olish')))) : null,
      h('div', { class: 'card' }, h('h2', {}, 'Sozlamalar'), h('div', { class: 'row' }, h('a', { class: 'btn secondary', href: '#/goal' }, 'Maqsadni o\'zgartirish'), h('a', { class: 'btn secondary', href: '#/diagnostic' }, 'Diagnostikani qayta topshirish'))))
      : h('div', { class: 'card' }, h('h2', {}, "O'quvchilarni ulash kodi"), h('div', { class: 'big-level' }, u.inviteCode), h('p', { class: 'muted' }, "O'quvchilar ro'yxatdan o'tishda yoki profil sahifasida shu kodni kiritadi.")));
}
