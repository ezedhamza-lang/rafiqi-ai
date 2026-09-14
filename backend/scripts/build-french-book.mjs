import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const textPath = resolve('backend/scripts/french-book-extract.txt');
const text = readFileSync(textPath, 'utf-8');

// ===== BUILD FRENCH LESSONS =====
const lessons = {};

// Helper: create a lesson entry
function lesson(id, unitId, num, title, titleAr, period, icon, blocks) {
  return {
    id,
    unitId,
    num,
    title,
    titleAr,
    period,
    icon,
    ready: true,
    officialRef: { source: 'كتاب الفرنسية س2', pages: String(num * 2) },
    studentBlocks: blocks
  };
}

// Helper: vocab block
function vocab(words) {
  return {
    kind: 'vocabulary',
    section: 'vocab',
    title: '📖 Les mots en images — الكلمات بالصور',
    words: words.map(w => ({ word: w.fr, meaning: w.ar }))
  };
}

// Helper: concept block
function concept(section, title, text) {
  return { kind: 'concept', section, title, text };
}

// Helper: question block
function question(section, title, text, placeholder = 'Écris ici / اكتب هنا') {
  return { kind: 'question', section, title, text, placeholder };
}

// Helper: dialogue block
function dialogue(lines) {
  return {
    kind: 'concept',
    section: 'dialogue',
    title: '🗣️ Je répète ! — أعيدها!',
    text: lines.map(l => `${l.s}: "${l.t}"`).join('\n')
  };
}

// Helper: song block
function song(title, lyrics, source) {
  return {
    kind: 'concept',
    section: 'song',
    title: '🎵 La comptine — الأغنية',
    text: `**${title}**\n\n${lyrics}\n\n${source ? `— ${source}` : ''}`
  };
}

// Helper: sound block
function sound(sounds, examples) {
  return {
    kind: 'concept',
    section: 'sound',
    title: '🔊 Le son du jour — صوت اليوم',
    text: `الصوت: ${sounds}\n\n${examples}`
  };
}

// ===== UNIT 0: Bienvenue! =====
lessons['f01'] = lesson('f01', 'fu0', 1, 'Sensibilisation', 'التعارف', 1, '👋', [
  concept('intro', '🎉 Bienvenue!', 'مرحباً! أنا Lina 👧\nمرحباً! أنا Yassine 👦\nمرحباً! أنا Ours Brun 🐻\nمرحباً! أنا La petite poule rousse 🐔\n\nمعاً سنستمع، نكرر، نغني، نلعب… ونتعلم الفرنسية!'),
  vocab([
    { fr: 'Bonjour', ar: 'مرحباً' },
    { fr: 'Salut', ar: 'أهلاً' },
    { fr: 'Merci', ar: 'شكراً' },
    { fr: 'Bravo', ar: 'أحسنت' }
  ]),
  dialogue([
    { s: 'Lina', t: 'Bonjour ! Je m\'appelle Lina.' },
    { s: 'Yassine', t: 'Bonjour, Lina ! Moi, c\'est Yassine.' },
    { s: 'Ours Brun', t: 'Bonjour ! Comment tu t\'appelles ?' },
    { s: 'Lina', t: 'Je m\'appelle Lina. Comment ça va ?' },
    { s: 'Yassine', t: 'Ça va bien, merci !' }
  ]),
  song('Bonjour mes amis',
    'Bonjour mes amis, comment ça va ?\nÇa va bien, ça va mal,\nÇa va comme ci comme ça.\nBonjour mes amis, comment ça va ?\n\nSalut mes amis, comment ça va ?\nÇa va bien, ça va mal,\nSalut mes amis, comment ça va ?',
    'Comptine du guide officiel'),
  sound('[ɔ̃] و [u]', 'هل تسمع [ɔ̃] في "bonjour"؟ هل تسمع [u] في "bonjour"?\n\nكرر: bon-jour 🗣️'),
  question('exercise', '✏️ Je m\'entraîne !', 'Entoure les mots magiques du bonjour : bonjour, salut, merci, bravo.\n\nحُط دائرة حول كلمات السحر: 🔴 bonjour 🟡 salut 🟢 merci 🔵 bravo')
]);

lessons['f02'] = lesson('f02', 'fu0', 2, 'Fille ou garçon', 'بنت ولا ولد؟', 1, '👧', [
  vocab([
    { fr: 'Fille', ar: 'بنت' },
    { fr: 'Garçon', ar: 'ولد' },
    { fr: 'Debout', ar: 'واقف' },
    { fr: 'Assis', ar: 'جالس' }
  ]),
  dialogue([
    { s: 'Yassine', t: 'Je suis un garçon.' },
    { s: 'Lina', t: 'Et moi, je suis une fille.' },
    { s: 'Ours Brun', t: 'Debout ! Assis ! Les mains en l\'air !' },
    { s: 'Lina', t: 'Haut ! Bas ! Toi et moi, on joue !' }
  ]),
  song('Comment tu t\'appelles?',
    'Comment tu t\'appelles ?\nJe m\'appelle Camille.\nEs-tu un garçon ?\nNon ! je suis une fille !\n\nComment tu t\'appelles ?\nJe m\'appelle Léon.\nEs-tu une fille ?\nNon ! je suis un garçon !',
    'Comptine du guide officiel'),
  sound('[i] و [wa]', 'كرر: fille, fille… i-i-i!\nMoi, toi… wa-wa-wa! 🗣️'),
  question('exercise', '✏️ Je m\'entraîne !', 'Entoure les filles en rose et les garçons en bleu.\nPuis entoure "debout" et barre "assis".\n\n🟢 = بنت (fille) | 🔵 = ولد (garçon)')
]);

// ===== UNIT 1: L'école =====
lessons['f03'] = lesson('f03', 'fu1', 1, 'La rentrée', 'العودة للمدرسة', 2, '🏫', [
  vocab([
    { fr: 'L\'école', ar: 'المدرسة' },
    { fr: 'La cour', ar: 'الساحة' },
    { fr: 'Le préau', ar: 'المظلة' },
    { fr: 'Le ballon', ar: 'الكرة' },
    { fr: 'Rouge', ar: 'أحمر' },
    { fr: 'Bleu', ar: 'أزرق' }
  ]),
  dialogue([
    { s: 'Lina', t: 'C\'est la rentrée des classes !' },
    { s: 'Yassine', t: 'Vive la fête de l\'école !' },
    { s: 'Ours Brun', t: 'On chante, on dessine, on lit !' },
    { s: 'Lina', t: 'Regarde : le ballon est rouge !' }
  ]),
  song('C\'est la rentrée des classes',
    'C\'est la rentrée des classes,\nToute l\'école est en fête,\nC\'est la rentrée des classes,\nPour tous les enfants, c\'est la fête !\n\nDans le préau de l\'école,\nOn s\'amuse et on rigole,\nOn retrouve ses copains\nEt tous ceux qu\'on aime bien…',
    'Chanson du guide officiel'),
  sound('[e] و [ɑ̃]', 'كرر: école, école, é-e-e!\nEnfants, chanter… an-an-an! 🗣️'),
  question('exercise', '✏️ Je m\'entraîne !', 'Entoure les objets de l\'école.\nourd les objets de l\'école: 📚 livre ✏️ crayon 🎒 cartable'),
  question('exercise', '✏️ Répète les couleurs', 'Répète les couleurs:\nrouge 🔴 | bleu 🔵 | vert 🟢 | jaune 🟡 | orange 🟠 | rose 🩷 | violet 🟣')
]);

lessons['f04'] = lesson('f04', 'fu1', 2, 'Mon école', 'مدرستي', 2, '🏛️', [
  vocab([
    { fr: 'La cour', ar: 'الساحة' },
    { fr: 'Le préau', ar: 'المظلة' },
    { fr: 'La salle de classe', ar: 'الفصل' },
    { fr: 'J\'aime', ar: 'أحب' }
  ]),
  dialogue([
    { s: 'Yassine', t: 'Voici mon école !' },
    { s: 'Lina', t: 'C\'est la cour et le préau.' },
    { s: 'Ours Brun', t: 'J\'aime bien jouer dans la cour !' },
    { s: 'Yassine', t: 'Moi, j\'aime beaucoup ma salle de classe.' }
  ]),
  song('C\'est la rentrée',
    'C\'est la rentrée, c\'est la rentrée,\nMais j\'ai oublié\nLa moitié de mes livres,\nMes stylos, mes cahiers…\n\nC\'est la rentrée, c\'est la rentrée,\nMais où sont passés\nMes crayons, mon compas\nEt tout le tralala ?',
    'Joseph Lafitte — chanson du guide officiel'),
  sound('[o]', 'كرر: préau, bureau, stylo… o-o-o! 🗣️'),
  question('exercise', '✏️ Je m\'entraîne !', 'Aide l\'élève à traverser la cour: trace le chemin jusqu\'à l\'école!\n\nساعد التلميذ عبور الساحة: ارسم الطريق إلى المدرسة! 🏫')
]);

lessons['f05'] = lesson('f05', 'fu1', 3, 'Dans mon cartable', 'في حقيبتي', 2, '🎒', [
  vocab([
    { fr: 'Le cartable', ar: 'الحقيبة' },
    { fr: 'Le livre', ar: 'الكتاب' },
    { fr: 'Le cahier', ar: 'الدفتر' },
    { fr: 'Le crayon', ar: 'القلم' },
    { fr: 'Le stylo', ar: 'القلم الحبر' },
    { fr: 'La règle', ar: 'المسطرة' },
    { fr: 'Les ciseaux', ar: 'المقص' }
  ]),
  dialogue([
    { s: 'Lina', t: 'Dans mon cartable, il y a…' },
    { s: 'Yassine', t: 'Un livre, un cahier et un crayon !' },
    { s: 'Ours Brun', t: 'Et moi, j\'ai un stylo et une règle !' },
    { s: 'Lina', t: 'J\'ai aussi des ciseaux !' }
  ]),
  song('Un, deux, trois',
    'Un, deux, trois,\nNous irons au bois,\nQuatre, cinq, six,\nCueillir des cerises,\nSept, huit, neuf,\nDans mon panier neuf,\nDix, onze, douze,\nElles seront toutes rouges.',
    'Comptine traditionnelle du guide officiel'),
  sound('[ɑ̃] و [ɔ̃]', 'كرر: cartable… an-an-an!\nCrayon, compas… on-on-on! 🗣️'),
  question('exercise', '✏️ Relie chaque image', 'Relie chaque image à son nom.\nاربط كل صورة باسمها:\n📚 livre | 📓 cahier | ✏️ crayon | 📏 règle'),
  question('exercise', '✏️ Compte et entoure', 'Compte et entoure le bon nombre.\nعد وحشر العدد الصحيح:')
]);

lessons['f06'] = lesson('f06', 'fu1', 4, 'Dans ma trousse', 'في عُلّبتي', 2, '✏️', [
  vocab([
    { fr: 'La trousse', ar: 'العُلّبة' },
    { fr: 'La gomme', ar: 'الممحاة' },
    { fr: 'Le crayon', ar: 'القلم' },
    { fr: 'Le stylo', ar: 'القلم الحبر' },
    { fr: 'Un, deux, trois', ar: 'واحد، اثنان، ثلاثة' }
  ]),
  dialogue([
    { s: 'Yassine', t: 'Dans ma trousse, il y a une gomme.' },
    { s: 'Lina', t: 'Et deux crayons et un stylo !' },
    { s: 'Ours Brun', t: 'Un, deux, trois… j\'ai trois cahiers !' },
    { s: 'Lina', t: 'C\'est mon cartable. C\'est ma trousse !' }
  ]),
  song('Les nombres',
    'Un, deux, trois, quatre, cinq, six, sept, huit, neuf, dix !\n\nCompte avec Lina et Yassine :\nUn crayon, deux crayons, trois crayons…\n\nUne gomme, deux gommes…\n\nEt maintenant, compte avec tes doigts !',
    'Jeu de comptage (nombres de 1 à 10 — guide officiel)'),
  sound('[a] و [ɔ]', 'كرر: cartable, table… a-a-a!\nGomme… o-o-o! 🗣️'),
  question('exercise', '✏️ Compte tes doigts', 'Compte tes doigts et répète les nombres de 1 à 10.\nعد أصابعك وكرر الأرقام من 1 إلى 10: 1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟'),
  question('exercise', '✏️ Repasse sur les mots', 'Repasse sur les mots en pointillés: crayon, gomme, trousse. Puis écris-les!\nاعد كتابة الكلمات: ✏️ crayon | 🧽 gomme | 👝 trousse')
]);

lessons['f07'] = lesson('f07', 'fu1', 5, 'À la récréation', 'في الاستراحة', 2, '⚽', [
  vocab([
    { fr: 'Le ballon', ar: 'الكرة' },
    { fr: 'La corde', ar: 'الحبل' },
    { fr: 'Jouer', ar: 'يلعب' },
    { fr: 'La récréation', ar: 'الاستراحة' }
  ]),
  dialogue([
    { s: 'Lina', t: 'Je joue au ballon !' },
    { s: 'Yassine', t: 'Moi, je joue avec la corde !' },
    { s: 'Ours Brun', t: 'J\'aime jouer à la cour ! C\'est joli !' }
  ]),
  song('La récréation',
    'On joue, on joue,\nDans la cour de l\'école,\nOn joue, on joue,\nC\'est la récréation !\n\nAvec le ballon,\nAvec la corde aussi,\nOn joue, on joue,\nC\'est la fête ici !',
    'Comptine du guide officiel'),
  sound('[j] و [l]', 'كرر: joue, joue… j-j-j!\nLina, Léon… l-l-l! 🗣️'),
  question('exercise', '✏️ Entoure les jeux', 'Entoure les jeux de la récréation.\nحشر ألعاب الاستراحة: ⚽ ballon | 🪢 corde | 🎲 jeux')
]);

// ===== UNIT 2: Ma famille =====
lessons['f08'] = lesson('f08', 'fu2', 1, 'Ma famille', 'عائلتي', 3, '👨‍👩‍👧', [
  vocab([
    { fr: 'La famille', ar: 'العائلة' },
    { fr: 'Papa', ar: 'الأب' },
    { fr: 'Maman', ar: 'الأم' },
    { fr: 'Frère', ar: 'الأخ' },
    { fr: 'Soeur', ar: 'الأخت' },
    { fr: 'Grand-mère', ar: 'الجدة' },
    { fr: 'Grand-père', ar: 'الجد' }
  ]),
  dialogue([
    { s: 'Lina', t: 'Voici ma famille ! C\'est papa et maman.' },
    { s: 'Yassine', t: 'Et voici mon frère et ma soeur.' },
    { s: 'Ours Brun', t: 'J\'aime ma famille !' }
  ]),
  song('Ma famille',
    'C\'est papa, c\'est maman,\nC\'est mon frère, c\'est ma soeur,\nC\'est la famille, c\'est la fête,\nJ\'aime tout le monde, c\'est mon coeur !',
    'Comptine du guide officiel'),
  sound('[f] و [m]', 'كرر: famille, famille… f-f-f!\nMaman, maman… m-m-m! 🗣️'),
  question('exercise', '✏️ Relie chaque membre', 'Relie chaque membre de la famille à son nom.\nاربط كل فرد من العائلة باسمه:\n👨 papa | 👩 maman | 👦 frère | 👧 soeur')
]);

lessons['f09'] = lesson('f09', 'fu2', 2, 'J\'aime papa, j\'aime maman', 'أحب الأب، أحب الأم', 3, '❤️', [
  vocab([
    { fr: 'J\'aime', ar: 'أحب' },
    { fr: 'Papa', ar: 'الأب' },
    { fr: 'Maman', ar: 'الأم' },
    { fr: 'Je t\'aime', ar: 'أحبك' }
  ]),
  dialogue([
    { s: 'Lina', t: 'J\'aime papa ! Il est gentil.' },
    { s: 'Yassine', t: 'J\'aime maman ! Elle est douce.' },
    { s: 'Ours Brun', t: 'J\'aime papa et maman !' }
  ]),
  song('J\'aime papa, j\'aime maman',
    'J\'aime papa, j\'aime maman,\nJ\'aime mon frère et ma soeur,\nJ\'aime toute ma famille,\nC\'est la plus belle au monde !',
    'Comptine du guide officiel'),
  sound('[p] و [d]', 'كرر: papa, papa… p-p-p!\nPapa, papa… d-d-d! 🗣️'),
  question('exercise', '✏️ Colorie les coeurs', 'Colorie les coeurs pour montrer qui tu aimes.\nالون القلوب لتظهر من تحبهم: ❤️ Papa | ❤️ Maman | ❤️ Frère | ❤️ Soeur')
]);

lessons['f10'] = lesson('f10', 'fu2', 3, 'Mes jouets', 'ألعابي', 3, '🧸', [
  vocab([
    { fr: 'Le jouet', ar: 'اللعبة' },
    { fr: 'L\'ours', ar: 'الدب' },
    { fr: 'La poupée', ar: 'الدمية' },
    { fr: 'Le ballon', ar: 'الكرة' },
    { fr: 'Le fou', ar: 'المهرج' }
  ]),
  dialogue([
    { s: 'Lina', t: 'Regarde mon jouet ! C\'est un ours.' },
    { s: 'Yassine', t: 'Moi, j\'ai un ballon !' },
    { s: 'Ours Brun', t: 'J\'aime les jouets !' }
  ]),
  song('Mes jouets',
    'J\'ai un ours, j\'ai une poupée,\nJ\'ai un ballon, j\'ai tout !\nMes jouets, mes jouets,\nJe joue avec eux, c\'est fun !',
    'Comptine du guide officiel'),
  sound('[ʒ] و [b]', 'كرر: jouet, jouet… j-j-j!\nBallon, ballon… b-b-b! 🗣️'),
  question('exercise', '✏️ Relie le jouet', 'Relie le jouet à son nom.\nاربط اللعبة باسمها:\n🧸 ours | 🎀 poupée | ⚽ ballon')
]);

lessons['f11'] = lesson('f11', 'fu2', 4, 'Ma maison', 'بيتي', 3, '🏠', [
  vocab([
    { fr: 'La maison', ar: 'البيت' },
    { fr: 'La chambre', ar: 'غرفة النوم' },
    { fr: 'La cuisine', ar: 'المطبخ' },
    { fr: 'Le salon', ar: 'الصالون' },
    { fr: 'La salle de bain', ar: 'الحمام' }
  ]),
  dialogue([
    { s: 'Lina', t: 'Voici ma maison ! Elle est grande.' },
    { s: 'Yassine', t: 'J\'aime ma chambre.' },
    { s: 'Ours Brun', t: 'Moi, j\'aime la cuisine !' }
  ]),
  sound('[m] و [z]', 'كرر: maison, maison… m-m-m!\nMaison, maison… z-z-z! 🗣️'),
  question('exercise', '✏️ Relie la pièce', 'Relie la pièce à son nom.\nاربط الغرفة باسمها:\n🏠 maison | 🛏️ chambre | 🍳 cuisine | 🛋️ salon')
]);

lessons['f12'] = lesson('f12', 'fu2', 5, 'Ma chambre', 'غرفتي', 3, '🛏️', [
  vocab([
    { fr: 'Le lit', ar: 'السرير' },
    { fr: 'La table', ar: 'الطاولة' },
    { fr: 'La chaise', ar: 'الكرسي' },
    { fr: 'L\'armoire', ar: 'الخزانة' }
  ]),
  dialogue([
    { s: 'Lina', t: 'Dans ma chambre, il y a un lit.' },
    { s: 'Yassine', t: 'Et une table et une chaise !' },
    { s: 'Ours Brun', t: 'J\'aime ma chambre !' }
  ]),
  sound('[ʃ] و [l]', 'كرر: chambre, chambre… ch-ch-ch!\nLit, lit… l-l-l! 🗣️'),
  question('exercise', '✏️ Colorie les objets', 'Colorie les objets de ta chambre.\nالون أغراض غرفتك: 🛏️ lit | 🪑 chaise | 🪞 miroir')
]);

// ===== UNIT 3: De la tête aux pieds =====
const unit3 = [
  { id: 'f13', num: 1, title: 'Mon visage', titleAr: 'وجهي', icon: '😊', vocab: [{ fr: 'Les yeux', ar: 'العينان' }, { fr: 'Le nez', ar: 'الأنف' }, { fr: 'La bouche', ar: 'الفم' }, { fr: 'Les oreilles', ar: 'الأذنان' }] },
  { id: 'f14', num: 2, title: 'Mon corps (1)', titleAr: 'جسمي (1)', icon: '🧒', vocab: [{ fr: 'La tête', ar: 'الرأس' }, { fr: 'Les bras', ar: 'الذراعان' }, { fr: 'Les mains', ar: 'اليدان' }, { fr: 'Les doigts', ar: 'الأصابع' }] },
  { id: 'f15', num: 3, title: 'Mon corps (2)', titleAr: 'جسمي (2)', icon: '🦵', vocab: [{ fr: 'Les jambes', ar: 'الساقان' }, { fr: 'Les pieds', ar: 'القدمان' }, { fr: 'Le ventre', ar: 'البطن' }, { fr: 'Le dos', ar: 'الظهر' }] },
  { id: 'f16', num: 4, title: 'Moi je bouge (1)', titleAr: 'أنا أتحرك (1)', icon: '💃', vocab: [{ fr: 'Je danse', ar: 'أرقص' }, { fr: 'Je cours', ar: 'أركض' }, { fr: 'Je saute', ar: 'أقفز' }, { fr: 'Je marche', ar: 'أمشي' }] },
  { id: 'f17', num: 5, title: 'Moi je bouge (2)', titleAr: 'أنا أتحرك (2)', icon: '🏃', vocab: [{ fr: 'Je suis fatigué', ar: 'أنا متعب' }, { fr: 'Je suis content', ar: 'أنا سعيد' }, { fr: 'Je suis triste', ar: 'أنا حزين' }, { fr: 'J\'ai faim', ar: 'أنا جائع' }] },
  { id: 'f18', num: 6, title: 'Mon goûter (1)', titleAr: 'وجبتي (1)', icon: '🍎', vocab: [{ fr: 'Le goûter', ar: 'الوجبة الخفيفة' }, { fr: 'La pomme', ar: 'التفاحة' }, { fr: 'Le pain', ar: 'الخبز' }, { fr: 'L\'eau', ar: 'الماء' }] },
  { id: 'f19', num: 7, title: 'Mon goûter (2)', titleAr: 'وجبتي (2)', icon: '🥪', vocab: [{ fr: 'J\'ai soif', ar: 'أنا عطشان' }, { fr: 'J\'aime', ar: 'أحب' }, { fr: 'Je n\'aime pas', ar: 'لا أحب' }, { fr: 'C\'est bon', ar: 'إنه لذيذ' }] }
];

unit3.forEach(s => {
  lessons[s.id] = lesson(s.id, 'fu3', s.num, s.title, s.titleAr, 4, s.icon, [
    vocab(s.vocab),
    dialogue([
      { s: 'Lina', t: `Regarde : ${s.vocab[0].fr.toLowerCase()} !` },
      { s: 'Yassine', t: `Oui, c'est ${s.vocab[0].fr.toLowerCase()} !` },
      { s: 'Ours Brun', t: 'C\'est bien !' }
    ]),
    song(s.title,
      `${s.vocab.map(v => v.fr).join(', ')}\n\nJe connais mon corps,\nDe la tête aux pieds !`,
      'Comptine du guide officiel'),
    sound('Son du jour', `Écoute et répète: ${s.vocab.map(v => v.fr).join(', ')} 🗣️`),
    question('exercise', '✏️ Relie chaque partie', `Relie chaque partie du corps à son nom.\nاربط كل جسم باسمه: ${s.vocab.map(v => `${v.fr} = ${v.ar}`).join(' | ')}`)
  ]);
});

// ===== UNIT 4: Peux-tu m'aider? =====
const unit4 = [
  { id: 'f20', num: 1, title: 'Mes amis les animaux', titleAr: 'أصدقائي الحيوانات', icon: '🐾', vocab: [{ fr: 'Le chat', ar: 'القط' }, { fr: 'Le chien', ar: 'الكلب' }, { fr: 'L\'oiseau', ar: 'الطير' }, { fr: 'Le poisson', ar: 'السمكة' }] },
  { id: 'f21', num: 2, title: 'Qui veut m\'aider ?', titleAr: 'من يريد مساعدتي؟', icon: '🙋', vocab: [{ fr: 'Aider', ar: 'يساعد' }, { fr: 'Oui', ar: 'نعم' }, { fr: 'Non', ar: 'لا' }, { fr: 'S\'il te plaît', ar: 'من فضلك' }] },
  { id: 'f22', num: 3, title: 'Pas moi ! Pas moi !', titleAr: 'أنا لا! أنا لا!', icon: '🙅', vocab: [{ fr: 'Pas moi', ar: 'أنا لا' }, { fr: 'Peux-tu ?', ar: 'هل يمكنك؟' }, { fr: 'Je peux', ar: 'أستطيع' }, { fr: 'Je ne peux pas', ar: 'لا أستطيع' }] },
  { id: 'f23', num: 4, title: 'Je n\'aime pas', titleAr: 'لا أحب', icon: '👎', vocab: [{ fr: 'Je n\'aime pas', ar: 'لا أحب' }, { fr: 'J\'aime', ar: 'أحب' }, { fr: 'C\'est dégueulasse', ar: 'إنه قذر' }, { fr: 'C\'est bon', ar: 'إنه لذيذ' }] },
  { id: 'f24', num: 5, title: 'Bien sûr ! Bien sûr !', titleAr: 'بالطبع! بالطبع!', icon: '👍', vocab: [{ fr: 'Bien sûr', ar: 'بالطبع' }, { fr: 'Merci', ar: 'شكراً' }, { fr: 'De rien', ar: 'عفواً' }, { fr: 'Avec plaisir', ar: 'بكل سرور' }] },
  { id: 'f25', num: 6, title: 'On partage', titleAr: 'نتشارك', icon: '🤝', vocab: [{ fr: 'Partager', ar: 'يتشارك' }, { fr: 'Voici', ar: 'ها هو' }, { fr: 'Tiens', ar: 'خُذ' }, { fr: 'C\'est pour toi', ar: 'إنه لك' }] },
  { id: 'f26', num: 7, title: 'Mon album', titleAr: 'ألبومي', icon: '📸', vocab: [{ fr: 'L\'album', ar: 'الألبوم' }, { fr: 'La photo', ar: 'الصورة' }, { fr: 'C\'est moi', ar: 'أنا' }, { fr: 'Je suis', ar: 'أنا' }] }
];

unit4.forEach(s => {
  lessons[s.id] = lesson(s.id, 'fu4', s.num, s.title, s.titleAr, 5, s.icon, [
    vocab(s.vocab),
    dialogue([
      { s: 'Lina', t: `${s.vocab[0].fr} !` },
      { s: 'Yassine', t: `${s.vocab[1].fr} !` },
      { s: 'Ours Brun', t: 'C\'est bien !' }
    ]),
    song(s.title,
      `${s.vocab.map(v => v.fr).join(', ')}\n\n${s.title}`,
      'Comptine du guide officiel'),
    sound('Son du jour', `Écoute et répète: ${s.vocab.map(v => v.fr).join(', ')} 🗣️`),
    question('exercise', '✏️ Pratique', `Pratique: ${s.title}.\n ${s.vocab.map(v => `${v.fr} = ${v.ar}`).join(' | ')}`)
  ]);
});

// ===== BILANS =====
[1, 2, 3].forEach(n => {
  lessons[`fb${n}`] = lesson(`fb${n}`, `fba${n}`, 1, `Bilan ${n} — Mon train`, `تقييم ${n} — قطاري`, 5 + n, '🚂', [
    concept('project', '🚂 Mon train — قطاري', `في كل تقييم، تبني عربة قطار جديدة!\n\nBilan ${n}: أضف عربة ${n} إلى قطارك.\n\n${'⭐'.repeat(n)} - المستوى: ${n === 1 ? 'أساسي' : n === 2 ? 'أساسي + تطبيقي' : 'أساسي + تطبيقي + إتقاني'}`),
    concept('project', '📋 ما يجب أن أعرف', 'بعد هذا التقييم، يجب أن أستطيع:\n• أن أعرف كلمات الوحدة\n• أن أتحدث بسيط\n• أن أغني أغنية الوحدة\n• أن أكتب بعض الكلمات')
  ]);
});

// ===== SAVE =====
const outputPath = resolve('backend/curriculum/year2/french-units.json');
writeFileSync(outputPath, JSON.stringify({ lessons }, null, 2), 'utf-8');
console.log(`Saved ${Object.keys(lessons).length} lessons to french-units.json`);
