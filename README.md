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

## ⚠️ Ma'lumotlar haqida muhim eslatma

Quyidagilar **namuna** sifatida kiritilgan va `tekshirilmagan` deb belgilangan; ularni ishga tushirishdan oldin tasdiqlang:

* jurnallar kvartili, to'lov shartlari, OAK ro'yxati holati (`src/seed.js`) — rasmiy manbalar: scopus.com, scimagojr.com, oak.uz;
* OAK minimal talablari (`requirements` jadvali: PhD uchun 3 ta milliy maqola va h.k.) — rasmiy nizom (oak.uz / lex.uz) bilan solishtirib,
  admin kabinetida tahrirlab «Tasdiqlangan» deb belgilang;
* milliy (OAK) jurnallar ro'yxati to'liq emas — oak.uz dagi ro'yxatni «Fid / import» orqali yuklang.

Dasturlash muhitida internetga chiqish cheklangani sababli oak.uz va Scopus bilan jonli integratsiya sinab ko'rilmagan: u
fid formatlari (SCImago CSV, JSON) orqali qurilgan va testlangan. Scopus rasmiy API'si kalit talab qiladi; SCImago ma'lumotlari
bepul CSV sifatida yuklab olinadi.

Admin panelidagi «Qamrov» jadvalida har bir yo'nalish/toifa uchun nomzod jurnallar soni ko'rsatiladi (qizil = 10 tadan kam) —
shu orqali qaysi bo'limlarni to'ldirish kerakligini ko'rasiz.
