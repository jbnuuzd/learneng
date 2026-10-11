'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/db');
const { seedAll } = require('../src/seed');
const auth = require('../src/auth');
const { createApp } = require('../server');
const feeds = require('../src/feeds');

function client(base) {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + '/api' + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
}

test('to‘liq oqim: ro‘yxatdan o‘tish, tavsiya, refresh, admin', async (t) => {
  delete process.env.ANTHROPIC_API_KEY;
  const db = open(':memory:'); seedAll(db);
  auth.ensureAdmin(db, { ADMIN_LOGIN: 'boss', ADMIN_PASSWORD: 'S3cret-pass' }, () => {});
  const server = createApp(db).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const u = client(base), a = client(base);

  assert.equal((await u('GET', '/dashboard')).status, 401);
  assert.equal((await u('POST', '/register', { login: 'dilshod', password: 'password1', full_name: 'Dilshod Rafiddinovich' })).status, 200);
  assert.equal((await u('GET', '/admin/stats')).status, 403);
  assert.equal((await u('POST', '/login', { login: 'boss', password: 'wrong' })).status, 401);

  const prof = await u('PUT', '/profile', { status: 'doctoral', degree: 'phd', direction_code: '13.00.05', topic: 'Kasb-hunar kollejlarida raqamli kompetensiyalarni rivojlantirish', months: 6, start_month: '2027-01' });
  assert.equal(prof.status, 200);

  for (const cat of ['scopus', 'oak', 'impact', 'conference']) for (const acc of ['free', 'paid']) {
    const r = await u('GET', `/journals?category=${cat}&access=${acc}`);
    assert.equal(r.status, 200);
    console.log(cat, acc, r.data.items.length);
  }
  const free = (await u('GET', '/journals?category=scopus&access=free')).data.items;
  assert.equal(free.length, 10, 'Scopus bepul: 10 ta tavsiya');
  assert.ok(free.every((j) => j.scopus_status === 'active' && j.access === 'free'));
  assert.ok(free[0].fit_text.length > 10);

  // Administrator kvartilni pasaytiradi va bitta jurnalni Scopus'dan chiqaradi
  assert.equal((await a('POST', '/login', { login: 'boss', password: 'S3cret-pass' })).status, 200);
  const q = free.find((j) => j.quartile === 'Q1'), gone = free.find((j) => j.id !== q.id);
  assert.equal((await a('PUT', `/admin/e/journals/${q.id}`, { quartile: 'Q3' })).status, 200);
  assert.equal((await a('PUT', `/admin/e/journals/${gone.id}`, { scopus_status: 'discontinued' })).status, 200);

  const ref = await u('POST', '/journals/refresh', { category: 'scopus', access: 'free' });
  assert.equal(ref.status, 200);
  assert.equal(ref.data.flagged, 2);
  assert.equal(ref.data.added, 2);
  const after = (await u('GET', '/journals?category=scopus&access=free')).data.items;
  assert.equal(after.length, 12, 'Eski jurnallar yo‘qolmaydi + 2 ta yangi');
  assert.equal(after.filter((j) => j.flag).length, 2);
  assert.equal(after.filter((j) => !j.flag).length, 10, 'Faol tavsiyalar yana 10 ta');
  assert.ok(after.find((j) => j.id === q.id && j.flag === 'downgraded'));
  assert.ok(after.find((j) => j.id === gone.id && j.flag === 'delisted'));
  assert.equal(after.filter((j) => j.note === 'new').length, 2);
  // ikkinchi refresh yangi o'zgarishsiz — takror qo'shmaydi
  const ref2 = await u('POST', '/journals/refresh', { category: 'scopus', access: 'free' });
  assert.equal(ref2.data.added, 0);
  assert.equal((await u('GET', '/journals?category=scopus&access=free')).data.items.length, 12);

  // Trayektoriya va dashboard
  const plan = (await u('GET', '/plan')).data;
  assert.equal(plan.months.length, 6);
  const first = plan.months[0].tasks[0];
  const t1 = await u('POST', '/plan/task', { key: first.key, done: true });
  assert.ok(t1.data.progress.pct > 0);
  const dash = (await u('GET', '/dashboard')).data;
  assert.match(dash.motivation, /^Hurmatli Dilshod Rafiddinovich/);
  assert.ok(dash.quote.text);
  assert.ok(dash.alerts.some((x) => x.level === 'red'));
  const docs = (await u('GET', '/documents')).data;
  assert.ok(docs.docs.length > 5 && docs.hints.length > 3);

  // Fid import: OAK ro'yxatidan chiqarish
  const oakName = db.prepare("SELECT name FROM journals WHERE oak_status='active' LIMIT 1").get().name;
  const st = feeds.applyFeed(db, feeds.parseFeed(JSON.stringify([{ name: 'Yangi OAK jurnal', oak_status: 'active' }])), 'oak', { mode: 'full', addNew: true });
  assert.ok(st.delisted > 0 && st.added === 1);
  assert.equal(db.prepare('SELECT oak_status s FROM journals WHERE name=?').get(oakName).s, 'removed');
});

test('SCImago CSV parsing', () => {
  const csv = 'Rank;Sourceid;Title;Type;Issn;SJR;SJR Best Quartile\n1;1;"Computers & Education";journal;"03601315";3,2;Q1\n';
  const [it] = feeds.parseFeed(csv);
  assert.equal(it.name, 'Computers & Education'); assert.equal(it.quartile, 'Q1'); assert.equal(it.issn, '03601315');
});
