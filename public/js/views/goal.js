import { api } from '../api.js';
import { h, toast, fmtDate, fmtMin, levelCard, mount, loading } from '../ui.js';
import { state, go, refreshMe } from '../state.js';

const CEFR = ['B1', 'B2', 'C1', 'C2'];
const IELTS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const CEFR_IELTS = { A2: 3.5, B1: 4.5, B2: 6, C1: 7.5, C2: 8.5 };
const PERIODS = [['1 oy', { months: 1 }], ['3 oy', { months: 3 }], ['6 oy', { months: 6 }], ['1 yil', { months: 12 }], ['2 yil', { months: 24 }]];

export async function goalView() {
  const me = state.me;
  const lvl = me.state.level?.overall;
  const existing = await api.get('/api/plan').catch(() => null);
  let target = { targetCefr: existing?.goal?.target_cefr || 'C1' };
  let period = { months: 3 };
  let customDate = '';
  const out = h('div', {});
  const cefrBtns = h('div', { class: 'pill-btns' }), ieltsBtns = h('div', { class: 'pill-btns' }), periodBtns = h('div', { class: 'pill-btns' });
  const dateIn = h('input', { type: 'date', 'aria-label': 'Imtihon sanasi', onchange: () => { customDate = dateIn.value; if (customDate) { period = { deadline: customDate }; drawPeriod(); preview(); } } });

  function drawTarget() {
    cefrBtns.replaceChildren(...CEFR.map((c) => h('button', { type: 'button', class: 'pill' + (target.targetCefr === c ? ' on' : ''), onclick: () => { target = { targetCefr: c }; drawTarget(); preview(); } }, c)));
    ieltsBtns.replaceChildren(...IELTS.map((b) => h('button', { type: 'button', class: 'pill' + (target.targetIelts === b ? ' on' : ''), onclick: () => { target = { targetIelts: b }; drawTarget(); preview(); } }, b.toFixed(1))));
  }
  function drawPeriod() {
    periodBtns.replaceChildren(...PERIODS.map(([t, p]) => h('button', { type: 'button', class: 'pill' + (period.months === p.months ? ' on' : ''), onclick: () => { period = p; dateIn.value = ''; drawPeriod(); preview(); } }, t)));
  }
  let seq = 0;
  async function preview() {
    const my = ++seq;
    mount(out, loading('Hisoblanmoqda…'));
    try {
      const p = await api.post('/api/goal/preview', { ...target, ...period });
      if (my !== seq) return;
      mount(out, previewCard(p));
    } catch (e) { if (my === seq) mount(out, h('div', { class: 'alert bad' }, e.message)); }
  }

  function previewCard(p) {
    let hours = p.recommendedHoursPerDay;
    const hoursIn = h('input', { type: 'number', min: 1.5, max: 10, step: 0.5, value: hours, 'aria-label': 'Kuniga soat' });
    const verdict = h('div', {});
    const upd = () => {
      hours = Math.max(1.5, Math.min(10, Number(hoursIn.value) || p.recommendedHoursPerDay));
      const ratio = hours / p.recommendedHoursPerDay;
      mount(verdict, 
        ratio >= 0.98 ? h('div', { class: 'alert ok' }, `✅ ${hours} soat/kun maqsadga yetish uchun yetarli (tavsiya: ${p.recommendedHoursPerDay} soat).`)
        : ratio >= 0.7 ? h('div', { class: 'alert warn' }, `⚠️ ${hours} soat/kun tavsiyadan (${p.recommendedHoursPerDay}) kam. Maqsadga erishish qiyinlashadi — muddatni uzaytirish yoki soatni oshirish tavsiya etiladi.`)
        : h('div', { class: 'alert bad' }, `❌ ${hours} soat/kun maqsad uchun juda kam (tavsiya: ${p.recommendedHoursPerDay}). Reja tuziladi, lekin AI tahlili erishish ehtimoli past ekanini ko'rsatadi.`),
        hours < 2.5 && h('div', { class: 'alert warn' }, `Kuniga ${p.newWordsPerDay} ta yangi so'z (≈ ${p.vocabMinutes} daqiqa) majburiy bo'lgani uchun 2,5 soatdan kam vaqtda boshqa mashg'ulotlar juda qisqa bo'ladi.`));
    };
    hoursIn.oninput = upd; upd();
    return h('div', { class: 'card' }, h('h2', {}, 'Tahlil va tavsiya'),
      h('div', { class: 'grid g4' },
        h('div', { class: 'card flat stat' }, h('b', {}, p.days), h('span', {}, 'kun qoldi')),
        h('div', { class: 'card flat stat' }, h('b', {}, `${p.gapLevels}`), h('span', {}, 'daraja farqi')),
        h('div', { class: 'card flat stat' }, h('b', {}, `~${p.requiredHours}`), h('span', {}, 'soat kerak')),
        h('div', { class: 'card flat stat' }, h('b', {}, p.recommendedHoursPerDay), h('span', {}, 'soat/kun tavsiya'))),
      p.unrealistic && h('div', { class: 'alert bad' }, "⚠️ Bu muddat va maqsad uchun tavsiya etilgan yuklama juda yuqori. Real natija uchun muddatni uzaytiring yoki oraliq maqsad (masalan, bir pog'ona past) tanlang."),
      p.stretch && h('div', { class: 'alert warn' }, "Maqsad qiyin, lekin kuchli intizom bilan mumkin."),
      h('div', { class: 'alert' }, `📚 Har kuni kamida ${p.newWordsPerDay} ta yangi so'z: 40 tasi bitta IELTS mavzusidan (masalan, Education yoki Environment), qolgani kundalik so'zlar. Har bir so'z test, yozma esga tushirish va gap tuzish bilan mustahkamlanadi.`),
      h('div', { class: 'field', style: { maxWidth: '260px', marginTop: '12px' } }, h('label', {}, 'Kuniga necha soat shug\'ullana olasiz?'), hoursIn), verdict,
      h('p', { class: 'muted' }, `Muddat: ${fmtDate(p.start)} → ${fmtDate(p.deadline)}`),
      h('button', { class: 'btn lg', onclick: async (e) => {
        e.target.disabled = true; e.target.replaceChildren(h('span', { class: 'spinner' }), ' Traektoriya tuzilmoqda…');
        try { await api.post('/api/goal', { ...target, ...period, hoursPerDay: hours }); await refreshMe(); toast('Shaxsiy traektoriyangiz tayyor! 🎯'); go('#/trajectory'); }
        catch (err) { toast(err.message, true); e.target.disabled = false; e.target.textContent = 'Traektoriyani yaratish'; }
      } }, 'Traektoriyani yaratish'));
  }

  drawTarget(); drawPeriod();
  const view = h('div', {},
    h('div', { class: 'card' }, h('h1', {}, 'Maqsadingizni belgilang'),
      h('div', { class: 'grid g3' }, levelCard('Hozirgi darajangiz', lvl)), 
      h('div', { class: 'field', style: { marginTop: '14px' } }, h('label', {}, 'Maqsad: CEFR darajasi'), cefrBtns),
      h('div', { class: 'field' }, h('label', {}, 'yoki IELTS bali'), ieltsBtns, h('small', { class: 'muted' }, 'Bittasini tanlasangiz, ikkinchisi avtomatik moslashtiriladi. Agar ikkalasi ham tanlansa, qat\'iyrog\'i hisobga olinadi.')),
      h('div', { class: 'field' }, h('label', {}, 'Imtihongacha qancha vaqt bor?'), periodBtns, h('div', { style: { maxWidth: '220px', marginTop: '8px' } }, h('label', { style: { fontWeight: 400 } }, 'yoki aniq sana'), dateIn))),
    out);
  preview();
  return view;
}
