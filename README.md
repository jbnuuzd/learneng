# LearnEng — shaxsiy ingliz tili platformasi (CEFR / IELTS)

O'quvchi ro'yxatdan o'tadi → ~1 soatlik diagnostika (grammatika, lug'at, reading, listening, writing, speaking) →
CEFR va IELTS darajasi → maqsad (masalan C1 / IELTS 7.5) va muddat → **shaxsiy kunlik traektoriya** →
har kuni nazariya + 15 xil interaktiv mashq, **kuniga 52 ta yangi so'z**, AI baholash va o'qituvchi belgilagan uslubdagi fikr-mulohaza.

## Tez boshlash

Kerak: **Node.js 22.13 yoki yangi** (tashqi paketlar kerak emas).

```bash
cp .env.example .env        # keyin .env ni oching va GEMINI_API_KEY ni kiriting
npm start                   # http://localhost:3000
npm test                    # 23 ta test (soxta Gemini serveri bilan ham)
```

API kalitisiz ham ishlaydi (tayyor kontent, oflayn tekshiruv, brauzer ovozi), lekin **AI baholash, speaking, TTS va cheksiz yangi kontent uchun kalit kerak**.

## Gemini API kalitini ulash (Google AI Studio)

1. https://aistudio.google.com/apikey ga kiring (Google akkaunt bilan).
2. **Create API key** tugmasini bosing va kalitni nusxalang.
3. Loyiha papkasida `.env` faylini oching (`.env.example` dan nusxa) va yozing:
   ```
   GEMINI_API_KEY=AIza...sizning_kalitingiz
   ```
4. Serverni qayta ishga tushiring (`npm start`). Chap menyuda «AI ulanmagan» belgisi yo'qoladi.
5. (Ixtiyoriy) Lug'at bazasini oldindan to'ldiring: `npm run generate:vocab` — har bir IELTS mavzusi uchun yuzlab yangi so'z yaratiladi va keshlanadi.

**Xavfsizlik:** kalit faqat serverdagi `.env` da turadi, brauzerga hech qachon yuborilmaydi. `.env` `.gitignore` da — uni GitHub'ga yuklamang.
Modellar `.env` orqali almashtiriladi: `GEMINI_TEXT_MODEL` (standart `gemini-2.5-flash`), `GEMINI_TTS_MODEL` (standart `gemini-2.5-flash-preview-tts`). Google model nomlarini yangilasa, faqat shu qiymatlarni o'zgartiring.

Gemini quyidagilar uchun ishlatiladi: yozma va og'zaki javoblarni IELTS mezonlari bo'yicha baholash (audio to'g'ridan-to'g'ri yuboriladi), tonli fikr-mulohaza, yangi reading/listening/lug'at/mavzu generatsiyasi,
internetdan (Google Search grounding) matn topish, virtual speaking suhbatdoshlar, maqsadga erishish tahlili va **TTS** (ovozli o'qish, 2 spikerli dialoglar).

## Rollar va asosiy imkoniyatlar

**O'quvchi**
- *Traektoriya* — bugungi sana (masalan, 11 oktyabr 2026) uchun mashg'ulotlar, har birining taxminiy vaqti; kalendar bo'yicha oldingi/keyingi kunlar.
- Grammatika darsi: nazariya slaydlari → test, bo'sh joy, xato topish, so'z tartibi, gap qayta yozish, moslashtirish, True/False, reading, listening, diktant, gap tuzish, tarjima, speaking, writing (15 xil).
- Lug'at kuni: **40 ta bitta IELTS mavzusi so'zi + 12 ta kundalik so'z** (jami 52), so'ng test, esga tushirish, diktant, gap tuzish.
- Reading / Listening / Speaking **trenajyorlari**: daraja, mavzu, manba tanlash; AI yangi matn/audio yaratadi, internetdan topadi yoki o'zingiz matn/transkript (masalan BBC 6 Minute English) joylaysiz.
- Speaking trenajyor: **10 xil ustoz** (muloyim, jahldor, IELTS examiner, do'st, professor, HR, hazilkash, sayohat agenti, jurnalist, munozarachi), 8 rejim, daraja «Avto» (erishgan darajangiz) yoki qo'lda; oxirida xatolar, yutuqlar, tavsiyalar.
- *Progress va tahlil* — ko'nikmalar bo'yicha dinamika va **«maqsadga haqiqatan erishish mumkinmi?»** tahlili.

**O'qituvchi**
- O'quvchilar ro'yxati, ogohlantirishlar (grafikdan orqada, faol emas, zaif mavzu), batafsil progress.
- Fikr-mulohaza uslubi: **pozitiv / neytral / qat'iy** — standart yoki aniq bir kun uchun.
- Qo'shimcha topshiriq berish (grammatika, lug'at, reading, listening, speaking, writing yoki o'z topshirig'i), o'chirish.
- Traektoriyani o'zgartirish: soat, maqsad, muddat; zaif mavzu bo'yicha intervalli takrorlash; «hammasini qo'llash».
- Kitob, PDF, audio va boshqa materiallarni yuklash (barcha yoki bitta o'quvchiga), izohlar.

## Modul tuzilmasi

```
server/
  index.js            HTTP server, xavfsizlik sarlavhalari, CSRF himoyasi
  planner.js          traektoriya generatori (soat, muddat, zaif mavzular, 52 so'z/kun)
  analysis.js         maqsadga erishish modeli (soat, lug'at, grammatika qamrovi) + AI xulosa
  lessons.js          vazifani o'ynaladigan darsga aylantirish, javoblar serverda qoladi
  lib/                db (node:sqlite), auth, gemini (matn, audio, TTS), ai (baholash/generatsiya), grading, scale (CEFR↔IELTS)
  routes/             auth, diagnostic, plan, tasks, trainers, speaking, teacher, materials
  content/            grammatika (18 mavzu), lug'at, diagnostika, pool, ustozlar
public/               frontend (vanilla ES modules, build kerak emas)
test/                 API testlari + soxta Gemini serveri bilan AI testlari
```

## Kontent va mualliflik huquqi — muhim

Platformadagi **barcha o'quv matnlari original** (shu loyiha uchun yozilgan). Murphy *English Grammar in Use*, *Test Master*, Cambridge IELTS kabi nashrlar mualliflik huquqi bilan himoyalangan, shuning uchun ularning test va matnlari ko'chirilmagan.
Grammatika qoidalari o'zi umumiy bilim, ularning tushuntirishi original yozilgan; testlar ham original va CEFR tavsiflariga tayangan.
Agar sizda litsenziyalangan yoki ochiq litsenziyali (CC) materiallar bo'lsa: o'qituvchi sifatida PDF/audio sifatida yuklang yoki `server/content/` dagi formatda qo'shing.
BBC kontenti ko'chirilmaydi: tashqi havola beriladi, transkriptni o'zingiz joylab, AI orqali savollar yaratasiz.

## Cheklovlar (halol eslatmalar)

- Dastlabki kontent: 18 grammatika darsi (A1–C1), 8 mavzu × 40 so'z, 125 kundalik so'z. **Har kuni 52 ta YANGI so'z** ketma-ket oylab berilishi uchun Gemini kaliti kerak (yangi so'zlar yaratiladi va keshlanadi). Kalitsiz yangi so'zlar tugagach, takrorlash so'zlari qo'shiladi va tahlil buni ko'rsatadi.
- CEFR/IELTS baholari — **taxminiy** model. Haqiqiy IELTS natijasini kafolatlamaydi. Writing/speaking aniqligi AI ga bog'liq.
- Maqsadga erishish ehtimoli konservativ ichki model (daraja uchun ~200 soat, eslab qolish ~60%), AI xulosa shu ko'rsatkichlarga tayanadi.
- Gemini bilan haqiqiy integratsiya mening muhitimda API kalitsiz sinab bo'lmadi: so'rov shakllari rasmiy hujjat bo'yicha yozilgan va soxta server bilan tekshirilgan. Birinchi ishga tushirishda diagnostika va bitta dars bilan tekshirib ko'ring.
- Tarmoqqa chiqish (Gemini, Google Search) serverdan amalga oshadi; server joylashgan muhit `generativelanguage.googleapis.com` ga ruxsat berishi kerak.
- Mikrofon HTTPS yoki `localhost` da ishlaydi (brauzer talabi).
- Ma'lumotlar `data/` papkasida (SQLite + audio kesh + yuklangan fayllar) — zaxira nusxa oling.
- Maxfiylik: o'quvchi javoblari va audio Gemini'ga yuboriladi; audio saqlanmaydi, matn va natijalar bazada qoladi. O'quvchilarni xabardor qiling.

## Joylashtirish (deploy)

`npm start` istalgan Node 22.13+ serverida ishlaydi. Productionda HTTPS (reverse proxy), `TEACHER_SIGNUP_CODE` (o'qituvchi sifatida ro'yxatdan o'tishni cheklash) va `data/` zaxirasini sozlang.
