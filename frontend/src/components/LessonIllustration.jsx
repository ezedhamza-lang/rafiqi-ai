const SCENES = [
  { code: 'coins', label: 'النقود', keys: ['نقود', 'عملة', 'مليم', 'دينار', 'قطع نقدية', 'ثمن', 'سعر'] },
  { code: 'clock', label: 'الوقت', keys: ['ساعة', 'وقت', 'دقيقة', 'زمن'] },
  { code: 'shapes', label: 'الأشكال', keys: ['شكل', 'أشكال', 'مربع', 'مثلث', 'دائرة', 'مستطيل', 'معين', 'هندس'] },
  { code: 'length', label: 'القياس والطول', keys: ['قياس', 'طول', 'سنتيمتر', 'متر', 'مسطرة', 'أطوال', 'طويل', 'قصير', 'أقصر', 'أطول'] },
  { code: 'weight', label: 'الوزن', keys: ['وزن', 'ميزان', 'كيلوغرام', 'غرام', 'أثقل', 'أخف', 'توازن'] },
  { code: 'calendar', label: 'الأيام والتقويم', keys: ['أيام', 'أسبوع', 'تقويم', 'شهور', 'شهر', 'تاريخ'] },
  { code: 'position', label: 'الموقع والمكان', keys: ['فوق', 'تحت', 'أمام', 'وراء', 'يمين', 'يسار', 'موقع', 'مكان', 'خارج', 'داخل'] },
  { code: 'fruits', label: 'الفواكه', keys: ['فواكه', 'تفاح', 'برتقال', 'موز', 'حبة', 'حبات', 'تفاحة', 'برتقالة'] },
  { code: 'animals', label: 'الحيوانات', keys: ['حيوان', 'حيوانات', 'قط', 'قطة', 'أرنب', 'كلب', 'طائر', 'ديك', 'أسد', 'فيل', 'سلحفاة', 'سمكة', 'بقرة'] },
  { code: 'plants', label: 'النبات', keys: ['نبات', 'زرع', 'شجرة', 'زهرة', 'ورقة', 'بذرة', 'حديقة', 'خضر'] },
  { code: 'water', label: 'الماء', keys: ['ماء', 'مطر', 'بحر', 'نهر', 'سائل', 'جليد', 'ثلج', 'بخار'] },
  { code: 'market', label: 'السوق', keys: ['سوق', 'شراء', 'بيع', 'خبز', 'متجر', 'بائع'] },
  { code: 'house', label: 'المنزل', keys: ['منزل', 'عائلة', 'بيت', 'أم', 'أب', 'أخ', 'أخت', 'غرفة', 'نظافة', 'أثاث'] },
  { code: 'school', label: 'المدرسة', keys: ['مدرسة', 'تلميذ', 'تلاميذ', 'فصل', 'معلم', 'حقيبة', 'مقعد'] },
  { code: 'reading', label: 'القراءة', keys: ['قراءة', 'حرف', 'كلمة', 'نص', 'قصة', 'قرأ'] },
  { code: 'numbers', label: 'الأعداد', keys: ['جمع', 'طرح', 'أعداد', 'عدد', 'عد', 'أرقام', 'رقم', 'ترتيب', 'مكم', 'تنقيص', 'مقارنة'] }
];

function normalize(text) {
  return (text || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

export function pickScene(lesson) {
  const haystack = normalize(
    [lesson.title, ...(lesson.blocks || []).map((b) => b.text || '').slice(0, 3)].join(' ')
  );
  for (const scene of SCENES) {
    if (scene.keys.some((k) => haystack.includes(normalize(k)))) return scene;
  }
  return SCENES[SCENES.length - 1];
}

const PALETTES = {
  pink: ['#ff8fab', '#ffc2d4'],
  blue: ['#6fb3ff', '#a9d4ff'],
  green: ['#4cbf7f', '#a5e8c3'],
  orange: ['#ffb24c', '#ffd79b'],
  purple: ['#9d6bdc', '#c9a8ef'],
  teal: ['#2bb3a6', '#8fe3da']
};

function Background({ palette, children }) {
  const [c1, c2] = PALETTES[palette];
  return (
    <svg viewBox="0 0 640 220" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${palette}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c2} stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id={`gr-${palette}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="640" height="220" rx="22" fill={`url(#bg-${palette})`} />
      <circle cx="60" cy="40" r="26" fill="#ffffff" opacity="0.5" />
      <circle cx="600" cy="180" r="34" fill="#ffffff" opacity="0.4" />
      <circle cx="330" cy="210" r="16" fill="#ffffff" opacity="0.35" />
      {children}
    </svg>
  );
}

function Sun({ x = 540, y = 34, r = 26 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#ffd54f" stroke="#f5a623" strokeWidth="3" />
      <g stroke="#ffd54f" strokeWidth="4" strokeLinecap="round">
        <line x1={x - r - 10} y1={y} x2={x - r - 22} y2={y} />
        <line x1={x + r + 10} y1={y} x2={x + r + 22} y2={y} />
        <line x1={x} y1={y - r - 10} x2={x} y2={y - r - 22} />
        <line x1={x} y1={y + r + 10} x2={x} y2={y + r + 22} />
        <line x1={x - 9} y1={y - 9} x2={x - 17} y2={y - 17} />
        <line x1={x + 9} y1={y - 9} x2={x + 17} y2={y - 17} />
        <line x1={x - 9} y1={y + 9} x2={x - 17} y2={y + 17} />
        <line x1={x + 9} y1={y + 9} x2={x + 17} y2={y + 17} />
      </g>
    </g>
  );
}

function Kid({ x, skin = '#ffd9b3', shirt = '#ff7f6e', pants = '#5b7bd5', book = false, armUp = false }) {
  const cx = x;
  const headY = 130;
  return (
    <g>
      <circle cx={cx} cy={headY} r="17" fill={skin} stroke="#e8a87c" strokeWidth="2" />
      <path d={`M${cx - 14} ${headY + 6} q14 -16 28 0 q-2 14 -28 12 Z`} fill="#7a4a21" />
      <circle cx={cx - 6} cy={headY - 2} r="2.2" fill="#4a3a2a" />
      <circle cx={cx + 6} cy={headY - 2} r="2.2" fill="#4a3a2a" />
      <path d={`M${cx - 4} ${headY + 7} q4 3 8 0`} stroke="#d9706a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x={cx - 13} y={headY + 15} width="26" height="30" rx="9" fill={shirt} stroke="#ffffff" strokeWidth="2" />
      {armUp ? (
        <g>
          <line x1={cx - 11} y1={headY + 22} x2={cx - 26} y2={headY + 6} stroke={shirt} strokeWidth="7" strokeLinecap="round" />
          <line x1={cx + 11} y1={headY + 22} x2={cx + 26} y2={headY + 6} stroke={shirt} strokeWidth="7" strokeLinecap="round" />
        </g>
      ) : book ? (
        <g>
          <rect x={cx + 10} y={headY + 18} width="26" height="19" rx="3" fill="#ffffff" stroke={pants} strokeWidth="2" transform={`rotate(-8 ${cx + 23} ${headY + 27})`} />
          <rect x={cx + 12} y={headY + 20} width="22" height="4" rx="2" fill="#ffd54f" transform={`rotate(-8 ${cx + 23} ${headY + 27})`} />
          <line x1={cx - 10} y1={headY + 25} x2={cx + 14} y2={headY + 18} stroke={shirt} strokeWidth="7" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <line x1={cx - 11} y1={headY + 22} x2={cx - 17} y2={headY + 40} stroke={shirt} strokeWidth="7" strokeLinecap="round" />
          <line x1={cx + 11} y1={headY + 22} x2={cx + 17} y2={headY + 40} stroke={shirt} strokeWidth="7" strokeLinecap="round" />
        </g>
      )}
      <rect x={cx - 9} y={headY + 43} width="18" height="22" rx="6" fill={pants} stroke="#ffffff" strokeWidth="2" />
      <circle cx={cx - 6} cy={headY + 66} r="4" fill="#5b4030" />
      <circle cx={cx + 6} cy={headY + 66} r="4" fill="#5b4030" />
    </g>
  );
}

function Coin({ x, y, r = 16, color = '#ffd54f' }) {
  return (
    <g>
      <circle cx={x + 2} cy={y + 3} r={r} fill="#c9a227" opacity="0.5" />
      <circle cx={x} cy={y} r={r} fill={color} stroke="#e8b93a" strokeWidth="3" />
      <circle cx={x} cy={y} r={r - 5} fill="none" stroke="#e8b93a" strokeWidth="2" strokeDasharray="3 3" />
    </g>
  );
}

function StarShape({ x, y, s = 14, color = '#ffb24c' }) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? s : s * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={color} stroke="#ffffff" strokeWidth="2" />;
}

const SCENE_ART = {
  numbers: (
    <g>
      <rect x="150" y="96" width="80" height="80" rx="14" fill="#6fb3ff" stroke="#ffffff" strokeWidth="4" />
      <text x="190" y="155" textAnchor="middle" fontSize="52" fontWeight="800" fill="#ffffff" fontFamily="Segoe UI, Arial">2</text>
      <rect x="246" y="76" width="80" height="80" rx="14" fill="#ff8fab" stroke="#ffffff" strokeWidth="4" />
      <text x="286" y="135" textAnchor="middle" fontSize="52" fontWeight="800" fill="#ffffff" fontFamily="Segoe UI, Arial">5</text>
      <rect x="342" y="96" width="80" height="80" rx="14" fill="#4cbf7f" stroke="#ffffff" strokeWidth="4" />
      <text x="382" y="155" textAnchor="middle" fontSize="52" fontWeight="800" fill="#ffffff" fontFamily="Segoe UI, Arial">7</text>
      <rect x="438" y="76" width="80" height="80" rx="14" fill="#ffb24c" stroke="#ffffff" strokeWidth="4" />
      <text x="478" y="135" textAnchor="middle" fontSize="52" fontWeight="800" fill="#ffffff" fontFamily="Segoe UI, Arial">9</text>
      <path d="M230 136 h16 M322 116 h16 M422 136 h16" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <text x="320" y="60" textAnchor="middle" fontSize="26" fontWeight="700" fill="#5b7bd5" fontFamily="Segoe UI, Arial">1 2 3 4 5 6 7 8 9</text>
    </g>
  ),
  coins: (
    <g>
      <Coin x={240} y={130} r={30} />
      <Coin x={300} y={100} r={34} />
      <Coin x={360} y={140} r={26} color="#e8e8e8" />
      <Coin x={410} y={104} r={22} color="#ffd54f" />
      <text x="320" y="52" textAnchor="middle" fontSize="30" fontWeight="800" fill="#c9a227" fontFamily="Segoe UI, Arial">د</text>
      <text x="255" y="78" fontSize="22" fontWeight="700" fill="#8a6d1a" fontFamily="Segoe UI, Arial">مليم</text>
      <StarShape x={150} y={70} s={18} />
      <StarShape x={520} y={80} s={16} />
      <StarShape x={560} y={150} s={13} />
    </g>
  ),
  clock: (
    <g>
      <circle cx="320" cy="118" r="62" fill="#ffffff" stroke="#6fb3ff" strokeWidth="9" />
      <circle cx="320" cy="118" r="4" fill="#5b7bd5" />
      <line x1="320" y1="118" x2="320" y2="78" stroke="#5b7bd5" strokeWidth="6" strokeLinecap="round" />
      <line x1="320" y1="118" x2="352" y2="130" stroke="#ff7f6e" strokeWidth="5" strokeLinecap="round" />
      <g fill="#9db4d8" fontSize="18" fontWeight="700" textAnchor="middle" fontFamily="Segoe UI, Arial">
        <text x="320" y="48">12</text><text x="382" y="122">3</text><text x="320" y="196">6</text><text x="258" y="122">9</text>
      </g>
      <text x="320" y="48" fontSize="24" fontWeight="800" fill="#5b7bd5" textAnchor="middle" fontFamily="Segoe UI, Arial">الساعة</text>
      <rect x="180" y="176" width="34" height="22" rx="6" fill="#ff8fab" stroke="#ffffff" strokeWidth="3" />
      <rect x="246" y="176" width="34" height="22" rx="6" fill="#ff8fab" stroke="#ffffff" strokeWidth="3" />
      <rect x="312" y="176" width="34" height="22" rx="6" fill="#ff8fab" stroke="#ffffff" strokeWidth="3" />
      <rect x="378" y="176" width="34" height="22" rx="6" fill="#ff8fab" stroke="#ffffff" strokeWidth="3" />
      <rect x="444" y="176" width="34" height="22" rx="6" fill="#ff8fab" stroke="#ffffff" strokeWidth="3" />
    </g>
  ),
  shapes: (
    <g>
      <rect x="150" y="110" width="86" height="86" rx="12" fill="#6fb3ff" stroke="#ffffff" strokeWidth="5" />
      <circle cx="310" cy="120" r="40" fill="#ff8fab" stroke="#ffffff" strokeWidth="5" />
      <polygon points="452,70 495,150 409,150" fill="#4cbf7f" stroke="#ffffff" strokeWidth="5" />
      <rect x="480" y="120" width="76" height="60" rx="8" fill="#ffb24c" stroke="#ffffff" strokeWidth="5" transform="rotate(12 518 150)" />
      <text x="192" y="152" fontSize="26" fontWeight="800" fill="#ffffff" textAnchor="middle" fontFamily="Segoe UI, Arial">مربع</text>
      <text x="310" y="124" fontSize="26" fontWeight="800" fill="#ffffff" textAnchor="middle" fontFamily="Segoe UI, Arial">دائرة</text>
      <text x="452" y="132" fontSize="26" fontWeight="800" fill="#ffffff" textAnchor="middle" fontFamily="Segoe UI, Arial">مثلث</text>
    </g>
  ),
  length: (
    <g>
      <rect x="130" y="150" width="400" height="34" rx="10" fill="#ffd54f" stroke="#e8b93a" strokeWidth="3" transform="rotate(-4 330 167)" />
      <g transform="rotate(-4 330 167)" fill="#8a6d1a" fontSize="16" fontWeight="700" fontFamily="Segoe UI, Arial">
        <line x1="140" y1="156" x2="140" y2="178" stroke="#8a6d1a" strokeWidth="2" /><text x="132" y="190">0</text>
        <line x1="190" y1="156" x2="190" y2="178" stroke="#8a6d1a" strokeWidth="2" /><text x="182" y="190">1</text>
        <line x1="240" y1="156" x2="240" y2="178" stroke="#8a6d1a" strokeWidth="2" /><text x="232" y="190">2</text>
        <line x1="290" y1="156" x2="290" y2="178" stroke="#8a6d1a" strokeWidth="2" /><text x="282" y="190">3</text>
        <line x1="340" y1="156" x2="340" y2="178" stroke="#8a6d1a" strokeWidth="2" /><text x="332" y="190">4</text>
        <line x1="390" y1="156" x2="390" y2="178" stroke="#8a6d1a" strokeWidth="2" /><text x="382" y="190">5</text>
        <line x1="440" y1="156" x2="440" y2="178" stroke="#8a6d1a" strokeWidth="2" /><text x="432" y="190">6</text>
        <line x1="490" y1="156" x2="490" y2="178" stroke="#8a6d1a" strokeWidth="2" /><text x="482" y="190">7</text>
      </g>
      <path d="M205 70 q14 -20 28 0" stroke="#ff7f6e" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M355 76 q14 -20 28 0" stroke="#4cbf7f" strokeWidth="5" fill="none" strokeLinecap="round" />
      <text x="320" y="44" fontSize="24" fontWeight="800" fill="#5b7bd5" textAnchor="middle" fontFamily="Segoe UI, Arial">المسطرة</text>
      <path d="M120 130 l22 8 M110 120 l22 8 M100 110 l22 8 M90 100 l22 8" stroke="#ff8fab" strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
  weight: (
    <g>
      <line x1="320" y1="60" x2="320" y2="150" stroke="#8a6d1a" strokeWidth="6" strokeLinecap="round" />
      <path d="M320 60 q-14 -22 14 -22 q28 0 14 22 Z" fill="#e8b93a" stroke="#c9a227" strokeWidth="3" />
      <line x1="240" y1="150" x2="400" y2="150" stroke="#8a6d1a" strokeWidth="6" strokeLinecap="round" />
      <path d="M240 150 l-46 26 l92 0 Z" fill="#ff8fab" stroke="#e06a9a" strokeWidth="3" />
      <path d="M400 150 l-46 26 l92 0 Z" fill="#6fb3ff" stroke="#3f7fd4" strokeWidth="3" />
      <circle cx="238" cy="180" r="14" fill="#ffd54f" stroke="#e8b93a" strokeWidth="3" />
      <circle cx="262" cy="180" r="14" fill="#ffd54f" stroke="#e8b93a" strokeWidth="3" />
      <rect x="370" y="156" width="44" height="44" rx="6" fill="#ff8fab" stroke="#e06a9a" strokeWidth="3" />
      <text x="318" y="52" fontSize="16" fontWeight="700" fill="#8a6d1a" textAnchor="middle" fontFamily="Segoe UI, Arial">كيلوغرام</text>
      <text x="238" y="204" fontSize="15" fontWeight="700" fill="#8a6d1a" textAnchor="middle" fontFamily="Segoe UI, Arial">1 كغ</text>
      <text x="392" y="190" fontSize="15" fontWeight="700" fill="#5b7bd5" textAnchor="middle" fontFamily="Segoe UI, Arial">؟</text>
    </g>
  ),
  calendar: (
    <g>
      <rect x="210" y="86" width="220" height="112" rx="14" fill="#ffffff" stroke="#ff8fab" strokeWidth="5" />
      <rect x="210" y="86" width="220" height="30" rx="14" fill="#ff8fab" stroke="#ff8fab" strokeWidth="5" />
      <text x="320" y="108" fontSize="19" fontWeight="800" fill="#ffffff" textAnchor="middle" fontFamily="Segoe UI, Arial">أيام الأسبوع</text>
      <g fill="#5b7bd5" fontSize="17" fontWeight="700" textAnchor="middle" fontFamily="Segoe UI, Arial">
        <rect x="222" y="126" width="26" height="26" rx="6" fill="#ffd54f" /><text x="235" y="145">1</text>
        <rect x="256" y="126" width="26" height="26" rx="6" fill="#ffd54f" /><text x="269" y="145">2</text>
        <rect x="290" y="126" width="26" height="26" rx="6" fill="#ffd54f" /><text x="303" y="145">3</text>
        <rect x="324" y="126" width="26" height="26" rx="6" fill="#ffd54f" /><text x="337" y="145">4</text>
        <rect x="358" y="126" width="26" height="26" rx="6" fill="#ffd54f" /><text x="371" y="145">5</text>
        <rect x="392" y="126" width="26" height="26" rx="6" fill="#ff8fab" /><text x="405" y="145">6</text>
        <rect x="222" y="160" width="26" height="26" rx="6" fill="#ff8fab" /><text x="235" y="179">7</text>
      </g>
      <circle cx="480" cy="120" r="20" fill="#4cbf7f" stroke="#ffffff" strokeWidth="4" />
      <text x="480" y="126" fontSize="18" fontWeight="800" fill="#ffffff" textAnchor="middle" fontFamily="Segoe UI, Arial">✓</text>
      <text x="330" y="70" fontSize="20" fontWeight="800" fill="#e06a9a" textAnchor="middle" fontFamily="Segoe UI, Arial">التقويم</text>
    </g>
  ),
  position: (
    <g>
      <rect x="210" y="70" width="220" height="120" rx="14" fill="#ffffff" stroke="#6fb3ff" strokeWidth="5" />
      <rect x="248" y="104" width="52" height="52" rx="10" fill="#ffd54f" stroke="#e8b93a" strokeWidth="4" />
      <text x="274" y="138" fontSize="22" fontWeight="800" fill="#c9a227" textAnchor="middle" fontFamily="Segoe UI, Arial">ص</text>
      <circle cx="350" cy="82" r="22" fill="#ff8fab" stroke="#e06a9a" strokeWidth="4" />
      <text x="330" y="66" fontSize="18" fontWeight="800" fill="#e06a9a" fontFamily="Segoe UI, Arial">فوق</text>
      <circle cx="180" cy="150" r="22" fill="#4cbf7f" stroke="#2e9e5b" strokeWidth="4" />
      <text x="170" y="180" fontSize="18" fontWeight="800" fill="#2e9e5b" fontFamily="Segoe UI, Arial">تحت</text>
      <circle cx="462" cy="96" r="22" fill="#9d6bdc" stroke="#7b3fa0" strokeWidth="4" />
      <text x="470" y="70" fontSize="18" fontWeight="800" fill="#7b3fa0" fontFamily="Segoe UI, Arial">يمين</text>
      <circle cx="180" cy="86" r="22" fill="#ffb24c" stroke="#e8911f" strokeWidth="4" />
      <text x="160" y="52" fontSize="18" fontWeight="800" fill="#e8911f" fontFamily="Segoe UI, Arial">يسار</text>
      <path d="M210 190 l60 12 l-60 12 Z M430 190 l60 12 l-60 12 Z" fill="#ff7f6e" />
    </g>
  ),
  fruits: (
    <g>
      <path d="M320 180 q-110 -12 -110 -70 q0 -58 110 -58 q110 0 110 58 q0 58 -110 70 Z" fill="#f7a83a" stroke="#e08c1a" strokeWidth="4" />
      <path d="M320 52 q-30 -24 -8 -34 q26 -8 40 6 q8 18 -4 32 Z" fill="#4cbf7f" stroke="#2e9e5b" strokeWidth="3" />
      <g>
        <circle cx="245" cy="118" r="24" fill="#ff5b5b" stroke="#d63f3f" strokeWidth="3" />
        <circle cx="270" cy="128" r="20" fill="#ff5b5b" stroke="#d63f3f" strokeWidth="3" />
        <circle cx="232" cy="136" r="18" fill="#ff5b5b" stroke="#d63f3f" strokeWidth="3" />
        <circle cx="264" cy="104" r="16" fill="#ff7f6e" stroke="#d63f3f" strokeWidth="3" />
      </g>
      <circle cx="392" cy="116" r="26" fill="#ffb24c" stroke="#e8911f" strokeWidth="3" />
      <circle cx="420" cy="128" r="22" fill="#ffb24c" stroke="#e8911f" strokeWidth="3" />
      <circle cx="445" cy="112" r="18" fill="#ffc878" stroke="#e8911f" strokeWidth="3" />
      <text x="320" y="210" fontSize="20" fontWeight="800" fill="#8a5a12" textAnchor="middle" fontFamily="Segoe UI, Arial">فواكه لذيذة</text>
    </g>
  ),
  animals: (
    <g>
      <g>
        <circle cx="200" cy="132" r="30" fill="#ffb24c" stroke="#e8911f" strokeWidth="4" />
        <path d="M170 130 q-4 -22 12 -26 q16 -4 18 14 Z" fill="#e8911f" />
        <path d="M228 128 q6 -22 -10 -28 q-16 -4 -20 14 Z" fill="#e8911f" />
        <circle cx="190" cy="126" r="3" fill="#4a3a2a" />
        <circle cx="212" cy="126" r="3" fill="#4a3a2a" />
        <path d="M196 138 q6 5 12 0" stroke="#8a5a12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="200" cy="168" rx="22" ry="16" fill="#ffb24c" stroke="#e8911f" strokeWidth="4" />
      </g>
      <g>
        <circle cx="320" cy="120" r="34" fill="#9db4d8" stroke="#6f87b5" strokeWidth="4" />
        <path d="M286 122 q-16 -18 -4 -30 q12 -10 22 2 Z" fill="#6f87b5" />
        <path d="M354 122 q16 -18 4 -30 q-12 -10 -22 2 Z" fill="#6f87b5" />
        <circle cx="308" cy="114" r="3.5" fill="#2f3e5c" />
        <circle cx="334" cy="114" r="3.5" fill="#2f3e5c" />
        <path d="M312 128 q8 6 16 0" stroke="#5b6e94" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="320" cy="160" rx="26" ry="18" fill="#9db4d8" stroke="#6f87b5" strokeWidth="4" />
        <ellipse cx="320" cy="196" rx="10" ry="12" fill="#ffffff" stroke="#6f87b5" strokeWidth="3" />
      </g>
      <g>
        <circle cx="450" cy="128" r="26" fill="#e8a87c" stroke="#c98a5f" strokeWidth="4" />
        <path d="M440 112 l-6 -14 l14 6 Z" fill="#c98a5f" />
        <path d="M462 112 l6 -14 l-14 6 Z" fill="#c98a5f" />
        <circle cx="442" cy="122" r="3" fill="#4a3a2a" />
        <circle cx="458" cy="122" r="3" fill="#4a3a2a" />
        <circle cx="450" cy="132" r="4" fill="#ff8fab" />
        <ellipse cx="450" cy="160" rx="20" ry="15" fill="#e8a87c" stroke="#c98a5f" strokeWidth="4" />
        <rect x="444" y="174" width="12" height="14" rx="4" fill="#c98a5f" />
      </g>
      <text x="320" y="52" fontSize="22" fontWeight="800" fill="#2e9e5b" textAnchor="middle" fontFamily="Segoe UI, Arial">الحيوانات</text>
    </g>
  ),
  plants: (
    <g>
      <rect x="150" y="150" width="120" height="40" rx="12" fill="#e8a87c" stroke="#c98a5f" strokeWidth="4" />
      <circle cx="180" cy="165" r="8" fill="#8a5a12" opacity="0.4" />
      <circle cx="245" cy="165" r="8" fill="#8a5a12" opacity="0.4" />
      <path d="M210 150 q-8 -40 0 -70 q8 30 0 70" stroke="#2e9e5b" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M210 120 q-34 -18 -48 -4 q30 12 48 4 M210 96 q-34 -18 -48 -4 q30 12 48 4" stroke="#4cbf7f" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M210 120 q34 -18 48 -4 q-30 12 -48 4 M210 96 q34 -18 48 -4 q-30 12 -48 4" stroke="#4cbf7f" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="210" cy="62" r="14" fill="#ff8fab" stroke="#e06a9a" strokeWidth="3" />
      <circle cx="210" cy="62" r="6" fill="#ffd54f" />
      <rect x="330" y="150" width="130" height="40" rx="12" fill="#e8a87c" stroke="#c98a5f" strokeWidth="4" />
      <path d="M395 150 q-10 -34 2 -60 q16 26 4 60" stroke="#2e9e5b" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M395 118 q-28 -14 -40 0 q24 10 40 0" stroke="#4cbf7f" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="420" cy="96" r="10" fill="#ffb24c" stroke="#e8911f" strokeWidth="3" />
      <text x="320" y="212" fontSize="20" fontWeight="800" fill="#2e9e5b" textAnchor="middle" fontFamily="Segoe UI, Arial">النباتات والأزهار</text>
    </g>
  ),
  water: (
    <g>
      <path d="M120 160 q200 -90 400 0 q-200 90 -400 0 Z" fill="#6fb3ff" stroke="#3f7fd4" strokeWidth="4" />
      <path d="M140 170 q200 -60 360 0" stroke="#a9d4ff" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M160 140 q40 18 80 0 q40 -18 80 0" stroke="#a9d4ff" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M340 96 q14 -20 28 0 q14 20 28 0" stroke="#4cbf7f" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M392 116 q14 -20 28 0 q14 20 28 0" stroke="#4cbf7f" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="200" cy="120" r="24" fill="#ffd54f" stroke="#e8b93a" strokeWidth="3" />
      <circle cx="460" cy="170" r="20" fill="#ff8fab" stroke="#e06a9a" strokeWidth="3" />
      <circle cx="520" cy="130" r="14" fill="#9d6bdc" stroke="#7b3fa0" strokeWidth="3" />
      <text x="320" y="52" fontSize="22" fontWeight="800" fill="#3f7fd4" textAnchor="middle" fontFamily="Segoe UI, Arial">الماء والحياة</text>
    </g>
  ),
  market: (
    <g>
      <rect x="150" y="120" width="140" height="70" rx="10" fill="#ffd54f" stroke="#e8b93a" strokeWidth="4" />
      <rect x="160" y="100" width="40" height="24" rx="4" fill="#ff8fab" stroke="#e06a9a" strokeWidth="3" />
      <rect x="240" y="100" width="40" height="24" rx="4" fill="#ff8fab" stroke="#e06a9a" strokeWidth="3" />
      <rect x="170" y="128" width="100" height="12" rx="4" fill="#e8b93a" />
      <circle cx="195" cy="150" r="9" fill="#ff5b5b" stroke="#d63f3f" strokeWidth="2" />
      <circle cx="220" cy="152" r="9" fill="#ff5b5b" stroke="#d63f3f" strokeWidth="2" />
      <circle cx="245" cy="150" r="9" fill="#ff5b5b" stroke="#d63f3f" strokeWidth="2" />
      <rect x="400" y="96" width="120" height="94" rx="10" fill="#ffffff" stroke="#4cbf7f" strokeWidth="4" />
      <rect x="410" y="106" width="48" height="48" rx="6" fill="#4cbf7f" />
      <rect x="465" y="106" width="44" height="48" rx="6" fill="#6fb3ff" />
      <rect x="410" y="158" width="100" height="18" rx="5" fill="#e8a87c" />
      <Coin x={530} y={160} r={15} />
      <Coin x={565} y={175} r={12} color="#e8e8e8" />
      <text x="320" y="60" fontSize="22" fontWeight="800" fill="#e8911f" textAnchor="middle" fontFamily="Segoe UI, Arial">في السوق</text>
      <text x="500" y="212" fontSize="16" fontWeight="700" fill="#2e9e5b" textAnchor="middle" fontFamily="Segoe UI, Arial">شراء</text>
    </g>
  ),
  house: (
    <g>
      <rect x="230" y="120" width="180" height="70" rx="6" fill="#ffd54f" stroke="#e8b93a" strokeWidth="4" />
      <polygon points="200,124 320,58 440,124" fill="#ff7f6e" stroke="#e05645" strokeWidth="4" />
      <rect x="300" y="148" width="40" height="42" rx="4" fill="#8a5a12" stroke="#6f4423" strokeWidth="3" />
      <rect x="248" y="134" width="26" height="26" rx="4" fill="#a9d4ff" stroke="#3f7fd4" strokeWidth="3" />
      <rect x="366" y="134" width="26" height="26" rx="4" fill="#a9d4ff" stroke="#3f7fd4" strokeWidth="3" />
      <circle cx="140" cy="120" r="20" fill="#ffb24c" stroke="#e8911f" strokeWidth="3" />
      <circle cx="142" cy="116" r="2.5" fill="#4a3a2a" />
      <circle cx="148" cy="124" r="2.5" fill="#4a3a2a" />
      <path d="M138 128 q6 5 12 0" stroke="#8a5a12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="500" cy="120" r="20" fill="#ff8fab" stroke="#e06a9a" strokeWidth="3" />
      <circle cx="496" cy="116" r="2.5" fill="#4a3a2a" />
      <circle cx="506" cy="116" r="2.5" fill="#4a3a2a" />
      <path d="M497 126 q6 5 12 0" stroke="#d9706a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <text x="320" y="52" fontSize="22" fontWeight="800" fill="#e05645" textAnchor="middle" fontFamily="Segoe UI, Arial">المنزل والعائلة</text>
      <Sun x={80} y={44} r={18} />
    </g>
  ),
  school: (
    <g>
      <rect x="210" y="110" width="220" height="80" rx="10" fill="#ffd54f" stroke="#e8b93a" strokeWidth="4" />
      <polygon points="190,112 320,52 450,112" fill="#6fb3ff" stroke="#3f7fd4" strokeWidth="4" />
      <rect x="290" y="140" width="60" height="50" rx="4" fill="#8a5a12" stroke="#6f4423" strokeWidth="3" />
      <rect x="228" y="122" width="28" height="28" rx="4" fill="#a9d4ff" stroke="#3f7fd4" strokeWidth="3" />
      <rect x="385" y="122" width="28" height="28" rx="4" fill="#a9d4ff" stroke="#3f7fd4" strokeWidth="3" />
      <Kid x={520} shirt="#ff8fab" pants="#5b7bd5" book />
      <Kid x={110} shirt="#ffb24c" pants="#4cbf7f" armUp />
      <text x="320" y="216" fontSize="20" fontWeight="800" fill="#3f7fd4" textAnchor="middle" fontFamily="Segoe UI, Arial">المدرسة</text>
    </g>
  ),
  reading: (
    <g>
      <Kid x={230} shirt="#ff8fab" pants="#5b7bd5" book />
      <Kid x={410} shirt="#6fb3ff" pants="#ffb24c" book />
      <rect x="296" y="120" width="70" height="52" rx="5" fill="#ffffff" stroke="#9d6bdc" strokeWidth="4" />
      <rect x="302" y="128" width="58" height="8" rx="4" fill="#9d6bdc" />
      <path d="M306 144 l12 8 l12 -10 M306 156 l12 8 l12 -10" stroke="#9d6bdc" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="320" y="48" fontSize="24" fontWeight="800" fill="#7b3fa0" textAnchor="middle" fontFamily="Segoe UI, Arial">نقرأ ونتعلم</text>
      <StarShape x={140} y={52} s={15} color="#ffd54f" />
      <StarShape x={500} y={60} s={14} color="#ff8fab" />
      <StarShape x={560} y={150} s={12} color="#4cbf7f" />
    </g>
  )
};

const LETTER_PALETTES = [
  { bg: '#fff4e0', ring: '#ffb24c', card: '#ffffff', accent: '#e8911f' },
  { bg: '#e8f4ff', ring: '#6fb3ff', card: '#ffffff', accent: '#3f7fd4' },
  { bg: '#eafff1', ring: '#4cbf7f', card: '#ffffff', accent: '#2e9e5b' },
  { bg: '#ffeef4', ring: '#ff8fab', card: '#ffffff', accent: '#e06a9a' },
  { bg: '#f3ecff', ring: '#9d6bdc', card: '#ffffff', accent: '#7b3fa0' }
];

function LetterScene({ letter, vocabEmojis }) {
  const bare = String(letter || '').replace(/^حرف\s*/, '');
  let h = 0;
  for (const c of bare) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pal = LETTER_PALETTES[h % LETTER_PALETTES.length];
  const cards = (vocabEmojis || []).slice(0, 3);
  return (
    <svg viewBox="0 0 640 220" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">
      <rect width="640" height="220" rx="22" fill={pal.bg} />
      <circle cx="70" cy="46" r="30" fill="#ffffff" opacity="0.65" />
      <circle cx="586" cy="176" r="38" fill="#ffffff" opacity="0.55" />
      <circle cx="330" cy="212" r="18" fill="#ffffff" opacity="0.45" />
      <text x="120" y="60" fontSize="26" opacity="0.35">✨</text>
      <text x="520" y="52" fontSize="24" opacity="0.35">⭐</text>
      <circle cx="150" cy="112" r="62" fill="#ffffff" stroke={pal.ring} strokeWidth="7" />
      <circle cx="150" cy="112" r="72" fill="none" stroke={pal.ring} strokeWidth="2.5" strokeDasharray="4 8" opacity="0.7" />
      <text x="150" y="140" textAnchor="middle" fontSize="76" fontWeight="800" fill={pal.accent} fontFamily="'Noto Naskh Arabic','Segoe UI',Arial">{bare}</text>
      {cards.map((c, i) => {
        const cx = 300 + i * 118;
        return (
          <g key={i}>
            <rect x={cx - 50} y={64 + (i % 2) * 14} width="100" height="104" rx="16" fill={pal.card} stroke={pal.ring} strokeWidth="3" />
            <text x={cx} y={124 + (i % 2) * 14} textAnchor="middle" fontSize="44">{c.emoji || '🔤'}</text>
            <text x={cx} y={152 + (i % 2) * 14} textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#33415c" fontFamily="'Noto Naskh Arabic','Segoe UI',Arial">
              {(String(c.word || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').length > 12 ? `${String(c.word).replace(/[\u064B-\u0652\u0670\u0640]/g, '').slice(0, 11)}…` : String(c.word || '').replace(/[\u064B-\u0652\u0670\u0640]/g, ''))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function LessonIllustration({ lesson, className = '' }) {
  if (lesson?.letter && lesson?.vocabEmojis?.length) {
    return (
      <div className={`lesson-page-illustration ${className}`}>
        <LetterScene letter={lesson.letter} vocabEmojis={lesson.vocabEmojis} />
        <span className="lesson-illustration-caption">
          <span className="material-icons" style={{ fontSize: 15 }}>auto_awesome</span>
          حرف {String(lesson.letter).replace(/^حرف\s*/, '')}
        </span>
      </div>
    );
  }
  const scene = pickScene(lesson);
  const art = SCENE_ART[scene.code] || SCENE_ART.numbers;
  const palette =
    scene.code === 'reading' || scene.code === 'school' ? 'purple'
      : scene.code === 'water' || scene.code === 'clock' || scene.code === 'position' || scene.code === 'length' ? 'blue'
        : scene.code === 'plants' || scene.code === 'fruits' || scene.code === 'weight' ? 'green'
          : scene.code === 'market' || scene.code === 'house' ? 'orange'
            : scene.code === 'calendar' || scene.code === 'animals' ? 'teal'
              : scene.code === 'shapes' || scene.code === 'numbers' || scene.code === 'coins' ? 'pink'
                : 'blue';
  return (
    <div className={`lesson-page-illustration ${className}`}>
      <Background palette={palette}>{art}</Background>
      <span className="lesson-illustration-caption">
        <span className="material-icons" style={{ fontSize: 15 }}>auto_awesome</span>
        {scene.label}
      </span>
    </div>
  );
}