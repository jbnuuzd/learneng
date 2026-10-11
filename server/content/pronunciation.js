// Practice sentences for the pronunciation trainer, grouped by the sounds that are hardest for Uzbek speakers.
export const PRON_FOCUS = [
  { id: 'th', title: 'th (θ, ð)', tip: "Til uchini tishlar orasiga qo'ying: think, this" },
  { id: 'wv', title: 'w / v', tip: "v — pastki lab yuqori tishlarga tegadi; w — lablar yumaloq, tishsiz" },
  { id: 'rl', title: 'r / l', tip: "r — til tegmaydi, orqaga buklanadi; l — til uchi tish orqasiga tegadi" },
  { id: 'vowels', title: 'Unlilar (ship / sheep)', tip: "Qisqa i va uzun ee, a va e ni farqlang" },
  { id: 'ed', title: '-ed va -s qo\'shimchalari', tip: "worked [t], played [d], wanted [id]; cats [s], dogs [z], boxes [iz]" },
  { id: 'stress', title: "So'z urg'usi", tip: "photograph — PHO-to-graph, photographer — pho-TOG-ra-pher" },
  { id: 'ng', title: 'ng / h', tip: "ng — burundan, g tovushisiz; h — nafas bilan yengil" },
  { id: 'rhythm', title: 'Ritm va ohang', tip: "Muhim so'zlar urg'u oladi, yordamchi so'zlar qisqa aytiladi" },
];

export const PRON_SENTENCES = [
  // th
  { f: 'th', l: 'A1', t: 'I think this is my third birthday.' },
  { f: 'th', l: 'A2', t: 'Thank you for the three thick books on Thursday.' },
  { f: 'th', l: 'B1', t: 'My brother and father thought about the weather together.' },
  { f: 'th', l: 'B2', t: 'Although the theory seemed thorough, both authors thoroughly disagreed.' },
  // w / v
  { f: 'wv', l: 'A1', t: 'We have a very warm room.' },
  { f: 'wv', l: 'A2', t: 'Seven women visited the village on Wednesday.' },
  { f: 'wv', l: 'B1', t: 'Would you rather view the western valley or visit the waterfall?' },
  { f: 'wv', l: 'B2', t: 'The vivid vision of a well-governed world was valued by everyone.' },
  // r / l
  { f: 'rl', l: 'A1', t: 'The red car is really long.' },
  { f: 'rl', l: 'A2', t: 'Larry likes to read light stories in the library.' },
  { f: 'rl', l: 'B1', t: 'Please remember to rely on the clear, correct rules.' },
  { f: 'rl', l: 'B2', t: 'The reliable lawyer rarely related the real reason clearly.' },
  // vowels
  { f: 'vowels', l: 'A1', t: 'The ship is near the sheep.' },
  { f: 'vowels', l: 'A2', t: 'I live in a big city and I leave at six.' },
  { f: 'vowels', l: 'B1', t: 'He bought a full cup of cold coffee at the pool.' },
  { f: 'vowels', l: 'B2', t: 'The beautiful girl heard the bird sing early in the world.' },
  // -ed / -s
  { f: 'ed', l: 'A1', t: 'She worked and played and wanted more.' },
  { f: 'ed', l: 'A2', t: 'He watched, listened and then decided to leave.' },
  { f: 'ed', l: 'B1', t: 'The teachers managed to fix the boxes, glasses and watches.' },
  { f: 'ed', l: 'B2', t: 'They discussed, adjusted and finally accepted the proposed changes.' },
  // stress
  { f: 'stress', l: 'A2', t: 'The photographer took a photograph of the engineer.' },
  { f: 'stress', l: 'B1', t: 'I would like to record a record about the information.' },
  { f: 'stress', l: 'B2', t: 'The economic situation requires a comprehensive international agreement.' },
  { f: 'stress', l: 'C1', t: 'Their unprecedented achievements significantly influenced contemporary education.' },
  // ng / h
  { f: 'ng', l: 'A1', t: 'He is singing a long song.' },
  { f: 'ng', l: 'A2', t: 'The hungry king is hoping to hold his hat.' },
  { f: 'ng', l: 'B1', t: 'Having finished the morning meeting, we kept running and laughing.' },
  // rhythm
  { f: 'rhythm', l: 'A2', t: 'Can you tell me where the station is?' },
  { f: 'rhythm', l: 'B1', t: 'I was going to call you, but I had lost my phone.' },
  { f: 'rhythm', l: 'B2', t: 'If I had known about the delay, I would have taken a different route.' },
  { f: 'rhythm', l: 'C1', t: 'Not only did the results surprise us, they also changed our entire approach.' },
];
