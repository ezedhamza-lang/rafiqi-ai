/**
 * مغامرة رفيقي – حديقة المعرفة
 * Brand palette, physics tuning and world themes.
 * Colours mirror the Rafiqi design tokens (navy + royal blue + gold).
 */

export const BRAND = {
  navy: 0x102a56,
  navy2: 0x1e3a6e,
  primary: 0x155eef,
  primaryLight: 0x5b8cff,
  gold: 0xe8a317,
  goldLight: 0xf7ce5e,
  green: 0x10b981,
  red: 0xdc2626,
  white: 0xffffff,
  // Mascot (the Rafiqi owl)
  owlBody: 0x3f8ee0,
  owlDark: 0x2a63a8,
  owlBelly: 0xd9ecff,
  owlBeak: 0xf0a91c,
  cap: 0x1a3a75,
  tassel: 0xf0a91c
};

export const TUNING = {
  runSpeed: 15.5,
  gravity: 62,
  jumpVel: 21.5,
  doubleJumpVel: 18.5,
  dashSpeed: 34,
  dashTime: 0.34,
  dashCooldown: 1.1,
  coyoteTime: 0.12,
  steerAccel: 14,
  steerMax: 12.5,
  decel: 9,
  // Pulled back and raised: the child must see the tiles ahead, not just the
  // back of the owl's head. Height stays moderate so the owl sits in the
  // lower third rather than at the very bottom edge.
  camDist: 17,
  camHeight: 8,
  camLag: 5.2,
  camLookAhead: 8,
  // Spacing between challenge zones along the course.
  zoneSpacing: 46,
  // Section length is derived from the number of challenges in the level.
  sectionLead: 40,
  collectRadius: 5.2
};

export const KEYS = {
  jump: ['Space', 'ArrowUp', 'KeyW'],
  dash: ['ShiftLeft', 'ShiftRight'],
  steerLeft: ['ArrowLeft', 'KeyA'],
  steerRight: ['ArrowRight', 'KeyD']
};

/**
 * The seven learning worlds. Each has a distinct palette and decor recipe so
 * the student always knows where they are from a single screenshot.
 */
export const WORLD_THEMES = {
  'letters-garden': {
    name: 'حديقة الحروف',
    emoji: '🌱',
    sky: 0x9ad9f5,
    fog: [90, 420],
    ground: 0x7cc45a,
    groundAlt: 0x5aa843,
    path: 0xe4d3a8,
    accent: 0xff8fb1,
    decor: ['flower', 'tree', 'giantLetter', 'butterfly'],
    blurb: 'تعلّم الحروف بين الزهور والفراشات'
  },
  'word-forest': {
    name: 'غابة الكلمات',
    emoji: '🌳',
    sky: 0x8fd6b8,
    fog: [80, 400],
    ground: 0x5fae62,
    groundAlt: 0x468a4c,
    path: 0xc9a978,
    accent: 0x8e6bd6,
    decor: ['bigBook', 'wordSign', 'magicTree', 'mushroom'],
    blurb: 'ابنِ الكلمات بين الكتب العملاقة'
  },
  'sentence-village': {
    name: 'قرية الجمل',
    emoji: '🏡',
    sky: 0xffd9a8,
    fog: [90, 420],
    ground: 0xd9b382,
    groundAlt: 0xc09a68,
    path: 0xf0e0c0,
    accent: 0xe8544f,
    decor: ['bookHouse', 'letterRoad', 'lamp', 'fence'],
    blurb: 'رتّب الجمل في قرية من الكتب'
  },
  'knowledge-castle': {
    name: 'قلعة المعرفة',
    emoji: '🏰',
    sky: 0xb8c6e8,
    fog: [100, 460],
    ground: 0x9aa4b8,
    groundAlt: 0x828da3,
    path: 0xd3d9e6,
    accent: 0x155eef,
    decor: ['tower', 'library', 'puzzle', 'bridge'],
    blurb: 'حلّ ألغاز القلعة والمكتبة العظيمة'
  },
  'challenge-valley': {
    name: 'وادي التحديات',
    emoji: '🌋',
    sky: 0xc9a3d6,
    fog: [70, 380],
    ground: 0x7a6a86,
    groundAlt: 0x5f5269,
    path: 0xa08fb0,
    accent: 0xff7043,
    decor: ['rock', 'waterfall', 'movingPlatform', 'lavaGlow'],
    blurb: 'وادي الصخور والشلالات بتحديات سريعة'
  },
  'knowledge-city': {
    name: 'مدينة المعرفة',
    emoji: '☁️',
    sky: 0x7fc4f0,
    fog: [120, 520],
    ground: 0xb9c4d4,
    groundAlt: 0x9aa7ba,
    path: 0xe8edf5,
    accent: 0x00bcd4,
    decor: ['skyscraper', 'neonSign', 'holoBoard', 'fountain'],
    blurb: 'مدينة عصرية من الأرقام والمعادلات'
  },
  'champions-island': {
    name: 'جزيرة الأبطال',
    emoji: '⭐',
    sky: 0xffc7e0,
    fog: [100, 480],
    ground: 0xffe08a,
    groundAlt: 0xe8c46a,
    path: 0xfff4d0,
    accent: 0xff6f91,
    decor: ['palm', 'statue', 'trophy', 'crystal'],
    blurb: 'جزيرة الأبطال — التحدي الأخير'
  }
};

export const WORLD_ORDER = Object.keys(WORLD_THEMES);

export const COSMETIC_DEFAULTS = {
  cap: 'graduation',
  glasses: 'round',
  backpack: 'none',
  book: 'none',
  trail: 'none',
  jump: 'puff'
};

/** Cosmetic catalogue shown in the wardrobe. `ruleKey` matches the server. */
export const COSMETICS = {
  cap: [
    { id: 'graduation', label: 'قبعة التخرّج', ruleKey: null, color: BRAND.cap },
    { id: 'turban', label: 'عمامة المعرفة', ruleKey: 'cap:turban', color: 0xf7f7f7 },
    { id: 'star', label: 'قبعة النجوم', ruleKey: 'cap:star', color: 0x2b2b6b }
  ],
  glasses: [
    { id: 'round', label: 'نظارة مستديرة', ruleKey: null, color: 0x334155 },
    { id: 'visor', label: 'نظارة البطل', ruleKey: 'glasses:visor', color: 0x00bcd4 }
  ],
  backpack: [
    { id: 'none', label: 'بدون حقيبة', ruleKey: null, color: 0x000000 },
    { id: 'books', label: 'حقيبة الكتب', ruleKey: 'backpack:books', color: 0x8e6bd6 }
  ],
  book: [
    { id: 'none', label: 'بدون كتاب', ruleKey: null, color: 0x000000 },
    { id: 'encyclopedia', label: 'موسوعة المعرفة', ruleKey: 'book:encyclopedia', color: 0x155eef }
  ],
  trail: [
    { id: 'none', label: 'بلا أثر', ruleKey: null, color: 0x000000 },
    { id: 'stars', label: 'أثر النجوم', ruleKey: 'trail:stars', color: 0xffd166 },
    { id: 'rainbow', label: 'قوس قزح', ruleKey: 'trail:rainbow', color: 0xff6f91 }
  ],
  jump: [
    { id: 'puff', label: 'سحابة خفيفة', ruleKey: null, color: 0xffffff },
    { id: 'petals', label: 'قفزة البتلات', ruleKey: 'jump:petals', color: 0xff8fb1 },
    { id: 'fireworks', label: 'قفزة الألعاب النارية', ruleKey: 'jump:fireworks', color: 0xff7043 }
  ]
};

export const COSMETIC_LABELS = {
  cap: 'القبعات',
  glasses: 'النظارات',
  backpack: 'الحقائب',
  book: 'الكتب',
  trail: 'الآثار',
  jump: 'تأثيرات القفز'
};
