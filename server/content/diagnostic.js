// Entry diagnostic (~60 minutes): original items written for this platform, modelled on the CEFR descriptors.
// d = CEFR level of the item; topic = grammar unit id (used to find weak areas).
export const grammar = [
  { d: 'A1', topic: 'be-there', q: 'My name ___ Anna.', o: ['am', 'is', 'are', 'be'], a: 1 },
  { d: 'A1', topic: 'present-simple', q: 'He ___ to school every day.', o: ['go', 'goes', 'going', 'is go'], a: 1 },
  { d: 'A1', topic: 'be-there', q: 'There ___ two cats in the garden.', o: ['is', 'are', 'am', 'be'], a: 1 },
  { d: 'A1', topic: 'present-simple', q: '___ you like coffee?', o: ['Do', 'Does', 'Are', 'Is'], a: 0 },
  { d: 'A1', topic: 'articles-quantifiers', q: 'I have ___ apple in my bag.', o: ['a', 'an', 'the', 'some'], a: 1 },
  { d: 'A2', topic: 'present-continuous', q: 'Look! The children ___ in the park.', o: ['play', 'plays', 'are playing', 'played'], a: 2 },
  { d: 'A2', topic: 'past-simple', q: 'We ___ to Spain last year.', o: ['go', 'went', 'have gone', 'going'], a: 1 },
  { d: 'A2', topic: 'comparatives', q: 'This book is ___ than that one.', o: ['interesting', 'more interesting', 'most interesting', 'the more interesting'], a: 1 },
  { d: 'A2', topic: 'articles-quantifiers', q: 'How ___ water do you drink a day?', o: ['many', 'much', 'few', 'a few'], a: 1 },
  { d: 'A2', topic: 'future-forms', q: 'I ___ my friends tomorrow; we have already arranged it.', o: ['am meeting', 'meet', 'met', 'have met'], a: 0 },
  { d: 'A2', topic: 'past-simple', q: 'She didn\'t ___ the answer.', o: ['knew', 'know', 'knows', 'known'], a: 1 },
  { d: 'B1', topic: 'present-perfect', q: 'I ___ here since 2019.', o: ['live', 'lived', 'have lived', 'am living'], a: 2 },
  { d: 'B1', topic: 'modals', q: 'You ___ smoke in the hospital. It is forbidden.', o: ["don't have to", "mustn't", "needn't", "shouldn't to"], a: 1 },
  { d: 'B1', topic: 'conditionals', q: 'If it rains tomorrow, we ___ at home.', o: ['stay', 'would stay', 'will stay', 'stayed'], a: 2 },
  { d: 'B1', topic: 'passive', q: 'The bridge ___ in 1950.', o: ['built', 'was built', 'is built', 'has built'], a: 1 },
  { d: 'B1', topic: 'relative-clauses', q: 'The man ___ lives next door is a doctor.', o: ['which', 'who', 'whose', 'where'], a: 1 },
  { d: 'B1', topic: 'conditionals', q: 'If I ___ you, I would accept the offer.', o: ['am', 'was being', 'were', 'will be'], a: 2 },
  { d: 'B1', topic: 'present-perfect', q: 'She has worked here ___ five years.', o: ['since', 'for', 'ago', 'during'], a: 1 },
  { d: 'B2', topic: 'reported-speech', q: 'She said she ___ the report the day before.', o: ['finished', 'has finished', 'had finished', 'would finish'], a: 2 },
  { d: 'B2', topic: 'gerund-infinitive', q: 'I regret ___ him the secret. It was a mistake.', o: ['to tell', 'telling', 'tell', 'told'], a: 1 },
  { d: 'B2', topic: 'third-conditional-wish', q: 'If I had known the truth, I ___ you.', o: ['would tell', 'told', 'would have told', 'had told'], a: 2 },
  { d: 'B2', topic: 'third-conditional-wish', q: 'I wish I ___ more time to prepare yesterday.', o: ['have', 'had', 'had had', 'would have'], a: 2 },
  { d: 'B2', topic: 'narrative-tenses', q: 'When I arrived, she ___ for an hour.', o: ['waited', 'was waiting', 'had been waiting', 'has waited'], a: 2 },
  { d: 'B2', topic: 'modals-deduction', q: 'His car is outside, so he ___ be at home.', o: ['must', 'can\'t', 'needn\'t', 'ought'], a: 0 },
  { d: 'B2', topic: 'passive', q: 'It is announced that the new law ___ next year.', o: ['introduces', 'will introduce', 'will be introduced', 'is introducing'], a: 2 },
  { d: 'C1', topic: 'inversion-emphasis', q: 'Not until yesterday ___ the truth.', o: ['I learned', 'did I learn', 'I did learn', 'have I learned'], a: 1 },
  { d: 'C1', topic: 'inversion-emphasis', q: '___ I known, I would have helped you.', o: ['If', 'Had', 'Did', 'Would'], a: 1 },
  { d: 'C1', topic: 'reported-speech', q: 'The doctor suggested that he ___ more rest.', o: ['takes', 'took', 'take', 'would to take'], a: 2 },
  { d: 'C1', topic: 'comparatives', q: 'The more you practise, ___ you become.', o: ['the better', 'better', 'the best', 'more better'], a: 0 },
  { d: 'C1', topic: 'inversion-emphasis', q: 'Hardly ___ the room when the lights went out.', o: ['she had entered', 'had she entered', 'she entered', 'did she enter'], a: 1 },
  { d: 'C2', topic: 'third-conditional-wish', q: 'Were it not for your help, I ___ failed.', o: ['will have', 'would have', 'had', 'would'], a: 1 },
  { d: 'C2', topic: 'passive', q: 'He is said ___ the country in 2010.', o: ['leaving', 'to have left', 'that left', 'to leave'], a: 1 },
];

export const vocab = [
  { d: 'A2', q: 'I\'m very ___ about the test tomorrow. I can\'t sleep.', o: ['worried', 'boring', 'cheap', 'clean'], a: 0 },
  { d: 'A2', q: 'We need to ___ a table at the restaurant for Friday.', o: ['hold', 'book', 'put', 'keep'], a: 1 },
  { d: 'B1', q: 'The company will ___ fifty new employees next year.', o: ['retire', 'resign', 'recruit', 'rely'], a: 2 },
  { d: 'B1', q: 'Samarkand has a rich cultural ___.', o: ['habitat', 'salary', 'queue', 'heritage'], a: 3 },
  { d: 'B1', q: 'He got a ___ to study at Oxford, so he did not pay any fees.', o: ['discount', 'scholarship', 'wage', 'prescription'], a: 1 },
  { d: 'B1', q: 'I have a bad cough and a high ___.', o: ['habit', 'tip', 'fever', 'vacancy'], a: 2 },
  { d: 'B1', q: 'After the injury it took him months to ___.', o: ['recall', 'reduce', 'reject', 'recover'], a: 3 },
  { d: 'B2', q: 'Many species are facing ___ because of habitat loss.', o: ['extension', 'extinction', 'expression', 'explosion'], a: 1 },
  { d: 'B2', q: 'Experts ___ that unemployment will fall next year.', o: ['predict', 'prevent', 'pretend', 'prefer'], a: 0 },
  { d: 'B2', q: 'After long talks the two sides reached a ___ on prices.', o: ['contrast', 'concept', 'compromise', 'compound'], a: 2 },
  { d: 'C1', q: 'The new policy had a ___ effect on small businesses: many had to close.', o: ['detrimental', 'trivial', 'coherent', 'spontaneous'], a: 0 },
  { d: 'C1', q: 'Her argument was so ___ that nobody could disagree.', o: ['compulsory', 'complicated', 'compelling', 'comparative'], a: 2 },
  { d: 'C1', q: 'Governments must ___ the effects of climate change.', o: ['mimic', 'mitigate', 'migrate', 'mention'], a: 1 },
  { d: 'C1', q: 'The results were ___; they could be understood in two ways.', o: ['ambitious', 'amateur', 'ambiguous', 'abundant'], a: 2 },
  { d: 'C2', q: 'His ___ remarks about her work offended everyone.', o: ['dormant', 'derogatory', 'durable', 'dubious'], a: 1 },
  { d: 'C2', q: 'The treaty was ___ by both parliaments after months of debate.', o: ['rationed', 'ruptured', 'retaliated', 'ratified'], a: 3 },
];

export const reading = [
  {
    id: 'r1', level: 'B1', title: 'The Little Tea House',
    text: `In the old part of our city there is a small tea house called "Gulchehra". It is more than eighty years old, and it is still owned by the same family. The present owner, Mrs. Karimova, took over the business from her mother twenty years ago. Every morning she gets up at four o'clock to prepare fresh bread and sweets for the day.

The tea house is not fashionable. The chairs are old and the walls are covered with faded photographs, but people say that this is exactly why they love it. Regular customers come every day, and they often stay for hours, talking with friends or playing chess. Last year a large company offered Mrs. Karimova a lot of money for the building. They wanted to open a modern coffee shop there. She refused. "Money is important," she told a journalist, "but some things cannot be bought. If I sold this place, my customers would lose their second home."

Recently, however, young people have started to visit "Gulchehra", too. They take photographs of the old cups and post them online, and the tea house has become popular on social media. Mrs. Karimova does not understand why this happened, but she is happy. She says that business has improved by almost a third.`,
    q: [
      { d: 'A2', q: 'How old is the tea house?', o: ['About twenty years', 'More than eighty years', 'Exactly fifty years', 'Less than ten years'], a: 1 },
      { d: 'A2', q: 'What does Mrs. Karimova do at four o\'clock every morning?', o: ['She plays chess', 'She meets journalists', 'She prepares bread and sweets', 'She closes the shop'], a: 2 },
      { d: 'B1', q: 'Why do customers like the tea house, according to the text?', o: ['It is modern and fashionable', 'It is cheap', 'It has famous visitors', 'It is old and has a special atmosphere'], a: 3 },
      { d: 'B1', q: 'Why did Mrs. Karimova refuse the offer?', o: ['The sum was too small', 'She thought customers would lose a place they love', 'She wanted to open a coffee shop herself', 'Her mother forbade it'], a: 1 },
      { d: 'B1', q: 'What is Mrs. Karimova\'s attitude to the new popularity online?', o: ['Angry and worried', 'Pleased although she does not fully understand it', 'Completely indifferent', 'Proud of her marketing plan'], a: 1 },
    ],
  },
  {
    id: 'r2', level: 'C1', title: 'Cities That Breathe',
    text: `For most of the twentieth century, planners treated greenery in cities as decoration: pleasant to look at, but the first thing to be sacrificed when land became expensive. That assumption is now being overturned. A growing body of research suggests that trees, green roofs and small urban parks are not luxuries but a form of infrastructure, as essential to a city's functioning as drains or power lines.

The most striking evidence concerns heat. Dense areas of concrete and asphalt absorb sunlight and release it slowly at night, a phenomenon known as the urban heat island effect. In some European cities, neighbourhoods with little vegetation can be up to ten degrees warmer than leafy districts only a few kilometres away. Since high temperatures are particularly dangerous for the elderly, the distribution of trees has become, in effect, a public health issue.

Critics point out that greening a city is not always as benign as it sounds. Improved parks tend to push up property prices, which can force out the very residents who stood to benefit most — a process sometimes called "green gentrification". Moreover, trees require water at a time when many regions are struggling with drought, and poorly chosen species can damage pavements or trigger allergies.

Consequently, the most thoughtful projects combine planting with social policy: guaranteeing affordable housing near new parks, selecting drought-resistant native species, and involving local communities in design. Whether such measures will be enough remains uncertain, but few experts now doubt that the question is no longer whether cities should be green, but how to make that greenery fair.`,
    q: [
      { d: 'B2', q: 'What was the traditional attitude of planners towards urban greenery?', o: ['It was considered vital infrastructure', 'It was seen as an optional extra', 'It was banned in dense areas', 'It was paid for by residents'], a: 1 },
      { d: 'B2', q: 'According to the text, why can concrete neighbourhoods be hotter?', o: ['Concrete creates heat from traffic', 'Concrete stores sunlight and releases it slowly', 'Trees block the wind', 'Cities use more electricity at night'], a: 1 },
      { d: 'B2', q: 'Why is tree distribution described as a "public health issue"?', o: ['Trees cause allergies', 'Heat is especially risky for vulnerable people such as the elderly', 'Parks are expensive to maintain', 'Pollution is higher near trees'], a: 1 },
      { d: 'C1', q: 'What does "green gentrification" refer to?', o: ['Planting only native species', 'Parks that raise prices and displace existing residents', 'Government control of parks', 'Replacing old trees with new ones'], a: 1 },
      { d: 'C1', q: 'What is the writer\'s overall conclusion?', o: ['Cities should stop planting trees', 'Greening is harmful and should be avoided', 'The debate has shifted to how to green cities fairly', 'Research on greenery is unreliable'], a: 2 },
    ],
  },
];

export const listening = [
  {
    id: 'l1', level: 'A2', title: 'Joining a course', speakers: ['Receptionist', 'Student'],
    lines: [
      ['Receptionist', 'Good morning. Can I help you?'],
      ['Student', 'Hello. I would like to join an evening English course, please.'],
      ['Receptionist', 'Of course. We have two courses in the evening. One starts on Monday and the other one starts on Wednesday. Both are from six to eight o\'clock.'],
      ['Student', 'Is the Wednesday course for beginners?'],
      ['Receptionist', 'No, that one is for intermediate students. The Monday course is for beginners. It costs one hundred and twenty dollars for two months.'],
      ['Student', 'I think I am between the two levels. Can I take a short test first?'],
      ['Receptionist', 'Yes, certainly. The test takes about twenty minutes. If you come on Saturday at ten, our teacher can check your level. Please bring your passport.'],
      ['Student', 'Perfect. Saturday at ten. Thank you very much!'],
    ],
    q: [
      { d: 'A2', q: 'What time do the evening courses start?', o: ['At six', 'At eight', 'At ten', 'At twelve'], a: 0 },
      { d: 'A2', q: 'Which course is for beginners?', o: ['The Monday course', 'The Wednesday course', 'The Saturday course', 'Both courses'], a: 0 },
      { d: 'A2', q: 'How much does the beginner course cost?', o: ['$20', '$100', '$120', '$200'], a: 2 },
      { d: 'B1', q: 'Why does the student want to take a test?', o: ['She is sure she is a beginner', 'She is not sure which level suits her', 'The course is free after the test', 'The teacher asked her to'], a: 1 },
      { d: 'B1', q: 'What must the student bring on Saturday?', o: ['Money', 'A pen', 'Her passport', 'A photograph'], a: 2 },
    ],
  },
  {
    id: 'l2', level: 'B2', title: 'Sleep and learning', speakers: ['Lecturer'],
    lines: [
      ['Lecturer', `Today I'd like to talk about something every student knows from experience but few take seriously: the relationship between sleep and learning. For a long time, scientists believed that sleep was simply a period of rest for the brain. Over the last two decades, however, research has shown that the opposite is true. While we sleep, the brain is remarkably active, and it is during this time that new information is organised and stored.

One well-known experiment involved two groups of students who learned a list of unfamiliar words. The first group went to sleep after studying, while the second group stayed awake for the same number of hours. When tested a day later, the group who had slept remembered about forty per cent more words. Interestingly, the effect was strongest when the students slept within a few hours of studying, rather than waiting until the following night.

This has practical consequences. Many students believe that staying up all night before an exam is the best strategy. In fact, it is likely to be counterproductive. Not only does tiredness reduce concentration, but the brain also loses the chance to consolidate what has been learned. A far better plan is to study in short sessions, with a good night's sleep in between. Of course, this requires organisation, and I know that is easier said than done. But if there is one habit I would encourage you to change this semester, it is this one.`],
    ],
    q: [
      { d: 'B2', q: 'What did scientists once believe about sleep?', o: ['That it organises memories', 'That it is mainly a period of rest', 'That it is unnecessary for adults', 'That it reduces learning'], a: 1 },
      { d: 'B2', q: 'In the experiment, how did the sleeping group perform?', o: ['They remembered about 40% more words', 'They remembered fewer words', 'They remembered the same number', 'They did not take the test'], a: 0 },
      { d: 'B2', q: 'When was the effect strongest?', o: ['When students slept the following night', 'When students slept soon after studying', 'When students drank coffee', 'When students studied twice'], a: 1 },
      { d: 'C1', q: 'What does the lecturer say about staying up all night before an exam?', o: ['It is the best strategy', 'It is probably counterproductive', 'It only helps in the morning', 'It is necessary for difficult subjects'], a: 1 },
      { d: 'C1', q: 'What attitude does the lecturer show in the final part?', o: ['Doubtful about the research', 'Realistic but encouraging a change of habit', 'Critical of students', 'Uninterested in the topic'], a: 1 },
    ],
  },
];

export const writing = [
  { id: 'w1', level: 'B1', minutes: 15, words: [80, 120], prompt: 'Your English-speaking friend is coming to visit your city for a weekend. Write an email (80–120 words) to him/her. Say what you plan to do together, what he/she should bring, and why you are excited.' },
  { id: 'w2', level: 'B2', minutes: 20, words: [150, 200], prompt: 'Some people think that children should start learning a foreign language at primary school, while others believe it is better to wait until secondary school. Discuss both views and give your own opinion. Write 150–200 words.' },
];

export const speaking = [
  { id: 's1', level: 'A2', seconds: 40, prompt: 'Introduce yourself. Tell me your name, where you live, what you do, and what you like doing in your free time.' },
  { id: 's2', level: 'B1', seconds: 60, prompt: 'Describe a trip or a holiday you remember well. Where did you go? Who was with you? What did you do, and why do you remember it?' },
  { id: 's3', level: 'B2', seconds: 75, prompt: 'Some people say technology makes our lives easier, but others think it creates new problems. What is your opinion? Give reasons and examples.' },
];
