// Pre-fills the word bank with Gemini so every day can have 50+ NEW words for months.
// Usage:  npm run generate:vocab            (all IELTS topics, 3 batches of 40 words each + general words per level)
//         npm run generate:vocab -- 5       (5 batches per topic)
import '../server/lib/env.js';
import { aiEnabled } from '../server/lib/gemini.js';
import { topicCatalog, growTopic, growGeneral, topicWordPool, generalWordPool } from '../server/lib/content.js';

if (!aiEnabled()) { console.error(".env faylida GEMINI_API_KEY kiritilmagan."); process.exit(1); }
const batches = Math.max(1, Number(process.argv[2]) || 3);
let failed = 0;
for (const t of topicCatalog) {
  for (let i = 0; i < batches; i++) {
    try { await growTopic(t.id, 40); } catch (e) { failed++; console.error(`  ! ${t.id}: ${e.message}`); break; }
  }
  console.log(`${t.id.padEnd(24)} ${topicWordPool(t.id).length} ta so'z`);
}
for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1']) {
  for (let i = 0; i < batches * 2; i++) {
    try { await growGeneral(lv, 40); } catch (e) { failed++; console.error(`  ! general ${lv}: ${e.message}`); break; }
  }
  console.log(`general ${lv}`.padEnd(24), `${generalWordPool(lv).length} ta so'z`);
}
console.log(failed ? `Tugadi (${failed} ta xato bilan). Qayta ishga tushirsangiz, davom ettiriladi.` : 'Tayyor.');
