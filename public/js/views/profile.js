import { api } from '../api.js';
import { h, mount, toast, toneBadge, TONE_LABEL } from '../ui.js';
import { state, refreshMe, go } from '../state.js';

export async function profileView() {
  await refreshMe();
  const me = state.me, u = me.user;
  const mats = u.role === 'student' ? await api.get('/api/materials').catch(() => []) : [];
  const code = h('input', { type: 'text', placeholder: "O'qituvchi kodi", maxlength: 12 });
  const cur = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Joriy parol' });
  const nxt = h('input', { type: 'password', autocomplete: 'new-password', minlength: 8, 'aria-label': 'Yangi parol' });
  const pwCard = h('div', { class: 'card' }, h('h2', {}, 'Parolni almashtirish'),
    h('div', { class: 'grid g2' }, h('div', { class: 'field' }, h('label', {}, 'Joriy parol'), cur), h('div', { class: 'field' }, h('label', {}, 'Yangi parol (kamida 8 belgi)'), nxt)),
    h('button', { class: 'btn', onclick: async () => { try { await api.post('/api/me/password', { current: cur.value, next: nxt.value }); cur.value = ''; nxt.value = ''; toast('Parol almashtirildi ✓'); } catch (e) { toast(e.message, true); } } }, 'Almashtirish'));
  const keyBox = h('div', { class: 'card' });
  const drawKeys = (d) => {
    const inp = h('input', { type: 'password', placeholder: 'AIza… yoki AQ.… (Google AI Studio kaliti)', autocomplete: 'off', 'aria-label': 'Shaxsiy Gemini API kalit' });
    const lab = h('input', { type: 'text', placeholder: 'Nom (ixtiyoriy)', maxlength: 40, 'aria-label': 'Kalit nomi' });
    const add = h('button', { class: 'btn', onclick: async () => {
      if (!inp.value.trim()) return;
      add.disabled = true;
      try { drawKeys(await api.post('/api/me/keys', { key: inp.value, label: lab.value })); toast('Kalit qo\'shildi ✓'); await refreshMe(); }
      catch (e) { toast(e.message, true); add.disabled = false; }
    } }, "Qo'shish");
    mount(keyBox, h('h2', {}, '🔑 Shaxsiy Gemini API kalitim'),
      d.keys.length ? h('div', { class: 'alert ok' }, "Faol: AI so'rovlaringiz (Lingo, speaking, baholash, talaffuz) endi faqat o'zingizning kalitingiz limitidan ishlaydi. Umumiy kalit sarflanmaydi.")
        : h('p', {}, "Umumiy AI limiti tez tugab qolsa, o'zingizning bepul kalitingizni qo'shing — AI so'rovlaringiz shu kalit limiti doirasida ishlaydi. ", h('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener noreferrer' }, 'Kalit olish (aistudio.google.com/apikey)')),
      d.keys.length ? h('table', { class: 't' }, h('tbody', {}, d.keys.map((k) => h('tr', {}, h('td', {}, k.key), h('td', { class: 'muted' }, k.label || ''), h('td', {}, k.cooling ? `⏳ limit tugagan (~${Math.ceil(k.cooling / 60)} daq.)` : '✅'),
        h('td', {}, h('button', { class: 'btn danger sm', onclick: async () => { if (!confirm("Kalit o'chirilsinmi? AI umumiy kalitga qaytadi.")) return; try { drawKeys(await api.del('/api/me/keys/' + k.id)); await refreshMe(); } catch (e) { toast(e.message, true); } } }, "O'chirish")))))) : null,
      d.keys.length < d.max ? h('div', { class: 'row' }, inp, lab, add) : h('p', { class: 'muted' }, `Eng ko'pi bilan ${d.max} ta kalit.`),
      h('p', { class: 'muted' }, "Kalit bazada saqlanadi va faqat sizning AI so'rovlaringiz uchun ishlatiladi; o'qituvchi uni ko'ra olmaydi. Kalit limiti tugasa, AI to'xtaydi (umumiy kalitga o'tmaydi) — yangi kalit qo'shing yoki o'chiring. Kalitni hech kimga bermang."));
  };
  if (u.role === 'student') api.get('/api/me/keys').then(drawKeys).catch(() => {});
  return h('div', {},
    h('h1', {}, 'Profil'),
    h('div', { class: 'card' }, h('table', { class: 't' }, h('tbody', {}, [['Ism', u.name], ['Email', u.email], ['Rol', u.role === 'teacher' ? "O'qituvchi" : "O'quvchi"]].map(([k, v]) => h('tr', {}, h('td', { class: 'muted' }, k), h('td', {}, h('b', {}, v))))))),
    pwCard,
    u.role === 'student' ? h('div', {},
      h('div', { class: 'card' }, h('h2', {}, 'Fikr-mulohaza uslubi'), h('p', {}, "Mashg'ulotlardan keyingi AI fikr-mulohazasi uslubini o'qituvchingiz belgilaydi. Bugun: ", toneBadge(me.today.tone)),
        h('ul', { class: 'muted' }, Object.entries(me.tones).map(([k, v]) => h('li', {}, h('b', {}, v.label), ' — ', v.uz)))),
      h('div', { class: 'card' }, h('h2', {}, "O'qituvchi"), u.teacher ? h('p', {}, h('b', {}, u.teacher.name), ` (${u.teacher.email})`) : h('div', { class: 'row' }, code, h('button', { class: 'btn', onclick: async () => { try { await api.post('/api/me/teacher', { inviteCode: code.value }); toast('Ulandi ✓'); go('#/profile'); } catch (e) { toast(e.message, true); } } }, 'Ulanish'))),
      keyBox,
      mats.length ? h('div', { class: 'card' }, h('h2', {}, 'Materiallar'), mats.map((m) => h('div', { class: 'row between q' }, h('div', {}, h('b', {}, m.title), m.description && h('div', { class: 'muted' }, m.description)), h('a', { class: 'btn secondary sm', href: `/api/materials/${m.id}/download` }, '⬇ Yuklab olish')))) : null,
      h('div', { class: 'card' }, h('h2', {}, 'Sozlamalar'), h('div', { class: 'row' }, h('a', { class: 'btn secondary', href: '#/goal' }, 'Maqsadni o\'zgartirish'), h('a', { class: 'btn secondary', href: '#/diagnostic' }, 'Diagnostikani qayta topshirish'))))
      : h('div', { class: 'card' }, h('h2', {}, "O'quvchilarni ulash kodi"), h('div', { class: 'big-level' }, u.inviteCode), h('p', { class: 'muted' }, "O'quvchilar ro'yxatdan o'tishda yoki profil sahifasida shu kodni kiritadi.")));
}
