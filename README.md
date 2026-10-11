# 🎓 Ilmiy yuksalish

Tadqiqotchilar (doktorant, mustaqil izlanuvchi, yangi boshlovchi) uchun tavsiyaviy platforma:
Scopus / OAK / yuqori impakt faktorli jurnallar va konferensiyalar, OAK minimal talablari,
oyma-oy shaxsiy trayektoriya, himoya hujjatlari ro'yxati va sun'iy intellekt ko'magi.

## Ishga tushirish

Faqat Node.js ≥ 22.5 kerak (tashqi paketlar yo'q; SQLite — `node:sqlite`).

```bash
export ADMIN_LOGIN=siz_tanlagan_login
export ADMIN_PASSWORD='kuchli-parol'      # faqat sizda bo'ladi
export ANTHROPIC_API_KEY=sk-ant-...       # ixtiyoriy: AI tahlillari uchun
npm start                                 # http://localhost:3000
npm test
```

`ADMIN_PASSWORD` berilmasa, birinchi ishga tushirishda tasodifiy parol yaratilib **bir marta** konsolga chiqariladi.
Admin hisobini ro'yxatdan o'tish orqali yaratib bo'lmaydi — u faqat shu muhit o'zgaruvchilaridan olinadi.

| O'zgaruvchi | Vazifasi |
|---|---|
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | Admin kabineti hisobi |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | AI: jurnal moslik tahlili, motivatsiya xabari, reja maslahati, OAK ro'yxatini matndan ajratish |
| `SCOPUS_FEED_URL` | SCImago/Scopus kvartillari CSV yoki JSON manzili |
| `OAK_FEED_URL` | OAK ro'yxati (JSON/CSV) manzili |
| `DATA_DIR`, `PORT`, `COOKIE_SECURE=1` | Ma'lumotlar papkasi, port, HTTPS ortida `Secure` cookie |

## Imkoniyatlar

**Tadqiqotchi kabineti:** profil (maqom, daraja, yo'nalish, mavzu, muddat) → bosh sahifada iqtibos + AI motivatsiya xabari
va bajarilish foizi; **Trayektoriya** (OAK talablari asosida oyma-oy reja: yengil topshiriqlar — tezis/milliy maqola —
oldinga, uzoq ko'rib chiqiladigan Scopus maqolalari o'rtaga, qo'llanma/monografiya, hujjatlar va himoya — oxirga);
**Hujjatlar** (joriy etish dalolatnomalari, tajriba-sinov ma'lumotnomalari, antiplagiat va h.k., yo'nalishga xos maslahatlar);
**Scopus / OAK / Impakt faktor / Konferensiyalar** — har biri Bepul va Pullik, har bir yo'nalish uchun 10 tagacha tavsiya:
kvartil, boshlangan yil, rasmiy sayt, indekslanganlik isboti havolasi, AI moslik tahlili.

**Refresh:** kvartili pasaygan, Scopus yoki OAK ro'yxatidan chiqqan jurnal **o'chirilmaydi** — qizil bilan belgilanadi,
o'rniga yangi jurnal tavsiya etiladi (faol tavsiyalar yana 10 ta). Kvartili ko'tarilganlar yashil belgilanadi.

**Admin kabineti:** statistika va yo'nalishlar bo'yicha qamrov jadvali, foydalanuvchilar, jurnallar / yo'nalishlar /
OAK talablari / hujjat shablonlari / iqtiboslar CRUD, fid import (SCImago CSV, OAK ro'yxati, AI yordamida matndan
ajratish), jurnallardagi o'zgarishlar tarixi.

## OAK ma'lumotnomasi (rasmiy manba asosida)

`src/data/oak_reference.md` — oak.uz va lex.uz dan yig'ilgan ma'lumotnoma (2026-yil 11-oktabr holati). Undan olingan:

* **PhD / DSc minimal talablari** (`requirements` jadvali, `verified=1`): PhD — jami 7 ta ish: 3 ta maqola (1 tasi xorijiy) + 2 ta xalqaro konferensiya materiali + 2 ta qo'shimcha; DSc — jami 15 ta, 10 ta maqola (1 xorijiy), 2 ta konferensiya.
* **PF-98 (26.05.2026)**: 2027-yil 1-yanvardan bekor bo'ladigan tartiblar (`doc_templates.cancelled_from`). Trayektoriya muddati 2027-yilgacha tugasa — eski tartib, keyin tugasa — bekor qilinadigan vazifalar «ixtiyoriy / 2027 dan bekor» deb belgilanadi.
* **10.06.2026 qoidasi**: A/B/C bazalar, tan olinmaydigan indekslar, DOI/ResearchGate yetarli emasligi — «OAK ma'lumotnomasi» sahifasida.
* **08.00.00 Iqtisodiyot** bo'yicha OAK ro'yxatidagi 180 ta jurnal (milliy, MDH, xorijiy) — OAK bo'limiga yuklangan; 08.00.01–08.00.19 (jumladan **08.00.17 Turizm va mehmonxona faoliyati**) va 11.00.xx ixtisosliklari.

## ⚠️ Ma'lumotlar haqida eslatma

* `tekshirilmagan` deb belgilangan yozuvlar (asosan Scopus kvartillari, to'lov shartlari, pedagogika va boshqa sohalardagi milliy jurnallar) namuna: scopus.com, scimagojr.com va oak.uz (https://oak.uz/pages/31738) bilan solishtirib tasdiqlang yoki «Fid / import» orqali yangilang.
* OAK ro'yxatidagi jurnallar uchun to'lov shartlari (bepul/pullik) ma'lumotnomada yo'q — hammasi «bepul» deb qo'yilgan; jurnal saytida tekshiring.
* Pedagogika (13.00.00, 135 ta jurnal), tibbiyot, texnika va boshqa sohalarning OAK ro'yxati hali yuklanmagan — oak.uz reyestridan CSV/JSON qilib import qiling.
* Admin panelidagi «Qamrov» jadvali har bir yo'nalish/toifada nechta nomzod borligini ko'rsatadi (qizil = 10 tadan kam).
* oak.uz va Scopus bilan jonli integratsiya sinab ko'rilmagan (sandbox'dan oak.uz ochilmadi); u fid formatlari orqali qurilgan va testlangan.
