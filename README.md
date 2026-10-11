# LearnEng — shaxsiy ingliz tili platformasi (CEFR / IELTS) · Cloudflare uchun

O'quvchi ro'yxatdan o'tadi → ~1 soatlik diagnostika (grammatika, lug'at, reading, listening, writing, speaking) →
CEFR va IELTS darajasi → maqsad va muddat → **shaxsiy kunlik traektoriya** → har kuni nazariya + 15 xil interaktiv mashq,
**kuniga 52 ta yangi so'z**, AI baholash va o'qituvchi belgilagan uslubdagi fikr-mulohaza.
Virtual speaking trenajyor (10 xil AI ustoz), reading/listening trenajyorlari, o'qituvchi paneli.

## Arxitektura (Cloudflare)

| Qism | Cloudflare xizmati |
|---|---|
| Sayt (HTML/JS/CSS, `public/`) | **Workers Static Assets** |
| API (`server/worker.js`, `/api/*`) | **Worker** |
| Ma'lumotlar bazasi (foydalanuvchilar, reja, natijalar) | **D1** (SQLite) — sxema `migrations/0001_init.sql` |
| O'qituvchi yuklagan fayllar va TTS audio keshi | **D1 + Workers cache** (bepul) yoki ixtiyoriy **R2** |
| `GEMINI_API_KEY`, `TEACHER_SIGNUP_CODE` | **Secrets** |

## Joylashtirish (deploy) — qadamma-qadam

Kerak: bepul Cloudflare akkaunti, Node.js 20+. **R2 shart emas**: u bo'lmasa fayllar D1 da (maks. 8 MB), audio keshi Workers cache da saqlanadi — karta kerak emas.
R2 xohlasangiz: `wrangler.jsonc` dagi izohli `r2_buckets` qatorini oching va bucket yarating (maks. 25 MB fayllar, doimiy audio keshi).

```bash
git clone https://github.com/jbnuuzd/learneng.git && cd learneng
git checkout claude/open-platforms-english-teaching-scmx5f
npm install
npx wrangler login                                  # brauzerda Cloudflare'ga kirasiz

npx wrangler d1 create learneng                     # chiqqan database_id ni nusxalang
#   → wrangler.jsonc ichida "REPLACE_WITH_YOUR_D1_DATABASE_ID" o'rniga qo'ying
# (ixtiyoriy) npx wrangler r2 bucket create learneng-files
npm run migrate:remote                              # jadvallarni D1 da yaratadi

npx wrangler secret put GEMINI_API_KEY              # so'raganda API kalitni kiriting
npx wrangler secret put TEACHER_SIGNUP_CODE         # o'qituvchi ro'yxatdan o'tish uchun maxfiy kod (MAJBURIY)

npm run deploy                                      # → https://learneng.<akkaunt>.workers.dev
```

Deploy'dan keyin tekshirish: `node scripts/smoke.mjs https://learneng.<akkaunt>.workers.dev`
(agar `TEACHER_SIGNUP_CODE` o'rnatgan bo'lsangiz: `TEACHER_SIGNUP_CODE=kodingiz node scripts/smoke.mjs <url>`).

**API kalitni qayerga qo'yish:** deploy qilingan saytda — `wrangler secret put GEMINI_API_KEY` yoki Cloudflare paneli →
Workers & Pages → `learneng` → Settings → Variables and Secrets → *Add* (turi: **Secret**). Kalit kodga yoki gitga yozilmaydi.
Kalitni https://aistudio.google.com/apikey dan oling.
**Bir nechta kalit (eng oson yo'l):** o'qituvchi sifatida kiring → bosh sahifadagi «🔑 Gemini API kalitlari» bo'limida kalitlarni qo'shing/o'chiring (bazada saqlanadi, qayta deploy shart emas; `npm run deploy:ci` yangi jadvalni o'zi yaratadi).
**Yoki Secret orqali:** limit tez tugasa, `GEMINI_API_KEY` Secret'iga kalitlarni vergul bilan yozing (`kalit1,kalit2,kalit3`) yoki alohida Secret'lar `GEMINI_API_KEY_2` … `GEMINI_API_KEY_9` qo'shing. Birining limiti (429) tugasa ilova o'sha zahoti keyingisiga o'tadi va tugagan kalitni 5 daqiqa ishlatmaydi. Kalitlarni turli Google akkauntlar/loyihalarda yarating — bir loyihadagi kalitlar limiti umumiy. Secret qo'shgach qayta deploy shart emas, lekin yangi versiya chiqarish tavsiya etiladi (`npm run deploy`).

Lug'at bazasini to'ldirish: o'qituvchi sifatida kiring → **Materiallar va lug'at** → har bir mavzu yonidagi «+40 so'z» (Gemini yaratadi va D1 da saqlaydi).

### GitHub (Workers Builds) orqali deploy qilsangiz
1. Cloudflare → **Storage & Databases → D1 → learneng** sahifasidan **Database ID** ni nusxalang va GitHub'da `wrangler.jsonc` ichidagi
   `REPLACE_WITH_YOUR_D1_DATABASE_ID` o'rniga qo'ying (xato: `binding DB of type d1 must have a valid database_id` shu sababli chiqadi).
2. Worker → **Settings → Build → Deploy command** ni `npm run deploy:ci` qiling: u har deploy'da jadvallarni D1 da yaratadi/yangilaydi (`migrations/`) va keyin deploy qiladi.
3. Worker → **Settings → Variables and Secrets** da `GEMINI_API_KEY` va `TEACHER_SIGNUP_CODE` ni **Secret** sifatida qo'shing.
(`npm warn allow-scripts` ogohlantirishi xato emas, e'tibor bermang.)

### Domen
Dashboard → Workers & Pages → `learneng` → Settings → Domains & Routes → *Add custom domain* (domeningiz Cloudflare'da bo'lishi kerak).

### GitHub orqali avtomatik deploy (ixtiyoriy)
Workers & Pages → Create → *Import a repository* → `jbnuuzd/learneng` → branch tanlang. Build komandasi shart emas; `wrangler.jsonc` o'qiladi.
D1/R2 va secretlarni yuqoridagidek bir marta o'zingiz yarating.

## Lokal ishlab chiqish

```bash
cp .dev.vars.example .dev.vars        # kalitni shu yerga yozing (gitga tushmaydi)
npm run migrate:local                 # lokal D1 (miniflare)
npm run dev                           # http://localhost:8787 (haqiqiy workerd ish vaqti)
npm test                              # 23 ta test (soxta Gemini + D1/R2 almashtirgichlar)
node scripts/smoke.mjs http://localhost:8787
```

## Rollar va asosiy imkoniyatlar

**O'quvchi:** diagnostika → maqsad/muddat → kunlik traektoriya (kalendar) → grammatika darsi (nazariya slaydlari + 15 xil mashq) →
lug'at kuni (40 ta IELTS mavzu so'zi + 12 ta kundalik) → reading/listening/speaking trenajyorlari (AI yangi material, internetdan qidirish,
BBC transkriptini joylash) → 10 xil ustoz bilan speaking (oxirida xato, yutuq, tavsiya) → progress va «maqsadga erishish mumkinmi» tahlili.

**Yangi:** 🔁 intervalli so'z takrorlash (SRS: 1→3→7→14→30→60 kun, bugungi takrorlash vazifasi avtomatik), 📝 vaqtli **IELTS mock test** (mini ≈ 88 daq., to'liq ≈ 164 daq.; band hisobi, maqsad bilan farq va tavsiyalar), 26 ta grammatika darsi.

**Yangi (2):** 📲 o'rnatiladigan ilova (PWA: telefonda «Bosh ekranga qo'shish», oflayn ochiladi), 💬 o'qituvchidan o'quvchiga xabar (o'quvchi bosh sahifasida ko'radi), 🔑 API kalitlarni o'qituvchi panelidan qo'shish.

**O'qituvchi:** o'quvchilar ro'yxati va ogohlantirishlar, parolni tiklash, CSV eksport, fikr-mulohaza uslubi (pozitiv/neytral/qat'iy — standart yoki aniq kun uchun),
qo'shimcha topshiriq, zaif mavzu bo'yicha takrorlash, rejani qayta tuzish, kitob/PDF/audio yuklash, izohlar, lug'at bazasini to'ldirish.

## Kontent va mualliflik huquqi

Barcha o'quv matnlari **original**. Murphy *English Grammar in Use*, *Test Master*, Cambridge IELTS nashrlari mualliflik huquqi bilan himoyalangan,
shuning uchun ulardan ko'chirilmagan. Litsenziyalangan materiallaringizni o'qituvchi paneli orqali PDF/audio sifatida yuklang.
BBC kontenti ko'chirilmaydi: havola beriladi, transkriptni joylab AI orqali savollar yaratasiz.

## Cheklovlar va halol eslatmalar

- **Bepul rejada «Error 1102 / exceeded CPU» chiqsa**: `PBKDF2_ITERATIONS` o'zgaruvchisini (Variables, Text) `20000` ga tushiring (parol xeshi yengillashadi, xavfsizlik biroz pasayadi), yoki Workers Paid ga o'ting.
- **Workers Free rejasi yetmasligi mumkin.** Free rejada har so'rovga ~10 ms CPU va 50 ta kichik so'rov (D1 so'rovlari ham) limiti bor;
  reja yaratish, parol xeshlash (PBKDF2) va o'qituvchi paneli bundan oshishi mumkin. **Workers Paid (~$5/oy) tavsiya etiladi.**
  Men lokal `workerd` da sinadim, Cloudflare'ning real limitlarida sinab ko'rmadim.
- **Real Cloudflare akkauntiga deploy qilinmagan** (menda akkaunt yo'q). Lokal `wrangler dev` (haqiqiy workerd, lokal D1/R2) da to'liq oqim o'tdi;
  birinchi deploy'dan keyin `scripts/smoke.mjs` ni ishga tushiring.
- **Haqiqiy Gemini bilan sinalmagan** (kalit yo'q). So'rovlar rasmiy hujjatga mos yozilgan va soxta server bilan tekshirilgan. Model nomlari
  `wrangler.jsonc` → `vars` da (`GEMINI_TEXT_MODEL`, `GEMINI_TTS_MODEL`). Google eski modelni o'chirsa (404), ilova mavjud modellar ro'yxatidan eng yangisini o'zi tanlaydi; baribir nomni shu yerda yangilab qo'ying.
- Tezlik cheklovi (`rateLimit`) har Worker nusxasida alohida (xotirada) — qat'iy global limit emas.
- CEFR/IELTS baholari taxminiy; IELTS natijasini kafolatlamaydi. «Erishish ehtimoli» konservativ ichki model (~200 soat/daraja, eslab qolish ~60%).
- Dastlabki kontent: 26 grammatika darsi (A1–C1), 8 mavzu × 40 so'z, 125 kundalik so'z. Oylab har kuni yangi so'zlar uchun Gemini kaliti kerak.
- Maxfiylik: o'quvchi javoblari va audio Gemini'ga yuboriladi; audio saqlanmaydi (faqat natija va matn). O'quvchilarni xabardor qiling.
- Mikrofon faqat HTTPS (yoki localhost) da ishlaydi — `workers.dev` HTTPS beradi.
