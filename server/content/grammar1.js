// Original grammar teaching content (A1-A2). Theory is in Uzbek, all examples are in English.
// Item formats are documented in server/lessons.js.
export default [
  {
    id: 'be-there', level: 'A1', title: "To be va There is / There are",
    focus: 'verb to be; there is / there are',
    theory: [
      { t: "To be fe'li", h: `<p><b>To be</b> — ingliz tilidagi eng muhim fe'l. U "bo'lmoq / -man, -san, -dir" ma'nolarini beradi.</p>
<table><tr><th>Olmosh</th><th>Fe'l</th><th>Qisqa</th></tr><tr><td>I</td><td>am</td><td>I'm</td></tr><tr><td>You</td><td>are</td><td>you're</td></tr><tr><td>He / She / It</td><td>is</td><td>he's, she's, it's</td></tr><tr><td>We / You / They</td><td>are</td><td>we're, you're, they're</td></tr></table>
<p><b>Inkor:</b> fe'ldan keyin <i>not</i>: She <b>is not</b> (isn't) tired. <b>Savol:</b> fe'l gap boshiga chiqadi: <b>Are</b> they ready?</p>` },
      { t: "There is / There are", h: `<p>Biror narsaning <i>mavjudligini</i> bildirish uchun ishlatiladi.</p>
<ul><li><b>There is</b> + birlik ot: There is a book on the table.</li><li><b>There are</b> + ko'plik ot: There are two books on the table.</li><li>Inkor: There <b>isn't</b> a park here. / There <b>aren't</b> any shops.</li><li>Savol: <b>Is there</b> a bank near here? — Yes, there is. / No, there isn't.</li></ul>` },
      { t: "Odatiy xatolar", h: `<ul><li>❌ She <s>are</s> my friend → ✅ She <b>is</b> my friend.</li><li>❌ There <s>is</s> five students → ✅ There <b>are</b> five students.</li><li>❌ I <s>is</s> a student → ✅ I <b>am</b> a student.</li></ul><p>Esda tuting: ingliz tilida gapda fe'l bo'lishi shart. "Men talaba" emas — <i>I am a student</i>.</p>` },
    ],
    mcq: [
      { q: 'She ___ a teacher.', o: ['am', 'is', 'are', 'be'], a: 1 },
      { q: 'They ___ at home now.', o: ['is', 'am', 'are', 'be'], a: 2 },
      { q: '___ there a bank near here?', o: ['Are', 'Is', 'Am', 'Do'], a: 1 },
      { q: 'There ___ three books on the table.', o: ['is', 'are', 'am', 'be'], a: 1 },
    ],
    gap: [
      { q: 'I ___ (be) twenty years old.', a: 'am' },
      { q: 'My parents ___ (be) doctors.', a: 'are' },
      { q: '___ (be) your sister at school?', a: 'Is' },
      { q: 'There ___ (be) a cat under the chair.', a: 'is' },
    ],
    error: [
      { q: 'She are my friend.', a: ['She is my friend.', "She's my friend."] },
      { q: 'There is five students in the class.', a: ['There are five students in the class.'] },
      { q: 'I is a student.', a: ['I am a student.', "I'm a student."] },
    ],
    reorder: ['My brother is not at home.', 'Are there any shops near here?'],
    transform: [
      { q: 'He is a doctor. (negative)', a: ['He is not a doctor.', "He isn't a doctor.", "He's not a doctor."] },
      { q: 'They are in the park. (question)', a: ['Are they in the park?'] },
      { q: 'There is a bus stop here. (use: three bus stops)', a: ['There are three bus stops here.'] },
    ],
    match: [['I', 'am'], ['He', 'is'], ['They', 'are'], ['It', 'is'], ['We', 'are']],
    tf: [
      { q: '"There is" is used with plural nouns.', a: false },
      { q: '"Are they late?" is a question.', a: true },
      { q: '"I\'m" means "I am".', a: true },
    ],
    dictation: ['There are two chairs in the room.', 'My sister is a nurse.'],
    make: ['am', 'is', 'are', 'there are'],
    translate: [
      { q: 'Men talabaman.', a: 'I am a student.' },
      { q: 'Stolda uchta kitob bor.', a: 'There are three books on the table.' },
    ],
    write: { prompt: "O'zingiz va oilangiz haqida 5–6 ta gap yozing (My name is…, I am…, There are … people in my family).", min: 30 },
    speak: { prompt: 'Describe your room in 4–5 sentences. Use "There is" and "There are".' },
    passage: {
      title: 'My room',
      text: "My name is Dilnoza. I am a student. My room is small, but it is nice. There is a bed and a desk in my room. There are many books on the desk. There is a window, and it is next to the bed. My brother is not in my room. He is in the kitchen.",
      q: [
        { q: 'Who is Dilnoza?', o: ['A teacher', 'A student', 'A doctor'], a: 1 },
        { q: 'What is on the desk?', o: ['Many books', 'A bed', 'A window'], a: 0 },
        { q: 'Where is her brother?', o: ['In her room', 'In the kitchen', 'At school'], a: 1 },
      ],
    },
  },
  {
    id: 'present-simple', level: 'A1', title: 'Present Simple',
    focus: 'present simple: habits, facts, routines',
    theory: [
      { t: 'Qachon ishlatiladi?', h: `<p>Present Simple quyidagi hollarda ishlatiladi:</p><ul><li><b>Odatlar:</b> I drink tea every morning.</li><li><b>Doimiy faktlar:</b> The sun rises in the east.</li><li><b>Jadval:</b> The train leaves at 8.</li></ul><p>Belgi so'zlar: <i>always, usually, often, sometimes, never, every day, on Mondays</i>.</p>` },
      { t: 'Shakllanishi', h: `<table><tr><th></th><th>I / you / we / they</th><th>he / she / it</th></tr><tr><td>＋</td><td>work</td><td>work<b>s</b></td></tr><tr><td>－</td><td>do not (don't) work</td><td>does not (doesn't) work</td></tr><tr><td>？</td><td>Do you work?</td><td>Does she work?</td></tr></table>
<p><b>-s qo'shish:</b> go → goes, watch → watch<b>es</b>, study → stud<b>ies</b>, play → plays. Yordamchi <i>does</i> kelsa, asosiy fe'lga -s <b>qo'shilmaydi</b>: Does he work? (❌ Does he works?)</p>` },
      { t: 'Ravish o\'rni', h: `<p>Takrorlanish ravishlari (<i>always, usually, never</i>) odatda <b>asosiy fe\'ldan oldin</b>, lekin <b>to be dan keyin</b> keladi:</p><ul><li>She <b>always</b> drinks tea.</li><li>She is <b>always</b> late.</li></ul>` },
    ],
    mcq: [
      { q: 'She ___ coffee every morning.', o: ['drink', 'drinks', 'is drink', 'drinking'], a: 1 },
      { q: '___ your brother play football?', o: ['Do', 'Does', 'Is', 'Are'], a: 1 },
      { q: 'We ___ TV in the morning.', o: ["don't watch", "doesn't watch", "aren't watch", "not watch"], a: 0 },
      { q: 'He ___ late for work.', o: ['never is', 'is never', 'does never', 'never does'], a: 1 },
    ],
    gap: [
      { q: 'My brother ___ (play) football on Sundays.', a: 'plays' },
      { q: 'She ___ (study) English every evening.', a: 'studies' },
      { q: 'They ___ (not / like) cold weather.', a: ["don't like", 'do not like'] },
      { q: '___ you live in Tashkent? (Do/Does)', a: 'Do' },
    ],
    error: [
      { q: 'He don\'t like tea.', a: ["He doesn't like tea.", 'He does not like tea.'] },
      { q: 'Does she works here?', a: ['Does she work here?'] },
      { q: 'I go always to school by bus.', a: ['I always go to school by bus.'] },
    ],
    reorder: ['She always drinks tea in the morning.', 'Does your father work in a bank?'],
    transform: [
      { q: 'I go to school by bus. (negative)', a: ["I don't go to school by bus.", 'I do not go to school by bus.'] },
      { q: 'He plays tennis. (question)', a: ['Does he play tennis?'] },
      { q: 'They watch TV. (change to: she)', a: ['She watches TV.'] },
    ],
    match: [['always', '100%'], ['usually', '80%'], ['sometimes', '40%'], ['rarely', '10%'], ['never', '0%']],
    tf: [
      { q: 'After "does" we use the verb with -s: Does he works?', a: false },
      { q: '"She studies" is correct.', a: true },
      { q: '"Always" comes after "to be": She is always late.', a: true },
    ],
    dictation: ['My father works in a hospital.', 'Do you usually walk to work?'],
    make: ['usually', 'never', 'every day', 'sometimes'],
    translate: [
      { q: 'U har kuni ertalab soat yettida turadi.', a: 'He gets up at seven every morning.' },
      { q: 'Men kofe ichmayman.', a: "I don't drink coffee." },
    ],
    write: { prompt: "Odatiy kuningiz haqida 6–8 ta gap yozing (When do you get up? What do you eat? Where do you go?). Takrorlanish ravishlaridan foydalaning.", min: 50 },
    speak: { prompt: 'Talk about your daily routine. What do you always, usually and never do? (45–60 seconds)' },
    passage: {
      title: "Aziz's day",
      text: "Aziz gets up at six o'clock every day. He usually eats bread and drinks tea for breakfast. He goes to university by bus. He doesn't have lunch at home; he eats in the cafeteria. In the evening he studies English for two hours. He never watches TV before he finishes his homework.",
      q: [
        { q: 'How does Aziz go to university?', o: ['By bus', 'By car', 'On foot'], a: 0 },
        { q: 'Where does he have lunch?', o: ['At home', 'In the cafeteria', 'At work'], a: 1 },
        { q: 'What does he do in the evening?', o: ['Watches TV', 'Studies English', 'Goes to bed'], a: 1 },
      ],
    },
  },
  {
    id: 'present-continuous', level: 'A2', title: 'Present Continuous va Present Simple',
    focus: 'present continuous vs present simple',
    theory: [
      { t: 'Present Continuous', h: `<p>Hozir, gapirilayotgan paytda davom etayotgan harakat: <i>I am reading now.</i> Shakli: <b>am / is / are + fe'l-ing</b>.</p><ul><li>＋ She <b>is cooking</b> dinner.</li><li>－ They <b>aren't working</b>.</li><li>？ <b>Are</b> you <b>listening</b>?</li></ul><p>Imlo: make → mak<b>ing</b>, run → ru<b>nn</b>ing, lie → l<b>y</b>ing.</p>` },
      { t: 'Simple va Continuous farqi', h: `<table><tr><th>Present Simple</th><th>Present Continuous</th></tr><tr><td>Odat, doimiy holat</td><td>Hozir yoki vaqtinchalik</td></tr><tr><td>I <b>work</b> in a bank.</td><td>I <b>am working</b> at home today.</td></tr><tr><td>always, usually, every day</td><td>now, at the moment, today, this week</td></tr></table>` },
      { t: 'Holat fe\'llari', h: `<p>Ba'zi fe'llar odatda Continuous bo'lmaydi: <b>know, like, love, want, need, understand, believe, have (= egalik)</b>.</p><p>❌ I am knowing the answer. ✅ I <b>know</b> the answer.</p><p>Lekin: <i>I'm having lunch</i> (have = yemoq) to'g'ri.</p>` },
    ],
    mcq: [
      { q: 'Be quiet! The baby ___.', o: ['sleeps', 'is sleeping', 'sleeping', 'sleep'], a: 1 },
      { q: 'I ___ the answer. Please wait.', o: ['am knowing', 'know', 'knows', 'is knowing'], a: 1 },
      { q: 'What ___ you ___ at the moment?', o: ['do / do', 'are / doing', 'are / do', 'do / doing'], a: 1 },
      { q: 'My sister usually ___ tea, but today she ___ coffee.', o: ['drinks / is drinking', 'is drinking / drinks', 'drinks / drinks', 'drink / drinking'], a: 0 },
    ],
    gap: [
      { q: 'Look! It ___ (rain).', a: 'is raining' },
      { q: 'They ___ (not / watch) TV now.', a: ["aren't watching", 'are not watching'] },
      { q: 'He usually ___ (walk) to work, but today he is driving.', a: 'walks' },
      { q: 'Why ___ (you / run)?', a: ['are you running'] },
    ],
    error: [
      { q: 'I am wanting a glass of water.', a: ['I want a glass of water.'] },
      { q: 'She is play the piano now.', a: ['She is playing the piano now.'] },
      { q: 'We are sitting always in the front row.', a: ['We always sit in the front row.', 'We are always sitting in the front row.'] },
    ],
    reorder: ['They are not watching TV at the moment.', 'What are you doing right now?'],
    transform: [
      { q: 'He reads a book. (now → Continuous)', a: ['He is reading a book.', "He's reading a book."] },
      { q: 'We are studying. (negative)', a: ["We aren't studying.", 'We are not studying.', "We're not studying."] },
      { q: 'She is cooking. (question)', a: ['Is she cooking?'] },
    ],
    match: [['now / at the moment', 'happening at this moment'], ['every day / usually', 'habit or routine'], ['know, like, want', 'state verbs: no -ing'], ['make → ?', 'making'], ['run → ?', 'running']],
    tf: [
      { q: '"I am knowing him" is correct.', a: false },
      { q: '"She is running" has a double n: runing.', a: false },
      { q: 'We use Present Continuous for things happening now.', a: true },
    ],
    dictation: ['She is talking on the phone at the moment.', 'What are they doing today?'],
    make: ['at the moment', 'today', 'usually', 'right now'],
    translate: [
      { q: 'Hozir men ingliz tilini o\'rganyapman.', a: 'I am learning English now.' },
      { q: 'U odatda choy ichadi, lekin bugun kofe ichyapti.', a: 'He usually drinks tea, but today he is drinking coffee.' },
    ],
    write: { prompt: "Hozir atrofingizda nima bo'layotganini 6 ta gapda tasvirlang. Keyin 2 ta odatingiz haqida yozing (Simple bilan).", min: 50 },
    speak: { prompt: 'Describe what you and the people around you are doing right now. Then say what you usually do at this time. (45 seconds)' },
    passage: {
      title: 'A phone call',
      text: "Hi Sara! I'm at the park with my cousin right now. We're sitting under a big tree. The children are playing football and a man is selling ice cream. Usually I work on Saturdays, but this week I'm taking a holiday. What are you doing? Are you studying again?",
      q: [
        { q: 'Where is the speaker?', o: ['At work', 'At the park', 'At home'], a: 1 },
        { q: 'What are the children doing?', o: ['Playing football', 'Selling ice cream', 'Sitting under a tree'], a: 0 },
        { q: 'Why is the speaker not working today?', o: ['She is ill', 'She is on holiday this week', 'She works on Sundays'], a: 1 },
      ],
    },
  },
  {
    id: 'past-simple', level: 'A2', title: 'Past Simple',
    focus: 'past simple regular and irregular verbs',
    theory: [
      { t: "Qachon ishlatiladi?", h: `<p>O'tgan zamonda tugagan harakat: <i>I visited Samarkand last summer.</i> Belgi so'zlar: <b>yesterday, last week, in 2019, two days ago</b>.</p>` },
      { t: "Shakllanishi", h: `<ul><li><b>To'g'ri fe'llar:</b> + <b>-ed</b> (work → worked, study → stud<b>ied</b>, stop → sto<b>pp</b>ed).</li><li><b>Noto'g'ri fe'llar:</b> go → went, see → saw, have → had, buy → bought, take → took, eat → ate, write → wrote, come → came.</li><li><b>Inkor:</b> <b>didn't</b> + asosiy fe'l: She didn't <b>go</b>.</li><li><b>Savol:</b> <b>Did</b> + ega + asosiy fe'l: Did you <b>see</b> him?</li></ul><p>⚠️ <i>did</i> bor gapda fe'l o'tgan shaklda bo'lmaydi: ❌ Did you went? ✅ Did you <b>go</b>?</p>` },
      { t: "To be o'tgan zamonda", h: `<p>I/he/she/it → <b>was</b>; you/we/they → <b>were</b>. Inkor: wasn't / weren't. Savol: Was she…? Were they…?</p>` },
    ],
    mcq: [
      { q: 'I ___ to the market yesterday.', o: ['go', 'goed', 'went', 'gone'], a: 2 },
      { q: 'She ___ her homework last night.', o: ["didn't do", "doesn't did", "didn't did", "don't do"], a: 0 },
      { q: '___ you see the film?', o: ['Do', 'Did', 'Were', 'Have'], a: 1 },
      { q: 'We ___ very tired after the trip.', o: ['was', 'were', 'did', 'are'], a: 1 },
    ],
    gap: [
      { q: 'He ___ (buy) a new phone two days ago.', a: 'bought' },
      { q: 'They ___ (not / come) to the party.', a: ["didn't come", 'did not come'] },
      { q: 'What time ___ (you / get up) yesterday?', a: ['did you get up'] },
      { q: 'The film ___ (be) really boring.', a: 'was' },
    ],
    error: [
      { q: 'Did you went to school yesterday?', a: ['Did you go to school yesterday?'] },
      { q: 'She buyed a red dress.', a: ['She bought a red dress.'] },
      { q: 'I didn\'t saw him at the party.', a: ["I didn't see him at the party.", 'I did not see him at the party.'] },
    ],
    reorder: ['We visited our grandparents last weekend.', 'Did she write you a letter?'],
    transform: [
      { q: 'I watch TV every evening. (yesterday)', a: ['I watched TV yesterday evening.', 'I watched TV yesterday.'] },
      { q: 'He ate breakfast. (negative)', a: ["He didn't eat breakfast.", 'He did not eat breakfast.'] },
      { q: 'They went to Bukhara. (question)', a: ['Did they go to Bukhara?'] },
    ],
    match: [['go', 'went'], ['see', 'saw'], ['buy', 'bought'], ['eat', 'ate'], ['take', 'took']],
    tf: [
      { q: '"Did she goed?" is correct.', a: false },
      { q: 'The past of "study" is "studied".', a: true },
      { q: '"Yesterday" is a past simple signal word.', a: true },
    ],
    dictation: ['I met my friend in the park yesterday.', 'She did not call me last night.'],
    make: ['yesterday', 'last week', 'ago', 'in 2020'],
    translate: [
      { q: "Biz o'tgan yili Turkiyaga bordik.", a: 'We went to Turkey last year.' },
      { q: 'Kecha men uni ko\'rmadim.', a: "I didn't see him yesterday." },
    ],
    write: { prompt: "O'tgan dam olish kunlaringiz haqida 6–8 ta gap yozing: qayerga bordingiz, nima qildingiz, kimni ko'rdingiz?", min: 60 },
    speak: { prompt: 'Tell me about your last holiday or weekend. Where did you go and what did you do? (60 seconds)' },
    passage: {
      title: 'A trip to Samarkand',
      text: "Last summer, my family and I travelled to Samarkand. We left Tashkent early in the morning and arrived at noon. We visited the Registan and took a lot of photos. In the evening we ate plov in a small restaurant. I didn't buy any souvenirs, but my sister bought a beautiful scarf. We came home two days later.",
      q: [
        { q: 'When did they arrive in Samarkand?', o: ['In the morning', 'At noon', 'In the evening'], a: 1 },
        { q: 'What did they eat in the restaurant?', o: ['Plov', 'Pizza', 'Soup'], a: 0 },
        { q: 'Who bought a scarf?', o: ['The writer', 'The writer\'s sister', 'The writer\'s mother'], a: 1 },
      ],
    },
  },
  {
    id: 'articles-quantifiers', level: 'A2', title: 'Artikllar va miqdor so\'zlari',
    focus: 'articles a/an/the; some/any/much/many/a lot of',
    theory: [
      { t: 'a / an / the', h: `<ul><li><b>a / an</b> — birinchi marta tilga olinayotgan, sanaladigan birlik ot: I have <b>a</b> car. (<b>an</b> — unli tovush oldidan: an apple, an hour)</li><li><b>the</b> — aniq, ma'lum narsa: I have a car. <b>The</b> car is red. Yagona narsalar: <b>the</b> sun, <b>the</b> Internet.</li><li><b>Artiklsiz:</b> umumiy ko'plik va sanalmaydigan otlar: I like music. Dogs are loyal.</li></ul>` },
      { t: 'Sanaladigan / sanalmaydigan otlar', h: `<table><tr><th></th><th>Sanaladigan (book, apple)</th><th>Sanalmaydigan (water, money, advice)</th></tr><tr><td>＋</td><td>some books</td><td>some water</td></tr><tr><td>－ / ？</td><td>any books</td><td>any water</td></tr><tr><td>Ko'p</td><td><b>many</b> / a lot of books</td><td><b>much</b> / a lot of water</td></tr><tr><td>Oz</td><td><b>a few</b> / few</td><td><b>a little</b> / little</td></tr></table><p><i>How many</i> books? — <i>How much</i> money?</p>` },
      { t: 'Eslatma', h: `<p><b>Sanalmaydigan</b> otlar -s olmaydi va "a" bilan kelmaydi: ❌ an advice, ❌ informations. ✅ <b>some advice</b>, <b>some information</b>.</p>` },
    ],
    mcq: [
      { q: 'I need ___ umbrella.', o: ['a', 'an', 'the', '–'], a: 1 },
      { q: 'We don\'t have ___ milk.', o: ['some', 'any', 'many', 'a few'], a: 1 },
      { q: 'How ___ money do you have?', o: ['many', 'much', 'few', 'a few'], a: 1 },
      { q: 'There are only ___ chairs in the room.', o: ['a little', 'much', 'a few', 'a'], a: 2 },
    ],
    gap: [
      { q: 'She is ___ engineer. (a/an)', a: 'an' },
      { q: 'Can I have ___ water, please? (some/any)', a: 'some' },
      { q: 'How ___ students are there in your class? (much/many)', a: 'many' },
      { q: 'I saw a dog. ___ dog was very big. (a/the)', a: 'The' },
    ],
    error: [
      { q: 'She gave me an advice.', a: ['She gave me some advice.', 'She gave me a piece of advice.', 'She gave me advice.'] },
      { q: 'I have many homework today.', a: ['I have a lot of homework today.', 'I have much homework today.'] },
      { q: 'Sun is a star.', a: ['The sun is a star.'] },
    ],
    reorder: ['There is not much milk in the fridge.', 'How many people are there here?'],
    transform: [
      { q: 'I have some friends here. (negative)', a: ["I don't have any friends here.", 'I do not have any friends here.'] },
      { q: 'We need some bread. (question with any)', a: ['Do we need any bread?'] },
      { q: 'There is a little sugar. (use: a few + biscuits)', a: ['There are a few biscuits.'] },
    ],
    match: [['a book', 'a/an'], ['water', 'uncountable'], ['the moon', 'unique'], ['many', 'countable'], ['much', 'uncountable']],
    tf: [
      { q: '"Informations" is a correct plural.', a: false },
      { q: 'We say "an hour" because "h" is silent.', a: true },
      { q: 'We use "much" with countable nouns.', a: false },
    ],
    dictation: ['I would like a cup of tea and some bread.', 'There are a few apples on the table.'],
    make: ['some', 'any', 'a lot of', 'a few'],
    translate: [
      { q: "Muzlatgichda ozgina sut bor.", a: 'There is a little milk in the fridge.' },
      { q: 'Sizda nechta qalam bor?', a: 'How many pens do you have?' },
    ],
    write: { prompt: "Muzlatgichingizda nima borligini 6 ta gapda yozing (some / any / a lot of / a few / a little ishlating).", min: 40 },
    speak: { prompt: 'Describe what is in your bag or your kitchen. Use some, any, a few, a little, a lot of. (45 seconds)' },
    passage: {
      title: 'Shopping list',
      text: "I'm going to the supermarket. We haven't got any rice, and there isn't much oil left. I need a few tomatoes and an onion for dinner. Can you buy some bread, too? We have a lot of fruit at home, so don't buy any apples.",
      q: [
        { q: 'What does the speaker NOT need?', o: ['Rice', 'Apples', 'Bread'], a: 1 },
        { q: 'How much oil is left?', o: ['A lot', 'Not much', 'None'], a: 1 },
        { q: 'What is the food for?', o: ['Breakfast', 'Dinner', 'A party'], a: 1 },
      ],
    },
  },
  {
    id: 'comparatives', level: 'A2', title: 'Comparative va Superlative',
    focus: 'comparative and superlative adjectives',
    theory: [
      { t: 'Taqqoslash darajasi', h: `<ul><li><b>Qisqa sifatlar:</b> + <b>-er</b> / <b>the -est</b>: tall → taller → the tallest; big → bigger → the biggest; happy → happier → the happiest.</li><li><b>Uzun sifatlar (2+ bo'g'in):</b> <b>more / the most</b>: expensive → more expensive → the most expensive.</li><li><b>Istisnolar:</b> good → better → the best; bad → worse → the worst; far → further → the furthest.</li></ul>` },
      { t: 'than, as … as', h: `<ul><li>Tashkent is <b>bigger than</b> Samarkand.</li><li>This bag is <b>as</b> expensive <b>as</b> that one. (= bir xil)</li><li>This bag is <b>not as</b> expensive <b>as</b> that one. (= arzonroq)</li><li>Superlative oldidan <b>the</b>: She is <b>the</b> youngest in the class.</li></ul>` },
      { t: 'Odatiy xatolar', h: `<p>❌ more taller, ❌ more better, ❌ the most biggest. ✅ <b>taller</b>, <b>better</b>, <b>the biggest</b>. Taqqoslashda <i>than</i> ishlatiladi, <i>that</i> emas.</p>` },
    ],
    mcq: [
      { q: 'My brother is ___ than me.', o: ['tall', 'taller', 'more tall', 'tallest'], a: 1 },
      { q: 'This is ___ film I have ever seen.', o: ['the better', 'the best', 'the most good', 'best'], a: 1 },
      { q: 'English is ___ than Chemistry for me.', o: ['more easy', 'easier', 'the easiest', 'easy'], a: 1 },
      { q: 'She is not ___ tall ___ her sister.', o: ['so / than', 'as / as', 'more / as', 'as / than'], a: 1 },
    ],
    gap: [
      { q: 'Today is ___ (hot) than yesterday.', a: 'hotter' },
      { q: 'This is the ___ (interesting) book in the library.', a: 'most interesting' },
      { q: 'My results are ___ (bad) than last year.', a: 'worse' },
      { q: 'He runs ___ (fast) of all the boys.', a: ['the fastest', 'fastest'] },
    ],
    error: [
      { q: 'This exam was more difficult that the last one.', a: ['This exam was more difficult than the last one.'] },
      { q: 'She is more taller than me.', a: ['She is taller than me.'] },
      { q: 'It is the most big city in the country.', a: ['It is the biggest city in the country.'] },
    ],
    reorder: ['Her new phone is more expensive than mine.', 'He is the best student in our group.'],
    transform: [
      { q: 'Tom is 1.80 m. Ali is 1.75 m. (Tom ... than Ali)', a: ['Tom is taller than Ali.'] },
      { q: 'This car is cheaper than that car. (use: expensive)', a: ['That car is more expensive than this car.', 'That car is more expensive than this one.'] },
      { q: 'No other student in the class is taller than Ali. (use: the tallest)', a: ['Ali is the tallest student in the class.', 'Ali is the tallest in the class.'] },
    ],
    match: [['good', 'better'], ['bad', 'worse'], ['far', 'further'], ['big', 'bigger'], ['happy', 'happier']],
    tf: [
      { q: '"more better" is correct.', a: false },
      { q: 'We use "the" before superlatives.', a: true },
      { q: 'The comparative of "good" is "gooder".', a: false },
    ],
    dictation: ['Summer is hotter than spring.', 'This is the most beautiful place in the city.'],
    make: ['than', 'the best', 'as ... as', 'more expensive'],
    translate: [
      { q: 'Mening uyim sizning uyingizdan kattaroq.', a: 'My house is bigger than your house.' },
      { q: 'Bu shaharning eng go\'zal joyi.', a: 'This is the most beautiful place in the city.' },
    ],
    write: { prompt: "Ikki shahar yoki ikki mashinani taqqoslang (6 ta gap). Comparative, superlative va as … as dan foydalaning.", min: 50 },
    speak: { prompt: 'Compare two places you know (cities, shops, schools). Use comparatives and one superlative. (60 seconds)' },
    passage: {
      title: 'Two phones',
      text: "I'm choosing a new phone. The Alpha is cheaper than the Beta, but the Beta has a better camera. The Beta is also lighter, and its battery is bigger. The Gamma is the most expensive phone in the shop, but it isn't as fast as the Beta. I think the Beta is the best choice for me.",
      q: [
        { q: 'Which is cheaper, the Alpha or the Beta?', o: ['The Alpha', 'The Beta', 'Both cost the same'], a: 0 },
        { q: 'Which phone is the most expensive?', o: ['Alpha', 'Beta', 'Gamma'], a: 2 },
        { q: 'Which does the speaker prefer?', o: ['Alpha', 'Beta', 'Gamma'], a: 1 },
      ],
    },
  },
];
