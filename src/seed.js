'use strict';
/*
 * BOSHLANG'ICH (NAMUNA) MA'LUMOTLAR.
 * Diqqat: bu yerdagi jurnal kvartillari, to'lov shartlari, OAK ro'yxati holati va OAK minimal
 * talablari `verified = 0` (tekshirilmagan) deb belgilangan. Ular rasmiy manbalar
 * (scopus.com, scimagojr.com, oak.uz, lex.uz) bilan solishtirilib, admin kabinetida
 * tasdiqlanishi yoki fidlar orqali yangilanishi kerak.
 */

const T = (code, name, field_group, tags, hints = '') => ({ code, name, field_group, tags, hints });

const PED_HINTS = [
  "Tajriba-sinov ishlari o'tkazilgan ta'lim muassasalaridan natijalar to'g'risida ma'lumotnoma (kollej / maktab / OTM)",
  "Tadqiqot natijalarini o'quv jarayoniga joriy etish dalolatnomasi (kamida 2-3 ta muassasadan)",
  "Tajriba-sinov ishlari dasturi, bayonnomalari va statistik (matematik) tahlil natijalari",
  "Ishlab chiqilgan metodika/modul/o'quv-metodik majmuaning tasdiqlangan nusxasi (kengash/metod kengash bayonnomasi)",
  "So'rovnoma va test materiallari, respondentlar soni va ishonchlilik ko'rsatkichlari",
  "Ilmiy rahbar fikri va kafedra (laboratoriya) yig'ilishi xulosasi",
];

const directions = [
  T('13.00.01', "Pedagogika nazariyasi va tarixi. Ta'lim falsafasi", 'Pedagogika', 'education,pedagogy,highered', PED_HINTS.join('|')),
  T('13.00.02', "Ta'lim va tarbiya nazariyasi va metodikasi (fanlar bo'yicha)", 'Pedagogika', 'education,pedagogy,edtech', PED_HINTS.join('|')),
  T('13.00.03', "Maxsus pedagogika (inklyuziv ta'lim)", 'Pedagogika', 'education,pedagogy,inclusive', PED_HINTS.join('|')),
  T('13.00.05', "Kasb-hunar ta'limi nazariyasi va metodikasi", 'Pedagogika', 'education,vocational,pedagogy,edtech', PED_HINTS.concat(["Ish beruvchi korxonalardan (ishlab chiqarish amaliyoti, dual ta'lim) tavsiyanoma va hamkorlik shartnomalari", "Kasbiy kompetensiyalar bo'yicha baholash mezonlari va bitiruvchilar bandligi statistikasi"]).join('|')),
  T('13.00.08', "Uzluksiz ta'lim, raqamli ta'lim va ta'lim texnologiyalari", 'Pedagogika', 'education,edtech,highered', PED_HINTS.join('|')),
  T('05.13.00', "Informatika, hisoblash texnikasi va boshqaruv", 'Texnika / IT', 'cs,engineering', "Dasturiy mahsulotga DGU (Intellektual mulk agentligi) guvohnomasi|Dasturni amaliyotga joriy etish dalolatnomasi|Dastur kodi va sinov natijalari ilovasi"),
  T('05.01.00', "Muhandislik, texnologiya va materialshunoslik", 'Texnika / IT', 'engineering,energy,materials', "Foydali modelga/ixtiroga patent|Sinov laboratoriyasi bayonnomasi|Ishlab chiqarishga joriy etish dalolatnomasi va iqtisodiy samara hisobi"),
  T('08.00.00', "Iqtisodiyot, moliya va menejment", 'Iqtisodiyot', 'economics,management,finance', "Statistika qo'mitasi/vazirlik ma'lumotlari manbalari ma'lumotnomasi|Takliflarni joriy etish dalolatnomasi (korxona, vazirlik, hokimlik)|Ekonometrik model hisob-kitoblari ilovasi"),
  T('14.00.00', "Tibbiyot va sog'liqni saqlash", 'Tibbiyot', 'medicine,publichealth', "Axloq qo'mitasi xulosasi|Klinik bazadan ma'lumotnoma va joriy etish dalolatnomasi|Statistik tahlil bayonnomasi"),
  T('03.00.00', "Biologiya, kimyo, qishloq xo'jaligi va tabiiy fanlar", 'Tabiiy fanlar', 'natural,agri,chemistry,engineering', "Tajriba dalalari/laboratoriya ma'lumotnomalari|Joriy etish dalolatnomasi (fermer xo'jaligi, korxona)|Natijalar statistik tahlili"),
  T('10.00.00', "Filologiya, tilshunoslik va adabiyotshunoslik", 'Gumanitar', 'humanities,linguistics,education', "Korpus/material manbalari ro'yxati|Metodikani o'quv jarayoniga joriy etish dalolatnomasi"),
  T('12.00.00', "Yurisprudensiya", 'Gumanitar', 'law,social', "Takliflarni qonunchilikka/amaliyotga joriy etish to'g'risida ma'lumotnoma|Sud-huquqiy amaliyot tahlili ilovasi"),
];

// [name, publisher, country, since, access, apc, scopus, Q, oak, IF, wos, subjects, accept, weeks, url, desc]
const J = (o) => Object.assign({ kind: 'journal', issn: '', apc_usd: null, impact_factor: null, wos: 0, scopus_status: 'none', quartile: '', oak_status: 'none', acceptance: 3, review_weeks: null, official_url: '', scopus_url: '', oak_url: '', description: '', since_year: null, verified: 0 }, o);
const sc = (name) => `https://www.scimagojr.com/journalsearch.php?q=${encodeURIComponent(name)}`;
const S = (name, publisher, country, since, access, q, subjects, extra = {}) =>
  J({ name, publisher, country, since_year: since, access, scopus_status: 'active', quartile: q, subjects, scopus_url: sc(name), ...extra });

const journals = [
  // ---------- Ta'lim: Scopus (bepul = mualliflardan to'lov talab qilinmaydigan) ----------
  S('Computers & Education', 'Elsevier', 'Birlashgan Qirollik', 1976, 'free', 'Q1', 'education,edtech,highered', { impact_factor: 10.5, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/computers-and-education', description: "Ta'limda axborot texnologiyalari bo'yicha yetakchi jurnal. Qabul darajasi past, lekin nufuzi juda yuqori." }),
  S('Educational Research Review', 'Elsevier', 'Niderlandiya', 2006, 'free', 'Q1', 'education,pedagogy', { impact_factor: 9.6, wos: 1, acceptance: 2, review_weeks: 14, official_url: 'https://www.sciencedirect.com/journal/educational-research-review' }),
  S('Teaching and Teacher Education', 'Elsevier', 'Birlashgan Qirollik', 1985, 'free', 'Q1', 'education,pedagogy,highered', { impact_factor: 4.7, wos: 1, acceptance: 2, review_weeks: 14, official_url: 'https://www.sciencedirect.com/journal/teaching-and-teacher-education' }),
  S('Journal of Vocational Education & Training', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1949, 'free', 'Q1', 'vocational,education', { impact_factor: 2.6, wos: 1, acceptance: 3, review_weeks: 12, official_url: 'https://www.tandfonline.com/journals/rjve20', description: "Kasb-hunar ta'limi bo'yicha eng mos jurnallardan biri." }),
  S('Vocations and Learning', 'Springer', 'Germaniya', 2008, 'free', 'Q1', 'vocational,education', { impact_factor: 3.0, wos: 1, acceptance: 3, review_weeks: 12, official_url: 'https://link.springer.com/journal/12186' }),
  S('Journal of Education and Work', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1987, 'free', 'Q2', 'vocational,education', { impact_factor: 2.0, wos: 1, acceptance: 3, review_weeks: 12, official_url: 'https://www.tandfonline.com/journals/cjew20' }),
  S('International Journal of Training and Development', 'Wiley', 'Birlashgan Qirollik', 1997, 'free', 'Q2', 'vocational,education,management', { impact_factor: 2.4, wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Education + Training', 'Emerald', 'Birlashgan Qirollik', 1959, 'free', 'Q2', 'vocational,education,management', { acceptance: 4, review_weeks: 10 }),
  S('Higher Education Research & Development', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1982, 'free', 'Q1', 'highered,education', { impact_factor: 3.3, wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Educational Technology & Society', 'IFETS', 'Tayvan', 1998, 'free', 'Q1', 'edtech,education', { impact_factor: 3.0, wos: 1, acceptance: 3, review_weeks: 14, description: "Diamond open access: mualliflar ham, o'quvchilar ham to'lamaydi." }),
  S('Australasian Journal of Educational Technology', 'ASCILITE', 'Avstraliya', 1985, 'free', 'Q1', 'edtech,education,highered', { impact_factor: 4.0, wos: 1, acceptance: 3, review_weeks: 14 }),
  S('International Review of Research in Open and Distributed Learning', 'Athabasca University', 'Kanada', 2000, 'free', 'Q1', 'edtech,education,highered', { wos: 1, acceptance: 3, review_weeks: 14, description: "Masofaviy va ochiq ta'lim bo'yicha bepul OA jurnal." }),
  S('Journal of Technical Education and Training', 'UTHM', 'Malayziya', 2009, 'free', 'Q3', 'vocational,education,engineering', { acceptance: 5, review_weeks: 8, description: "Texnik va kasb ta'limiga ixtisoslashgan, qabul ehtimoli nisbatan yuqori." }),
  S('International Journal of Instruction', 'Gate Association for Teaching and Education', "Turkiya", 2008, 'free', 'Q2', 'education,pedagogy', { acceptance: 4, review_weeks: 8 }),
  S('European Journal of Educational Research', 'Eurasian Society of Educational Research', "Turkiya", 2012, 'free', 'Q3', 'education,pedagogy,edtech', { acceptance: 5, review_weeks: 6 }),
  S('Cypriot Journal of Educational Sciences', 'Birlik University', 'Kipr', 2006, 'free', 'Q3', 'education,pedagogy', { acceptance: 5, review_weeks: 6 }),
  S('Turkish Online Journal of Distance Education', 'Anadolu University', "Turkiya", 2000, 'free', 'Q2', 'edtech,education,highered', { acceptance: 4, review_weeks: 8 }),
  // Ta'lim: Scopus pullik
  S('Education Sciences', 'MDPI', 'Shveytsariya', 2011, 'paid', 'Q2', 'education,pedagogy,edtech,vocational', { apc_usd: 1800, wos: 1, impact_factor: 2.5, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/education' }),
  S('Sustainability', 'MDPI', 'Shveytsariya', 2009, 'paid', 'Q1', 'education,economics,engineering,energy,natural,management', { apc_usd: 2400, wos: 1, impact_factor: 3.9, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/sustainability' }),
  S('Cogent Education', 'Taylor & Francis', 'Birlashgan Qirollik', 2014, 'paid', 'Q2', 'education,pedagogy,highered', { apc_usd: 1250, wos: 1, acceptance: 4, review_weeks: 8, official_url: 'https://www.tandfonline.com/journals/oaed20' }),
  S('Empirical Research in Vocational Education and Training', 'SpringerOpen', 'Shveytsariya', 2009, 'paid', 'Q2', 'vocational,education', { apc_usd: 1900, acceptance: 3, review_weeks: 10, official_url: 'https://ervet-journal.springeropen.com' }),
  S('SAGE Open', 'SAGE', 'AQSh', 2011, 'paid', 'Q2', 'education,humanities,social,management', { apc_usd: 1500, wos: 1, acceptance: 4, review_weeks: 8, official_url: 'https://journals.sagepub.com/home/sgo' }),
  S('Heliyon', 'Cell Press (Elsevier)', 'Birlashgan Qirollik', 2015, 'paid', 'Q1', 'education,natural,medicine,engineering,cs,social', { apc_usd: 2500, wos: 1, acceptance: 4, review_weeks: 8, official_url: 'https://www.cell.com/heliyon' }),
  S('Universal Journal of Educational Research', 'Horizon Research Publishing', 'AQSh', 2013, 'paid', 'Q3', 'education,pedagogy', { apc_usd: 500, acceptance: 5, review_weeks: 4 }),
  S('TEM Journal', 'UIKTEN', 'Serbiya', 2012, 'paid', 'Q3', 'edtech,education,cs,management,engineering', { apc_usd: 400, acceptance: 5, review_weeks: 4 }),

  // ---------- Kompyuter fanlari ----------
  S('Expert Systems with Applications', 'Elsevier', 'Birlashgan Qirollik', 1990, 'free', 'Q1', 'cs,engineering,management', { impact_factor: 7.5, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/expert-systems-with-applications' }),
  S('Knowledge-Based Systems', 'Elsevier', 'Niderlandiya', 1987, 'free', 'Q1', 'cs', { impact_factor: 7.2, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/knowledge-based-systems' }),
  S('Information Sciences', 'Elsevier', 'Niderlandiya', 1968, 'free', 'Q1', 'cs', { impact_factor: 8.1, wos: 1, acceptance: 2, review_weeks: 16, official_url: 'https://www.sciencedirect.com/journal/information-sciences' }),
  S('Journal of King Saud University - Computer and Information Sciences', 'Elsevier', 'Saudiya Arabistoni', 1989, 'free', 'Q1', 'cs,edtech', { wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Computer Applications in Engineering Education', 'Wiley', 'AQSh', 1993, 'free', 'Q1', 'cs,edtech,engineering,education', { wos: 1, acceptance: 3, review_weeks: 12 }),
  S('IEEE Access', 'IEEE', 'AQSh', 2013, 'paid', 'Q2', 'cs,engineering,energy', { apc_usd: 1995, wos: 1, impact_factor: 3.9, acceptance: 4, review_weeks: 6, official_url: 'https://ieeeaccess.ieee.org' }),
  S('Applied Sciences', 'MDPI', 'Shveytsariya', 2011, 'paid', 'Q2', 'cs,engineering,materials,natural,energy', { apc_usd: 2400, wos: 1, impact_factor: 2.5, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/applsci' }),
  S('Sensors', 'MDPI', 'Shveytsariya', 2001, 'paid', 'Q2', 'cs,engineering', { apc_usd: 2600, wos: 1, impact_factor: 3.4, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/sensors' }),
  S('Electronics', 'MDPI', 'Shveytsariya', 2012, 'paid', 'Q2', 'cs,engineering', { apc_usd: 2100, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/electronics' }),
  S('Information', 'MDPI', 'Shveytsariya', 2010, 'paid', 'Q2', 'cs,edtech', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/information' }),
  S('PeerJ Computer Science', 'PeerJ', 'AQSh', 2015, 'paid', 'Q1', 'cs', { apc_usd: 1500, wos: 1, acceptance: 3, review_weeks: 8, official_url: 'https://peerj.com/computer-science/' }),
  S('Journal of Big Data', 'SpringerOpen', 'Birlashgan Qirollik', 2014, 'paid', 'Q1', 'cs', { apc_usd: 2600, wos: 1, acceptance: 3, review_weeks: 10 }),

  // ---------- Iqtisodiyot ----------
  S('Economic Modelling', 'Elsevier', 'Niderlandiya', 1983, 'free', 'Q1', 'economics,finance', { impact_factor: 4.7, wos: 1, acceptance: 2, review_weeks: 16 }),
  S('Research in International Business and Finance', 'Elsevier', 'Niderlandiya', 1986, 'free', 'Q1', 'economics,finance,management', { wos: 1, acceptance: 3, review_weeks: 14 }),
  S('Emerging Markets Finance and Trade', 'Routledge (Taylor & Francis)', 'AQSh', 1965, 'free', 'Q2', 'economics,finance', { wos: 1, acceptance: 3, review_weeks: 12 }),
  S('Post-Communist Economies', 'Routledge (Taylor & Francis)', 'Birlashgan Qirollik', 1989, 'free', 'Q2', 'economics,social', { wos: 1, acceptance: 4, review_weeks: 10, description: "Postsovet mamlakatlar iqtisodiyotiga ixtisoslashgan — O'zbekiston mavzulari uchun mos." }),
  S('Economies', 'MDPI', 'Shveytsariya', 2013, 'paid', 'Q2', 'economics,finance,management', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/economies' }),
  S('Journal of Risk and Financial Management', 'MDPI', 'Shveytsariya', 2008, 'paid', 'Q2', 'finance,economics', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/jrfm' }),
  S('Cogent Economics & Finance', 'Taylor & Francis', 'Birlashgan Qirollik', 2013, 'paid', 'Q2', 'economics,finance,management', { apc_usd: 1250, acceptance: 4, review_weeks: 8 }),
  S('Economic Research-Ekonomska Istrazivanja', 'Taylor & Francis (Open)', 'Xorvatiya', 1988, 'paid', 'Q1', 'economics,management', { apc_usd: 1400, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('Problems and Perspectives in Management', 'LLC CPC Business Perspectives', 'Ukraina', 2003, 'paid', 'Q3', 'management,economics', { apc_usd: 700, acceptance: 5, review_weeks: 6 }),
  S('Montenegrin Journal of Economics', 'Ekonomska Misao', 'Chernogoriya', 2005, 'free', 'Q3', 'economics,finance,management', { acceptance: 5, review_weeks: 8 }),

  // ---------- Muhandislik / tabiiy fanlar ----------
  S('Journal of Cleaner Production', 'Elsevier', 'Niderlandiya', 1993, 'free', 'Q1', 'engineering,energy,natural,management', { impact_factor: 9.8, wos: 1, acceptance: 2, review_weeks: 16 }),
  S('Energy', 'Elsevier', 'Birlashgan Qirollik', 1976, 'free', 'Q1', 'energy,engineering', { impact_factor: 9.0, wos: 1, acceptance: 2, review_weeks: 14 }),
  S('Renewable Energy', 'Elsevier', 'Birlashgan Qirollik', 1991, 'free', 'Q1', 'energy,engineering', { impact_factor: 9.0, wos: 1, acceptance: 2, review_weeks: 14 }),
  S('Energies', 'MDPI', 'Shveytsariya', 2008, 'paid', 'Q2', 'energy,engineering', { apc_usd: 2400, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/energies' }),
  S('Materials', 'MDPI', 'Shveytsariya', 2008, 'paid', 'Q2', 'materials,engineering,chemistry', { apc_usd: 2600, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/materials' }),
  S('Scientific Reports', 'Nature Portfolio', 'Birlashgan Qirollik', 2011, 'paid', 'Q1', 'natural,medicine,engineering,chemistry,agri', { apc_usd: 2400, wos: 1, impact_factor: 3.8, acceptance: 3, review_weeks: 12, official_url: 'https://www.nature.com/srep/' }),
  S('PLOS ONE', 'PLOS', 'AQSh', 2006, 'paid', 'Q1', 'natural,medicine,social,agri,chemistry', { apc_usd: 1900, wos: 1, impact_factor: 2.9, acceptance: 4, review_weeks: 10, official_url: 'https://journals.plos.org/plosone/' }),
  S('Agronomy', 'MDPI', 'Shveytsariya', 2011, 'paid', 'Q1', 'agri,natural', { apc_usd: 2200, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/agronomy' }),
  S('Molecules', 'MDPI', 'Shveytsariya', 1996, 'paid', 'Q1', 'chemistry,natural', { apc_usd: 2700, wos: 1, acceptance: 4, review_weeks: 5 }),
  S('Results in Physics', 'Elsevier', 'Niderlandiya', 2011, 'paid', 'Q1', 'natural,materials', { apc_usd: 2000, wos: 1, acceptance: 4, review_weeks: 8 }),

  // ---------- Tibbiyot / gumanitar ----------
  S('BMC Public Health', 'BMC (Springer Nature)', 'Birlashgan Qirollik', 2001, 'paid', 'Q1', 'medicine,publichealth', { apc_usd: 2600, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('International Journal of Environmental Research and Public Health', 'MDPI', 'Shveytsariya', 2004, 'paid', 'Q1', 'medicine,publichealth', { apc_usd: 2500, wos: 1, acceptance: 4, review_weeks: 5 }),
  S('Healthcare', 'MDPI', 'Shveytsariya', 2013, 'paid', 'Q2', 'medicine,publichealth', { apc_usd: 2300, wos: 1, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/healthcare' }),
  S('Journal of Clinical Medicine', 'MDPI', 'Shveytsariya', 2012, 'paid', 'Q1', 'medicine', { apc_usd: 2600, wos: 1, acceptance: 4, review_weeks: 5 }),
  S('Cureus', 'Springer Nature', 'AQSh', 2009, 'paid', 'Q2', 'medicine', { apc_usd: 600, acceptance: 4, review_weeks: 4 }),
  S('BMJ Open', 'BMJ', 'Birlashgan Qirollik', 2011, 'paid', 'Q1', 'medicine,publichealth', { apc_usd: 2500, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('Medicine', 'Wolters Kluwer', 'AQSh', 1922, 'paid', 'Q2', 'medicine', { apc_usd: 1950, acceptance: 4, review_weeks: 6 }),
  S('Frontiers in Medicine', 'Frontiers', 'Shveytsariya', 2014, 'paid', 'Q1', 'medicine', { apc_usd: 3000, wos: 1, acceptance: 3, review_weeks: 10 }),
  S('Languages', 'MDPI', 'Shveytsariya', 2016, 'paid', 'Q1', 'linguistics,humanities,education', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/languages' }),
  S('Laws', 'MDPI', 'Shveytsariya', 2012, 'paid', 'Q2', 'law,social', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/laws' }),
  S('Social Sciences', 'MDPI', 'Shveytsariya', 2012, 'paid', 'Q2', 'social,humanities,law,education', { apc_usd: 1800, acceptance: 4, review_weeks: 5, official_url: 'https://www.mdpi.com/journal/socsci' }),

  // ---------- OAK ro'yxatidagi milliy nashrlar (NAMUNA — oak.uz bilan sinxronlang) ----------
  ...[
    ['Pedagogik mahorat', "Buxoro davlat universiteti", 'free', 'education,pedagogy,vocational'],
    ['Uzluksiz ta’lim', "Respublika ta'lim markazi", 'free', 'education,pedagogy,vocational,highered'],
    ['Xalq ta’limi', "O'zbekiston Respublikasi Xalq ta'limi vazirligi", 'free', 'education,pedagogy'],
    ['Pedagogika', "Nizomiy nomidagi TDPU", 'free', 'education,pedagogy,highered'],
    ['Kasb-hunar ta’limi', "Kasb-hunar ta'limi bo'yicha ilmiy-metodik jurnal", 'free', 'vocational,education'],
    ['Boshlang‘ich ta’lim', "Nizomiy nomidagi TDPU", 'free', 'education,pedagogy'],
    ['Til va adabiyot ta’limi', "Nashriyot-matbaa ijodiy uyi", 'free', 'linguistics,education,humanities'],
    ['Ta’lim fidoyilari', "Ta'lim fidoyilari nashriyoti", 'paid', 'education,pedagogy'],
    ['Zamonaviy ta’lim', "Zamonaviy ta'lim ilmiy-metodik jurnali", 'paid', 'education,edtech,pedagogy'],
    ['Pedagogik ta’lim', "Pedagogik ta'lim ilmiy jurnali", 'free', 'education,pedagogy,highered'],
    ['Maktab va hayot', "Ilmiy-metodik jurnal", 'free', 'education,pedagogy'],
    ['Oliy ta’lim va innovatsiyalar', "Oliy ta'lim ilmiy-uslubiy jurnali", 'free', 'highered,education'],
    ['Raqamli ta’lim texnologiyalari', "Raqamli ta'lim ilmiy jurnali", 'paid', 'edtech,education,cs'],
    ['Iqtisodiyot va ta’lim', "Iqtisodiyot va ta'lim jurnali", 'free', 'economics,education,management'],
    ['Iqtisodiyot va innovatsion texnologiyalar', "Ilmiy elektron jurnal", 'free', 'economics,management,finance'],
    ['Moliya va bank ishi', "Ilmiy-amaliy jurnal", 'free', 'finance,economics'],
    ['Axborot texnologiyalari muammolari', "Ilmiy jurnal", 'free', 'cs,engineering'],
    ['Muhandislik va texnologiyalar axborotnomasi', "Texnika universiteti ilmiy axborotnomasi", 'free', 'engineering,energy,materials,cs'],
    ['Energetika muammolari', "Ilmiy-texnik jurnal", 'free', 'energy,engineering'],
    ['Tibbiyotda yangi kun', "Buxoro davlat tibbiyot instituti", 'paid', 'medicine,publichealth'],
    ['Biologiya va tibbiyot muammolari', "Ilmiy jurnal", 'free', 'medicine,natural'],
    ['Agro ilm', "Qishloq xo'jaligi ilmiy-amaliy jurnali", 'free', 'agri,natural'],
    ['Kimyo va kimyo texnologiyasi', "Ilmiy-texnik jurnal", 'free', 'chemistry,natural,materials'],
    ['Huquq va burch', "Ilmiy-amaliy jurnal", 'free', 'law,social'],
    ['Filologiya masalalari', "Ilmiy jurnal", 'free', 'linguistics,humanities'],
  ].map(([name, publisher, access, subjects]) => J({ name, publisher, country: "O'zbekiston", access, oak_status: 'active', subjects, acceptance: access === 'free' ? 4 : 5, review_weeks: access === 'free' ? 6 : 3, oak_url: 'https://oak.uz', description: "OAK ro'yxatidagi milliy nashr (namuna ma'lumot — oak.uz dagi rasmiy ro'yxat bilan tasdiqlang).", official_url: '' })),

  // ---------- Konferensiyalar ----------
  ...[
    ['EDULEARN (International Conference on Education and New Learning Technologies)', 'IATED', 'Ispaniya', 'education,edtech,pedagogy', 'paid', 'Ta’lim va yangi o‘quv texnologiyalari bo‘yicha yirik yillik konferensiya.', 'https://iated.org/edulearn/'],
    ['INTED (International Technology, Education and Development Conference)', 'IATED', 'Ispaniya', 'education,edtech,vocational', 'paid', '', 'https://iated.org/inted/'],
    ['ICERI (International Conference of Education, Research and Innovation)', 'IATED', 'Ispaniya', 'education,pedagogy,highered', 'paid', '', 'https://iated.org/iceri/'],
    ['ECER (European Conference on Educational Research)', 'EERA', 'Yevropa', 'education,pedagogy,highered', 'paid', 'Yevropa ta’lim tadqiqotlari assotsiatsiyasi konferensiyasi.', 'https://eera-ecer.de'],
    ['AERA Annual Meeting', 'American Educational Research Association', 'AQSh', 'education,pedagogy,highered', 'paid', '', 'https://www.aera.net'],
    ['IEEE EDUCON (Global Engineering Education Conference)', 'IEEE', 'Xalqaro', 'engineering,education,cs,edtech', 'paid', '', 'https://www.ieee-educon.org'],
    ['EDEN Annual Conference', 'European Distance and E-Learning Network', 'Yevropa', 'edtech,education', 'paid', '', 'https://www.eden-online.org'],
    ['Respublika ilmiy-amaliy konferensiyalari (OTM va ilmiy markazlar)', 'Oliy ta’lim muassasalari', "O'zbekiston", 'education,pedagogy,vocational,highered', 'free', "Respublika miqyosidagi konferensiyalar to'plamlari — konferensiya talablari uchun. Joriy kalendarni OTM saytlaridan tekshiring.", ''],
    ['Xalqaro ilmiy-amaliy konferensiyalar (O‘zbekiston OTMlari)', 'Oliy ta’lim muassasalari', "O'zbekiston", 'education,economics,cs,engineering,medicine,humanities', 'free', 'Xalqaro maqomdagi konferensiyalar; chiqish va tezis uchun to‘lov shartlari har bir konferensiyada alohida.', ''],
  ].map(([name, publisher, country, subjects, access, description, official_url]) => J({ name, kind: 'conference', publisher, country, subjects, access, acceptance: 4, description, official_url })),
];

const requirements = [
  { degree: 'phd', kind: 'oak', title: "OAK ro'yxatidagi milliy ilmiy nashrlarda maqolalar", min_count: 3, description: "Dissertatsiya mavzusi bo'yicha OAK tomonidan e'tirof etilgan o'zbek jurnallarida chop etilgan maqolalar. (Foydalanuvchi ko'rsatmasi asosidagi namuna: kamida 3 ta — OAK nizomi bilan tasdiqlang.)" },
  { degree: 'phd', kind: 'foreign', title: "Xorijiy ilmiy nashrlarda (Scopus/WoS yoki xorijiy OAK tan olgan) maqolalar", min_count: 1, description: "Xalqaro e'tirofga ega xorijiy jurnallarda chop etilgan maqolalar. (Namuna — rasmiy talab bilan tasdiqlang.)" },
  { degree: 'phd', kind: 'conf_int', title: "Xalqaro ilmiy konferensiyalarda ma'ruza/tezislar", min_count: 1, description: "Xorijda yoki xalqaro maqomdagi konferensiya materiallarida tezis." },
  { degree: 'phd', kind: 'conf_nat', title: "Respublika ilmiy konferensiyalarida ma'ruza/tezislar", min_count: 1, description: "Respublika miqyosidagi konferensiya to'plamlarida tezis." },
  { degree: 'dsc', kind: 'oak', title: "OAK ro'yxatidagi milliy ilmiy nashrlarda maqolalar", min_count: 10, description: "Namuna qiymat — rasmiy talabga qarab admin tahrirlaydi." },
  { degree: 'dsc', kind: 'foreign', title: "Xorijiy (Scopus/WoS) nashrlarda maqolalar", min_count: 5, description: "Namuna qiymat." },
  { degree: 'dsc', kind: 'monograph', title: "Monografiya", min_count: 1, description: "Namuna qiymat." },
  { degree: 'dsc', kind: 'conf_int', title: "Xalqaro konferensiyalarda ma'ruzalar", min_count: 3, description: "Namuna qiymat." },
];

const docs = [
  // implementation
  ['impl_acts', 'implementation', "Joriy etish dalolatnomalari / ma'lumotnomalar", "Tadqiqot natijalari amaliyotga (kollej, maktab, OTM, korxona) joriy etilganini tasdiqlovchi imzo va muhrli dalolatnomalar. Bir nechta turli muassasadan olish tavsiya etiladi.", 'mid', 1],
  ['experiment_ref', 'experiment', "Tajriba-sinov ishlari o'tkazilgani to'g'risida ma'lumotnoma", "Tajriba-sinov o'tkazilgan muassasalardan sana, ishtirokchilar soni va natijalar ko'rsatilgan ma'lumotnoma.", 'mid', 1],
  ['experiment_stats', 'experiment', "Tajriba-sinov natijalarining statistik tahlili", "Tajriba va nazorat guruhlari natijalari, statistik mezonlar (masalan, Student, Pirson χ²) va xulosalar jadvali.", 'mid', 1],
  ['survey', 'experiment', "So'rovnoma / test materiallari va ishonchlilik tahlili", "So'rovnoma shakllari, respondentlar soni, Kronbax alfa kabi ishonchlilik ko'rsatkichlari.", 'early', 0],
  ['edu_materials', 'implementation', "Ishlab chiqilgan o'quv-metodik materiallar (o'quv qo'llanma, modul, metodik tavsiya)", "Metod kengashi / ilmiy kengash tomonidan tasdiqlangan o'quv-metodik ishlanmalar (bayonnoma nusxasi bilan).", 'mid', 0],
  ['dgu', 'implementation', "Dasturiy mahsulot / intellektual mulk guvohnomasi", "Agar tadqiqot dasturiy mahsulot yoki ishlanma yaratsa — Intellektual mulk agentligi guvohnomasi (tegishli yo'nalishlar uchun).", 'mid', 0],
  // defense
  ['dissertation', 'defense', "Dissertatsiya matni (talab qilingan shaklda)", "Kirish, boblar, xulosa va tavsiyalar, foydalanilgan adabiyotlar, ilovalar. Rasmiylashtirish talablariga mosligini tekshiring.", 'late', 1],
  ['autoref', 'defense', "Dissertatsiya avtoreferati (o'zbek, rus, ingliz tillarida)", "Belgilangan hajm va shaklda, uch tilda xulosalar bilan.", 'late', 1],
  ['pubs_list', 'defense', "Ilmiy ishlar ro'yxati va nashr nusxalari", "Barcha maqolalar, tezislar, qo'llanmalarning ro'yxati va tasdiqlangan nusxalari; OAK/Scopus ro'yxatlariga kirishini tasdiqlovchi havolalar.", 'late', 1],
  ['antiplagiat', 'defense', "Antiplagiat tekshiruvi xulosasi", "Dissertatsiya va avtoreferat uchun rasmiy antiplagiat tekshiruvi xulosasi.", 'late', 1],
  ['supervisor_opinion', 'defense', "Ilmiy rahbar (maslahatchi) xulosasi", "Dissertatsiya bajarilganligi va himoyaga tavsiyasi to'g'risida yozma fikr.", 'late', 1],
  ['dept_conclusion', 'defense', "Kafedra / laboratoriya yig'ilishi xulosasi (dastlabki muhokama)", "Bajarilgan ish dastlabki muhokamadan o'tgani to'g'risida bayonnoma ko'chirmasi.", 'late', 1],
  ['personal_docs', 'admin', "Shaxsiy hujjatlar to'plami", "Ariza, tarjimai hol, diplom nusxalari, mehnat daftarchasi ko'chirmasi, fotosurat, til bilimi sertifikati (agar talab qilinsa).", 'late', 1],
  ['council_app', 'admin', "Ilmiy kengashga ariza va ro'yxatdan o'tish hujjatlari", "Himoya kengashiga topshiriladigan rasmiy ariza va ilova hujjatlar to'plami.", 'late', 1],
  ['topic_approval', 'admin', "Dissertatsiya mavzusi va ilmiy rahbarni tasdiqlash", "Mavzu OTM ilmiy kengashida tasdiqlanishi va (talab etilsa) OAK tizimida ro'yxatdan o'tkazilishi.", 'early', 1],
];

const quotes = [
  ['Isaac Newton', "Agar men boshqalardan uzoqroqni ko‘rgan bo‘lsam, bu devlar yelkasida turganim tufaylidir.", "Robert Gukka maktub, 1675"],
  ['Albert Eynshteyn', "Menda alohida iste’dod yo‘q. Men shunchaki ehtiros bilan qiziquvchanman.", "Karl Zeeligga maktub, 1952"],
  ['Lui Paster', "Kuzatish sohasida tasodif faqat tayyor ongga yordam beradi.", "Lill universitetidagi ma’ruza, 1854"],
  ['Mari Kyuri', "Hayotda qo‘rqinchli narsa yo‘q — faqat anglash kerak bo‘lgan narsalar bor.", "Mashhur ibora (muallifligi an’anaviy tarzda unga nisbat beriladi)"],
  ['Tomas Edison', "Daho — bir foiz ilhom va to‘qson to‘qqiz foiz mehnatdir.", "1932"],
  ['Richard Feynman', "Birinchi tamoyil: o‘zingni aldamaslik kerak — va o‘zingni aldash eng oson ish.", "Caltech bitiruv ma’ruzasi, 1974"],
  ['Mirzo Ulug‘bek', "Dinlar buzilar, shohliklar yo‘qolar, ammo olimlarning ilmi abadiy qolar.", "Ulug‘bekka nisbat beriladigan mashhur ibora"],
  ['Aristotel', "Ta’limning ildizi achchiq, ammo uning mevasi shirindir.", "Aristotelga nisbat beriladigan ibora"],
  ['Konfutsiy', "Yurish qanchalik sekin bo‘lmasin, to‘xtamasang bo‘ldi.", "Konfutsiyga nisbat beriladigan ibora"],
  ['Santyago Ramon-i-Kaxal', "Miyaning qaysi sohasini rivojlantirmoqchi bo‘lsangiz, o‘sha sohada qat’iyat bilan mashq qiling.", "Ramon-i-Kaxal asarlaridagi fikr mazmuni"],
];

function seedAll(db) {
  const n = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  const ins = (table, obj) => {
    const keys = Object.keys(obj);
    db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map((k) => obj[k]));
  };
  db.exec('BEGIN');
  try {
    if (!n('directions')) directions.forEach((d) => ins('directions', d));
    if (!n('journals')) journals.forEach((j) => ins('journals', j));
    if (!n('requirements')) requirements.forEach((r) => ins('requirements', r));
    if (!n('doc_templates')) docs.forEach(([key, category, title, description, phase, required]) => ins('doc_templates', { key, category, title, description, phase, required }));
    if (!n('quotes')) quotes.forEach(([author, text, note]) => ins('quotes', { author, text, note }));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { seedAll, directions, journals };
