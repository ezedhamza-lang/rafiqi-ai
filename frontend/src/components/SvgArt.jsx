// Original minimalist illustrations for Year 1 math (no copied artwork).
// Parametric primitives + small composed scenes. Usage: <SvgArt id="dice-4" />.
const INK = '#1a2a6c';

function Dice({ n }) {
  const pips = {
    1: [[60, 60]],
    2: [[38, 38], [82, 82]],
    3: [[38, 38], [60, 60], [82, 82]],
    4: [[38, 38], [82, 38], [38, 82], [82, 82]],
    5: [[38, 38], [82, 38], [60, 60], [38, 82], [82, 82]],
    6: [[38, 34], [82, 34], [38, 60], [82, 60], [38, 86], [82, 86]]
  }[n] || [];
  return (
    <g>
      <rect x="20" y="20" width="80" height="80" rx="16" fill="#fff" stroke={INK} strokeWidth="4" />
      {pips.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill={INK} />)}
    </g>
  );
}

function Fingers({ n }) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const raised = i < n;
        return (
          <g key={i}>
            <rect x={18 + i * 20} y={raised ? 18 : 48} width="14" height={raised ? 52 : 22} rx="7"
              fill={raised ? '#ffd9a0' : '#d7dee9'} stroke={INK} strokeWidth="3" />
          </g>
        );
      })}
      <rect x="14" y="66" width="92" height="34" rx="12" fill="#ffd9a0" stroke={INK} strokeWidth="3" />
    </g>
  );
}

function Coin({ v }) {
  return (
    <g>
      <circle cx="60" cy="60" r="38" fill="#f4c542" stroke="#9a7d0a" strokeWidth="4" />
      <circle cx="60" cy="60" r="29" fill="none" stroke="#9a7d0a" strokeWidth="2" strokeDasharray="5 4" />
      <text x="60" y="70" textAnchor="middle" fontSize="26" fontWeight="800" fill="#5c430a">{v}</text>
    </g>
  );
}

function Digit({ n }) {
  return (
    <g>
      <rect x="28" y="18" width="64" height="84" rx="12" fill="#eef3ff" stroke="#1e50b4" strokeWidth="4" />
      <text x="60" y="80" textAnchor="middle" fontSize="52" fontWeight="800" fill="#0d2a7a">{n}</text>
    </g>
  );
}

function Flower() {
  return (
    <g>
      <line x1="60" y1="60" x2="60" y2="108" stroke="#2e7d32" strokeWidth="6" strokeLinecap="round" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={60 + 22 * Math.cos((a * Math.PI) / 180)} cy={42 + 22 * Math.sin((a * Math.PI) / 180)}
          rx="13" ry="13" fill="#ef6aa5" stroke="#b83a72" strokeWidth="3" />
      ))}
      <circle cx="60" cy="42" r="11" fill="#ffd93b" stroke="#9a7d0a" strokeWidth="3" />
    </g>
  );
}

function Ball() {
  return (
    <g>
      <circle cx="60" cy="60" r="34" fill="#fff" stroke={INK} strokeWidth="4" />
      <path d="M32 52 Q60 66 88 52" fill="none" stroke={INK} strokeWidth="3" />
      <path d="M40 78 Q60 68 80 78" fill="none" stroke={INK} strokeWidth="3" />
    </g>
  );
}

function Apple() {
  return (
    <g>
      <circle cx="60" cy="68" r="28" fill="#e5484d" stroke="#8f1d22" strokeWidth="3" />
      <line x1="60" y1="40" x2="64" y2="26" stroke="#5c430a" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="74" cy="34" rx="12" ry="7" fill="#3fa34d" transform="rotate(-20 74 34)" />
    </g>
  );
}

function Star() {
  return <polygon points="60,18 72,48 104,48 78,66 88,98 60,78 32,98 42,66 16,48 48,48"
    fill="#ffd93b" stroke="#9a7d0a" strokeWidth="3" strokeLinejoin="round" />;
}

function Tree() {
  return (
    <g>
      <rect x="54" y="72" width="12" height="36" fill="#8a5a2b" />
      <circle cx="60" cy="46" r="28" fill="#3fa34d" stroke="#1e6b2e" strokeWidth="3" />
      <circle cx="40" cy="58" r="16" fill="#3fa34d" stroke="#1e6b2e" strokeWidth="3" />
      <circle cx="80" cy="58" r="16" fill="#3fa34d" stroke="#1e6b2e" strokeWidth="3" />
    </g>
  );
}

function Triangle({ color = '#2e9e5b' }) {
  return <polygon points="60,22 100,96 20,96" fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
}

function TriangleDown({ color = '#4a90e2' }) {
  return <polygon points="60,98 100,24 20,24" fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
}

function Dots({ n }) {
  const count = Math.max(1, Math.min(Number(n) || 1, 16));
  const cols = 4;
  const cells = [];
  for (let i = 0; i < count; i += 1) {
    const cx = 24 + (i % cols) * 24;
    const cy = 30 + Math.floor(i / cols) * 24;
    cells.push(<circle key={i} cx={cx} cy={cy} r="9" fill="#e5484d" stroke={INK} strokeWidth="2.5" />);
  }
  return <g>{cells}</g>;
}

function BallAbove() {
  return (
    <g>
      <line x1="14" y1="66" x2="106" y2="66" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="38" r="16" fill="#e5484d" stroke={INK} strokeWidth="3" />
    </g>
  );
}

function BallBelow() {
  return (
    <g>
      <line x1="14" y1="54" x2="106" y2="54" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="82" r="16" fill="#e5484d" stroke={INK} strokeWidth="3" />
    </g>
  );
}

function Square({ color = '#4a90e2' }) {
  return <rect x="28" y="28" width="64" height="64" rx="8" fill={color} stroke={INK} strokeWidth="3" />;
}

function CircleShape({ color = '#e5484d' }) {
  return <circle cx="60" cy="60" r="36" fill={color} stroke={INK} strokeWidth="3" />;
}

function Ruler() {
  return (
    <g>
      <rect x="10" y="44" width="100" height="32" rx="4" fill="#ffe9a8" stroke={INK} strokeWidth="3" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <line x1={10 + i * 20} y1="44" x2={10 + i * 20} y2="56" stroke={INK} strokeWidth="2" />
          <text x={10 + i * 20} y="70" textAnchor="middle" fontSize="10" fill={INK}>{i}</text>
        </g>
      ))}
    </g>
  );
}

function Hand({ side }) {
  const flip = side === 'left' ? -1 : 1;
  return (
    <g transform={`translate(60,0) scale(${flip},1) translate(-60,0)`}>
      <rect x="38" y="50" width="44" height="52" rx="14" fill="#ffd9a0" stroke={INK} strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={40 + i * 11} y={18} width="9" height="36" rx="4.5" fill="#ffd9a0" stroke={INK} strokeWidth="2.5" />
      ))}
      <rect x="76" y="58" width="9" height="28" rx="4.5" fill="#ffd9a0" stroke={INK} strokeWidth="2.5" transform="rotate(25 80 60)" />
    </g>
  );
}

function Kid({ pose }) {
  const back = pose === 'back';
  return (
    <g>
      {/* head */}
      <circle cx="60" cy="30" r="14" fill="#ffd9a0" stroke={INK} strokeWidth="3" />
      {back ? (
        /* back of head: full hair covering, NO face, backpack visible */
        <g>
          <path d="M46 26 Q46 8 60 8 Q74 8 74 26 L74 36 Q67 28 60 28 Q53 28 46 36 Z" fill="#5c3a1e" stroke={INK} strokeWidth="2" />
          <path d="M46 30 Q60 46 74 30" fill="none" stroke={INK} strokeWidth="2.5" />
          {/* backpack straps */}
          <rect x="50" y="44" width="4" height="20" rx="2" fill="#e5484d" />
          <rect x="66" y="44" width="4" height="20" rx="2" fill="#e5484d" />
        </g>
      ) : (
        /* front: face with eyes + smile, hair on top only */
        <g>
          <path d="M46 28 Q60 10 74 28" fill="#5c3a1e" stroke={INK} strokeWidth="2" />
          <circle cx="54" cy="30" r="3" fill={INK} />
          <circle cx="66" cy="30" r="3" fill={INK} />
          <circle cx="54" cy="29" r="1" fill="#fff" />
          <circle cx="66" cy="29" r="1" fill="#fff" />
          <path d="M53 38 Q60 44 67 38" fill="none" stroke="#e5484d" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      <rect x="46" y="46" width="28" height="34" rx="8" fill={back ? '#9db8e8' : '#e5484d'} stroke={INK} strokeWidth="3" />
      <line x1="50" y1="80" x2="50" y2="104" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <line x1="70" y1="80" x2="70" y2="104" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      {/* shoes */}
      <ellipse cx="50" cy="107" rx="6" ry="4" fill={back ? '#333' : '#5c3a1e'} />
      <ellipse cx="70" cy="107" rx="6" ry="4" fill={back ? '#333' : '#5c3a1e'} />
    </g>
  );
}

function Venn({ n }) {
  return (
    <g>
      <ellipse cx="60" cy="60" rx="42" ry="36" fill="rgba(74,144,226,.15)" stroke="#1e50b4" strokeWidth="4" />
      {Array.from({ length: n }).map((_, i) => (
        <circle key={i} cx={38 + (i % 3) * 22} cy={48 + Math.floor(i / 3) * 22} r="8"
          fill={i % 2 ? '#e5484d' : '#3fa34d'} stroke={INK} strokeWidth="2" />
      ))}
    </g>
  );
}

function GridBoard() {
  return (
    <g>
      <rect x="14" y="14" width="92" height="92" fill="#fff" stroke={INK} strokeWidth="3" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <line x1={14 + ((i + 1) * 92) / 3} y1="14" x2={14 + ((i + 1) * 92) / 3} y2="106" stroke="#9db8e8" strokeWidth="2" />
          <line x1="14" y1={14 + ((i + 1) * 92) / 3} x2="106" y2={14 + ((i + 1) * 92) / 3} stroke="#9db8e8" strokeWidth="2" />
        </g>
      ))}
    </g>
  );
}

function Cat() {
  return (
    <g>
      <ellipse cx="60" cy="72" rx="24" ry="20" fill="#cfd6e4" stroke={INK} strokeWidth="3" />
      <circle cx="60" cy="42" r="16" fill="#cfd6e4" stroke={INK} strokeWidth="3" />
      <polygon points="48,32 44,16 56,26" fill="#cfd6e4" stroke={INK} strokeWidth="3" />
      <polygon points="72,32 76,16 64,26" fill="#cfd6e4" stroke={INK} strokeWidth="3" />
      <circle cx="54" cy="40" r="2.5" fill={INK} />
      <circle cx="66" cy="40" r="2.5" fill={INK} />
      <path d="M52 84 Q60 92 68 84" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Fish() {
  return (
    <g>
      <ellipse cx="52" cy="60" rx="26" ry="16" fill="#f4a63b" stroke={INK} strokeWidth="3" />
      <polygon points="78,60 98,44 98,76" fill="#f4a63b" stroke={INK} strokeWidth="3" />
      <circle cx="42" cy="56" r="3" fill={INK} />
      <path d="M52 76 L46 88 M62 76 L68 88" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Rabbit() {
  return (
    <g>
      <ellipse cx="52" cy="28" rx="7" ry="18" fill="#fff" stroke={INK} strokeWidth="3" />
      <ellipse cx="68" cy="28" rx="7" ry="18" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle cx="60" cy="62" r="24" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle cx="52" cy="58" r="2.5" fill={INK} />
      <circle cx="68" cy="58" r="2.5" fill={INK} />
      <ellipse cx="60" cy="84" rx="10" ry="7" fill="#fff" stroke={INK} strokeWidth="3" />
    </g>
  );
}

function BoxBall({ inside }) {
  return (
    <g>
      <rect x="22" y="52" width="76" height="52" rx="8" fill="none" stroke="#1e50b4" strokeWidth="4" />
      <circle cx="60" cy={inside ? '78' : '28'} r="14" fill="#e5484d" stroke={INK} strokeWidth="3" />
    </g>
  );
}

function PenOnTable() {
  return (
    <g>
      <rect x="10" y="60" width="100" height="40" rx="4" fill="#ffe9a8" stroke={INK} strokeWidth="3" />
      <rect x="30" y="50" width="60" height="12" rx="3" fill="#fff" stroke={INK} strokeWidth="2" />
      {/* pen */}
      <rect x="40" y="48" width="40" height="6" rx="3" fill="#1e50b4" stroke={INK} strokeWidth="2" transform="rotate(-10 60 51)" />
      <polygon points="80,48 88,51 80,54" fill="#f4c542" transform="rotate(-10 84 51)" />
    </g>
  );
}

function AppleJoin({ left, right }) {
  return (
    <g>
      {Array.from({ length: left }).map((_, i) => (
        <g key={`l${i}`} transform={`translate(${-30 + i * 22}, 18) scale(.85)`}>
          <circle cx="60" cy="68" r="28" fill="#e5484d" stroke="#8f1d22" strokeWidth="3" />
          <line x1="60" y1="40" x2="64" y2="26" stroke="#5c430a" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="74" cy="34" rx="12" ry="7" fill="#3fa34d" transform="rotate(-20 74 34)" />
        </g>
      ))}
      {/* plus sign */}
      <text x="60" y="60" textAnchor="middle" fontSize="22" fontWeight="800" fill={INK}>+</text>
      {Array.from({ length: right }).map((_, i) => (
        <g key={`r${i}`} transform={`translate(${10 + i * 22}, 18) scale(.85)`}>
          <circle cx="60" cy="68" r="28" fill="#e5484d" stroke="#8f1d22" strokeWidth="3" />
          <line x1="60" y1="40" x2="64" y2="26" stroke="#5c430a" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="74" cy="34" rx="12" ry="7" fill="#3fa34d" transform="rotate(-20 74 34)" />
        </g>
      ))}
    </g>
  );
}

function AppleCompare({ left, right }) {
  return (
    <g>
      {Array.from({ length: left }).map((_, i) => (
        <g key={`l${i}`} transform={`translate(${-14 + (i % 3) * 18}, ${14 + Math.floor(i / 3) * 18}) scale(.55)`}>
          <circle cx="60" cy="68" r="28" fill="#e5484d" stroke="#8f1d22" strokeWidth="3" />
          <line x1="60" y1="40" x2="64" y2="26" stroke="#5c430a" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="74" cy="34" rx="12" ry="7" fill="#3fa34d" transform="rotate(-20 74 34)" />
        </g>
      ))}
      <text x="60" y="68" textAnchor="middle" fontSize="16" fontWeight="800" fill={INK}>?</text>
      {Array.from({ length: right }).map((_, i) => (
        <g key={`r${i}`} transform={`translate(${18 + (i % 3) * 18}, ${14 + Math.floor(i / 3) * 18}) scale(.55)`}>
          <circle cx="60" cy="68" r="28" fill="#e5484d" stroke="#8f1d22" strokeWidth="3" />
          <line x1="60" y1="40" x2="64" y2="26" stroke="#5c430a" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="74" cy="34" rx="12" ry="7" fill="#3fa34d" transform="rotate(-20 74 34)" />
        </g>
      ))}
    </g>
  );
}

function SplitDots({ n, groups }) {
  const cols = 5;
  const cells = [];
  for (let i = 0; i < n; i += 1) {
    const cx = 18 + (i % cols) * 20;
    const cy = 28 + Math.floor(i / cols) * 20;
    cells.push(<circle key={i} cx={cx} cy={cy} r="8" fill={i < groups[0] ? '#e5484d' : '#4a90e2'} stroke={INK} strokeWidth="2" />);
  }
  return (
    <g>
      {cells}
      <line x1="18" y1={28 + Math.ceil(n / cols) * 20 + 4} x2="98" y2={28 + Math.ceil(n / cols) * 20 + 4} stroke={INK} strokeWidth="2" strokeDasharray="4 3" />
    </g>
  );
}

function ColumnAdd({ top, bottom, sum }) {
  return (
    <g>
      <rect x="18" y="10" width="84" height="100" rx="6" fill="#fff" stroke={INK} strokeWidth="3" />
      <text x="70" y="40" textAnchor="end" fontSize="24" fontWeight="800" fill="#1a2a6c">{top}</text>
      <text x="70" y="68" textAnchor="end" fontSize="24" fontWeight="800" fill="#1a2a6c">+{bottom}</text>
      <line x1="24" y1="78" x2="96" y2="78" stroke={INK} strokeWidth="3" />
      <text x="70" y="102" textAnchor="end" fontSize="24" fontWeight="800" fill="#e5484d">{sum}</text>
      <text x="30" y="40" fontSize="16" fill={INK}>+</text>
    </g>
  );
}

// ── Assessment passage scenes ──

function AssessDesk() {
  return (
    <g>
      {/* wall */}
      <rect x="0" y="0" width="120" height="120" rx="8" fill="#e8f5e9" />
      {/* desk top */}
      <rect x="15" y="45" width="90" height="8" rx="3" fill="#c8956c" stroke="#8a5a2b" strokeWidth="2" />
      {/* desk legs */}
      <rect x="20" y="53" width="6" height="38" fill="#8a5a2b" />
      <rect x="94" y="53" width="6" height="38" fill="#8a5a2b" />
      {/* pen on desk */}
      <line x1="40" y1="42" x2="70" y2="38" stroke="#1565c0" strokeWidth="3" strokeLinecap="round" />
      <polygon points="70,38 74,36 70,40" fill="#1565c0" />
      {/* eraser on desk */}
      <rect x="78" y="39" width="12" height="6" rx="2" fill="#1565c0" stroke="#0d47a1" strokeWidth="1" />
      <rect x="78" y="39" width="4" height="6" rx="1" fill="#fff" />
      {/* trash bin under desk */}
      <ellipse cx="65" cy="95" rx="14" ry="4" fill="#5c8ab5" />
      <path d="M51 78 L51 95 Q51 99 65 99 Q79 99 79 95 L79 78 Z" fill="#6fa8d6" stroke="#3d7ab5" strokeWidth="1.5" />
      <line x1="54" y1="78" x2="54" y2="95" stroke="#3d7ab5" strokeWidth="0.8" />
      <line x1="58" y1="78" x2="58" y2="97" stroke="#3d7ab5" strokeWidth="0.8" />
      <line x1="62" y1="78" x2="62" y2="98" stroke="#3d7ab5" strokeWidth="0.8" />
      <line x1="66" y1="78" x2="66" y2="98" stroke="#3d7ab5" strokeWidth="0.8" />
      <line x1="70" y1="78" x2="70" y2="97" stroke="#3d7ab5" strokeWidth="0.8" />
      <line x1="74" y1="78" x2="74" y2="95" stroke="#3d7ab5" strokeWidth="0.8" />
      {/* paper balls in bin */}
      <circle cx="60" cy="90" r="3" fill="#fff9c4" stroke="#ccc" strokeWidth="0.5" />
      <circle cx="66" cy="88" r="2.5" fill="#fff" stroke="#ccc" strokeWidth="0.5" />
      <circle cx="63" cy="93" r="2" fill="#e8f5e9" stroke="#ccc" strokeWidth="0.5" />
    </g>
  );
}

function AssessBirds() {
  return (
    <g>
      {/* sky */}
      <rect x="0" y="0" width="120" height="120" rx="8" fill="#e3f2fd" />
      {/* sun */}
      <circle cx="100" cy="18" r="12" fill="#ffd54f" />
      {/* tree trunk */}
      <rect x="55" y="50" width="10" height="60" rx="3" fill="#8d6e4c" />
      {/* branches */}
      <path d="M60 55 Q40 45 25 50" fill="none" stroke="#8d6e4c" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 55 Q80 45 95 50" fill="none" stroke="#8d6e4c" strokeWidth="4" strokeLinecap="round" />
      {/* leaves */}
      <circle cx="25" cy="42" r="16" fill="#66bb6a" />
      <circle cx="95" cy="42" r="16" fill="#66bb6a" />
      <circle cx="60" cy="32" r="18" fill="#81c784" />
      <circle cx="40" cy="38" r="12" fill="#4caf50" />
      <circle cx="80" cy="38" r="12" fill="#4caf50" />
      {/* bird 1 - blue */}
      <ellipse cx="30" cy="48" rx="7" ry="5" fill="#42a5f5" />
      <circle cx="24" cy="46" r="3" fill="#42a5f5" />
      <circle cx="22" cy="45" r="1" fill="#fff" />
      <circle cx="22" cy="45" r="0.5" fill="#222" />
      <polygon points="20,46 17,45 20,47" fill="#ff8f00" />
      {/* bird 2 - yellow */}
      <ellipse cx="55" cy="44" rx="7" ry="5" fill="#ffd54f" />
      <circle cx="49" cy="42" r="3" fill="#ffd54f" />
      <circle cx="47" cy="41" r="1" fill="#fff" />
      <circle cx="47" cy="41" r="0.5" fill="#222" />
      <polygon points="45,42 42,41 45,43" fill="#ff8f00" />
      {/* bird 3 - orange */}
      <ellipse cx="85" cy="48" rx="7" ry="5" fill="#ff8a65" />
      <circle cx="79" cy="46" r="3" fill="#ff8a65" />
      <circle cx="77" cy="45" r="1" fill="#fff" />
      <circle cx="77" cy="45" r="0.5" fill="#222" />
      <polygon points="75,46 72,45 75,47" fill="#ff8f00" />
      {/* empty nest 1 */}
      <ellipse cx="42" cy="58" rx="10" ry="4" fill="#8d6e4c" />
      <path d="M32 58 Q42 50 52 58" fill="none" stroke="#6d4c2c" strokeWidth="2" />
      {/* empty nest 2 */}
      <ellipse cx="72" cy="60" rx="10" ry="4" fill="#8d6e4c" />
      <path d="M62 60 Q72 52 82 60" fill="none" stroke="#6d4c2c" strokeWidth="2" />
      {/* ground */}
      <rect x="0" y="108" width="120" height="12" rx="0" fill="#a5d6a7" />
      {/* school */}
      <rect x="8" y="85" width="20" height="18" rx="2" fill="#fff9c4" stroke="#ccc" strokeWidth="1" />
      <rect x="14" y="92" width="6" height="11" rx="1" fill="#8d6e4c" />
      <rect x="11" y="88" width="4" height="4" rx="0.5" fill="#90caf9" stroke="#64b5f6" strokeWidth="0.5" />
      <rect x="19" y="88" width="4" height="4" rx="0.5" fill="#90caf9" stroke="#64b5f6" strokeWidth="0.5" />
      <text x="18" y="84" textAnchor="middle" fontSize="5" fill="#333" fontWeight="bold">مدرسة</text>
    </g>
  );
}

function AssessBox() {
  return (
    <g>
      {/* table surface */}
      <rect x="0" y="80" width="120" height="40" rx="0" fill="#d7b899" />
      <rect x="0" y="80" width="120" height="4" fill="#c8a882" />
      {/* box body */}
      <rect x="25" y="35" width="70" height="50" rx="4" fill="#8bc34a" stroke="#558b2f" strokeWidth="2.5" />
      {/* box lid (open) */}
      <path d="M25 35 L25 28 Q60 18 95 28 L95 35" fill="#9ccc65" stroke="#558b2f" strokeWidth="2" />
      {/* box inner shadow */}
      <rect x="28" y="38" width="64" height="44" rx="2" fill="#a5d64c" opacity="0.3" />
      {/* red balls */}
      <circle cx="42" cy="56" r="9" fill="#e53935" stroke="#c62828" strokeWidth="1.5" />
      <ellipse cx="39" cy="52" rx="3" ry="2" fill="#ef5350" opacity="0.6" />
      <circle cx="58" cy="60" r="9" fill="#e53935" stroke="#c62828" strokeWidth="1.5" />
      <ellipse cx="55" cy="56" rx="3" ry="2" fill="#ef5350" opacity="0.6" />
      <circle cx="72" cy="56" r="9" fill="#e53935" stroke="#c62828" strokeWidth="1.5" />
      <ellipse cx="69" cy="52" rx="3" ry="2" fill="#ef5350" opacity="0.6" />
      <circle cx="50" cy="46" r="9" fill="#e53935" stroke="#c62828" strokeWidth="1.5" />
      <ellipse cx="47" cy="42" rx="3" ry="2" fill="#ef5350" opacity="0.6" />
      {/* green ball */}
      <circle cx="76" cy="68" r="9" fill="#43a047" stroke="#2e7d32" strokeWidth="1.5" />
      <ellipse cx="73" cy="64" rx="3" ry="2" fill="#66bb6a" opacity="0.6" />
      {/* label */}
      <rect x="38" y="76" width="44" height="12" rx="3" fill="#fff" stroke="#999" strokeWidth="1" />
      <text x="60" y="85" textAnchor="middle" fontSize="8" fill="#333" fontWeight="bold" fontFamily="Arial">علبة أمين</text>
    </g>
  );
}

function AssessButtons() {
  return (
    <g>
      {/* background */}
      <rect x="0" y="0" width="120" height="120" rx="8" fill="#e8f5e9" />
      {/* desk */}
      <rect x="0" y="65" width="120" height="55" rx="0" fill="#d7b899" />
      <rect x="0" y="65" width="120" height="4" fill="#c8a882" />
      {/* boy body */}
      <circle cx="60" cy="35" r="14" fill="#ffd9a0" stroke={INK} strokeWidth="2" />
      <path d="M48 30 Q60 20 72 30" fill="#5c3a1e" />
      <rect x="48" y="48" width="24" height="22" rx="5" fill="#4caf50" />
      {/* bag of blue buttons */}
      <path d="M15 50 Q15 30 35 30 Q55 30 55 50 L55 75 Q35 80 15 75 Z" fill="rgba(200,220,255,0.6)" stroke="#90caf9" strokeWidth="1.5" />
      {/* blue buttons in bag */}
      <circle cx="24" cy="44" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="36" cy="42" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="46" cy="46" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="28" cy="55" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="40" cy="53" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="20" cy="65" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="32" cy="63" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="44" cy="62" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="26" cy="74" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      <circle cx="38" cy="72" r="5" fill="#1e88e5" stroke="#1565c0" strokeWidth="1" />
      {/* button holes */}
      {[24,36,46,28,40,20,32,44,26,38].map((cx, i) => {
        const cy = [44,42,46,55,53,65,63,62,74,72][i];
        return <g key={i}><circle cx={cx-1.5} cy={cy-1} r="0.8" fill="#0d47a1" /><circle cx={cx+1.5} cy={cy-1} r="0.8" fill="#0d47a1" /><circle cx={cx-1.5} cy={cy+1.5} r="0.8" fill="#0d47a1" /><circle cx={cx+1.5} cy={cy+1.5} r="0.8" fill="#0d47a1" /></g>;
      })}
      {/* 3 red buttons separate */}
      <circle cx="72" cy="70" r="7" fill="#e53935" stroke="#c62828" strokeWidth="1.5" />
      <circle cx="70.5" cy="68.5" r="0.8" fill="#b71c1c" /><circle cx="73.5" cy="68.5" r="0.8" fill="#b71c1c" /><circle cx="70.5" cy="71.5" r="0.8" fill="#b71c1c" /><circle cx="73.5" cy="71.5" r="0.8" fill="#b71c1c" />
      <circle cx="88" cy="68" r="7" fill="#e53935" stroke="#c62828" strokeWidth="1.5" />
      <circle cx="86.5" cy="66.5" r="0.8" fill="#b71c1c" /><circle cx="89.5" cy="66.5" r="0.8" fill="#b71c1c" /><circle cx="86.5" cy="69.5" r="0.8" fill="#b71c1c" /><circle cx="89.5" cy="69.5" r="0.8" fill="#b71c1c" />
      <circle cx="80" cy="80" r="7" fill="#e53935" stroke="#c62828" strokeWidth="1.5" />
      <circle cx="78.5" cy="78.5" r="0.8" fill="#b71c1c" /><circle cx="81.5" cy="78.5" r="0.8" fill="#b71c1c" /><circle cx="78.5" cy="81.5" r="0.8" fill="#b71c1c" /><circle cx="81.5" cy="81.5" r="0.8" fill="#b71c1c" />
      {/* labels */}
      <text x="35" y="92" textAnchor="middle" fontSize="7" fill="#1565c0" fontWeight="bold">10 أزرار زرقاء</text>
      <text x="80" y="95" textAnchor="middle" fontSize="7" fill="#c62828" fontWeight="bold">3 أزرار حمراء</text>
    </g>
  );
}

function AssessScores() {
  return (
    <g>
      {/* background */}
      <rect x="0" y="0" width="120" height="120" rx="8" fill="#e3f2fd" />
      {/* Hamdi card */}
      <rect x="4" y="8" width="52" height="104" rx="6" fill="#fff" stroke="#999" strokeWidth="1.5" />
      <rect x="8" y="12" width="44" height="18" rx="4" fill="#a5d6a7" />
      <text x="30" y="25" textAnchor="middle" fontSize="11" fill="#2e7d32" fontWeight="bold">حمدي</text>
      {/* Hamdi scores */}
      <rect x="8" y="34" width="22" height="10" rx="2" fill="#90caf9" />
      <text x="19" y="42" textAnchor="middle" fontSize="6" fill="#1565c0">الشوط الأول</text>
      <text x="19" y="58" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1a237e">43</text>
      <text x="19" y="66" textAnchor="middle" fontSize="5" fill="#666">نقطة</text>
      <rect x="32" y="34" width="22" height="10" rx="2" fill="#c8e6c9" />
      <text x="43" y="42" textAnchor="middle" fontSize="6" fill="#2e7d32">الشوط الثاني</text>
      <text x="43" y="58" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1a237e">54</text>
      <text x="43" y="66" textAnchor="middle" fontSize="5" fill="#666">نقطة</text>
      {/* Hamdi total */}
      <rect x="8" y="72" width="44" height="16" rx="3" fill="#e8f5e9" stroke="#66bb6a" strokeWidth="1" />
      <text x="30" y="83" textAnchor="middle" fontSize="9" fill="#2e7d32" fontWeight="bold">المجموع: 97</text>
      {/* Aziz card */}
      <rect x="64" y="8" width="52" height="104" rx="6" fill="#fff" stroke="#999" strokeWidth="1.5" />
      <rect x="68" y="12" width="44" height="18" rx="4" fill="#90caf9" />
      <text x="90" y="25" textAnchor="middle" fontSize="11" fill="#1565c0" fontWeight="bold">عزيز</text>
      {/* Aziz scores */}
      <rect x="68" y="34" width="22" height="10" rx="2" fill="#90caf9" />
      <text x="79" y="42" textAnchor="middle" fontSize="6" fill="#1565c0">الشوط الأول</text>
      <text x="79" y="58" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1a237e">50</text>
      <text x="79" y="66" textAnchor="middle" fontSize="5" fill="#666">نقطة</text>
      <rect x="92" y="34" width="22" height="10" rx="2" fill="#c8e6c9" />
      <text x="103" y="42" textAnchor="middle" fontSize="6" fill="#2e7d32">الشوط الثاني</text>
      <text x="103" y="58" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1a237e">38</text>
      <text x="103" y="66" textAnchor="middle" fontSize="5" fill="#666">نقطة</text>
      {/* Aziz total */}
      <rect x="68" y="72" width="44" height="16" rx="3" fill="#e3f2fd" stroke="#64b5f6" strokeWidth="1" />
      <text x="90" y="83" textAnchor="middle" fontSize="9" fill="#1565c0" fontWeight="bold">المجموع: 88</text>
    </g>
  );
}

function AssessFarm() {
  return (
    <g>
      {/* sky */}
      <rect x="0" y="0" width="120" height="55" rx="8" fill="#e3f2fd" />
      <rect x="0" y="40" width="120" height="15" rx="0" fill="#e3f2fd" />
      {/* sun */}
      <circle cx="105" cy="15" r="10" fill="#ffd54f" />
      {/* ground */}
      <rect x="0" y="50" width="120" height="70" rx="0" fill="#a5d6a7" />
      {/* barn */}
      <rect x="90" y="25" width="28" height="30" rx="2" fill="#8d6e4c" />
      <polygon points="90,25 104,12 118,25" fill="#c62828" />
      <rect x="100" y="38" width="8" height="17" rx="1" fill="#5c3a1e" />
      {/* fence */}
      <line x1="0" y1="50" x2="85" y2="50" stroke="#8d6e4c" strokeWidth="2" />
      {[5,20,35,50,65,80].map(x => <rect key={x} x={x} y="44" width="3" height="12" fill="#8d6e4c" />)}
      {/* cows (black-white) - 8 of them */}
      {[[15,58],[30,62],[45,56],[20,68],[35,72],[50,65],[10,76],[25,80]].map(([x,y], i) => (
        <g key={`c${i}`}>
          <ellipse cx={x} cy={y} rx="8" ry="5" fill="#fff" stroke="#333" strokeWidth="1" />
          <ellipse cx={x+2} cy={y-1} rx="4" ry="3" fill="#333" opacity="0.3" />
          <circle cx={x-6} cy={y-2} r="2.5" fill="#fff" stroke="#333" strokeWidth="0.8" />
          <rect x={x-3} y={y+4} width="2" height="4" fill="#333" />
          <rect x={x+2} y={y+4} width="2" height="4" fill="#333" />
        </g>
      ))}
      {/* calves (brown-white) - smaller */}
      {[[55,60],[65,68],[72,55],[60,75],[70,78],[75,65]].map(([x,y], i) => (
        <g key={`k${i}`}>
          <ellipse cx={x} cy={y} rx="6" ry="4" fill="#d7a86e" stroke="#8d6e4c" strokeWidth="1" />
          <ellipse cx={x+2} cy={y-1} rx="3" ry="2" fill="#fff" opacity="0.4" />
          <circle cx={x-5} cy={y-2} r="2" fill="#d7a86e" stroke="#8d6e4c" strokeWidth="0.8" />
          <rect x={x-2} y={y+3} width="1.5" height="3" fill="#8d6e4c" />
          <rect x={x+1.5} y={y+3} width="1.5" height="3" fill="#8d6e4c" />
        </g>
      ))}
      {/* bulls (large brown) - 3 */}
      {[[80,58],[85,70],[75,82]].map(([x,y], i) => (
        <g key={`b${i}`}>
          <ellipse cx={x} cy={y} rx="10" ry="7" fill="#6d4c2c" stroke="#3e2723" strokeWidth="1.5" />
          <circle cx={x-9} cy={y-3} r="4" fill="#6d4c2c" stroke="#3e2723" strokeWidth="1" />
          <line x1={x-12} y1={y-6} x2={x-14} y2={y-8} stroke="#3e2723" strokeWidth="1.5" strokeLinecap="round" />
          <line x1={x-6} y1={y-6} x2={x-4} y2={y-8} stroke="#3e2723" strokeWidth="1.5" strokeLinecap="round" />
          <rect x={x-4} y={y+5} width="2.5" height="5" fill="#3e2723" />
          <rect x={x+2} y={y+5} width="2.5" height="5" fill="#3e2723" />
        </g>
      ))}
      {/* labels */}
      <rect x="2" y="100" width="32" height="14" rx="3" fill="#fff" stroke="#1565c0" strokeWidth="1.5" />
      <text x="18" y="110" textAnchor="middle" fontSize="7" fill="#1565c0" fontWeight="bold">14 بقرة</text>
      <rect x="38" y="100" width="32" height="14" rx="3" fill="#fff" stroke="#2e7d32" strokeWidth="1.5" />
      <text x="54" y="110" textAnchor="middle" fontSize="7" fill="#2e7d32" fontWeight="bold">12 عجلة</text>
      <rect x="74" y="100" width="32" height="14" rx="3" fill="#fff" stroke="#c62828" strokeWidth="1.5" />
      <text x="90" y="110" textAnchor="middle" fontSize="7" fill="#c62828" fontWeight="bold">3 ثيران</text>
    </g>
  );
}

// ── end assessment scenes ──

function Computer() {
  return (
    <g>
      <rect x="36" y="20" width="48" height="32" rx="4" fill="#333" stroke={INK} strokeWidth="2.5" />
      <rect x="40" y="24" width="40" height="24" rx="2" fill="#7ec8e3" />
      <rect x="50" y="52" width="20" height="6" rx="2" fill="#666" />
      <rect x="42" y="58" width="36" height="4" rx="2" fill="#999" />
    </g>
  );
}
  return (
    <g>
      <rect x="36" y="20" width="48" height="32" rx="4" fill="#333" stroke={INK} strokeWidth="2.5" />
      <rect x="40" y="24" width="40" height="24" rx="2" fill="#7ec8e3" />
      <rect x="50" y="52" width="20" height="6" rx="2" fill="#666" />
      <rect x="42" y="58" width="36" height="4" rx="2" fill="#999" />
    </g>
  );
}

function Scene({ kind }) {
  if (kind === 'class') {
    return (
      <g>
        <rect x="10" y="10" width="100" height="98" rx="10" fill="#eef3ff" stroke="#9db8e8" strokeWidth="3" />
        {/* desk */}
        <rect x="24" y="58" width="72" height="10" rx="3" fill="#8a5a2b" />
        <rect x="28" y="68" width="8" height="24" fill="#8a5a2b" />
        <rect x="84" y="68" width="8" height="24" fill="#8a5a2b" />
        {/* computer on desk */}
        <rect x="44" y="36" width="32" height="22" rx="3" fill="#333" stroke={INK} strokeWidth="2" />
        <rect x="47" y="39" width="26" height="16" rx="1" fill="#7ec8e3" />
        <rect x="54" y="58" width="12" height="4" rx="1" fill="#666" />
        {/* student (sitting at desk, facing computer) */}
        <circle cx="60" cy="72" r="8" fill="#ffd9a0" stroke={INK} strokeWidth="2" />
        <path d="M52 72 Q60 64 68 72" fill="#5c3a1e" />
        <rect x="53" y="80" width="14" height="14" rx="4" fill="#4a90e2" />
      </g>
    );
  }
  if (kind === 'tree') {
    return (
      <g>
        <rect x="52" y="66" width="14" height="42" fill="#8a5a2b" />
        <circle cx="59" cy="44" r="30" fill="#3fa34d" stroke="#1e6b2e" strokeWidth="3" />
        <ellipse cx="38" cy="88" rx="14" ry="10" fill="#cfd6e4" stroke={INK} strokeWidth="2.5" />
        <circle cx="88" cy="30" r="9" fill="#ffe9a8" stroke="#9a7d0a" strokeWidth="2.5" />
      </g>
    );
  }
  // race track
  return (
    <g>
      <rect x="10" y="46" width="100" height="28" rx="14" fill="#e8eef7" stroke={INK} strokeWidth="3" />
      <line x1="10" y1="60" x2="110" y2="60" stroke="#9db8e8" strokeWidth="2" strokeDasharray="7 5" />
      <circle cx="34" cy="60" r="9" fill="#e5484d" stroke={INK} strokeWidth="2.5" />
      <circle cx="62" cy="60" r="9" fill="#4a90e2" stroke={INK} strokeWidth="2.5" />
      <circle cx="90" cy="60" r="9" fill="#3fa34d" stroke={INK} strokeWidth="2.5" />
      <rect x="96" y="34" width="8" height="52" fill="#8a5a2b" />
      <polygon points="104,34 118,42 104,50" fill="#d32f2f" />
    </g>
  );
}

// Registry: art id → element. Unknown ids fall back to a star (never blank).
export default function SvgArt({ id, size }) {
  const s = size || 120;
  let art = <Star />;
  const diceMatch = /^dice-([1-6])$/.exec(id || '');
  const fingerMatch = /^fingers-([0-5])$/.exec(id || '');
  const coinMatch = /^coin-(\d+)$/.exec(id || '');
  const digitMatch = /^digit-(\d)$/.exec(id || '');
  const dotsMatch = /^dots-(\d+)$/.exec(id || '');
  if (diceMatch) art = <Dice n={Number(diceMatch[1])} />;
  else if (fingerMatch) art = <Fingers n={Number(fingerMatch[1])} />;
  else if (coinMatch) art = <Coin v={coinMatch[1]} />;
  else if (digitMatch) art = <Digit n={digitMatch[1]} />;
  else if (dotsMatch) art = <Dots n={Number(dotsMatch[1])} />;
  else if (id === 'flower') art = <Flower />;
  else if (id === 'ball') art = <Ball />;
  else if (id === 'apple') art = <Apple />;
  else if (id === 'star') art = <Star />;
  else if (id === 'tree') art = <Tree />;
  else if (id === 'triangle') art = <Triangle />;
  else if (id === 'triangle-down') art = <TriangleDown />;
  else if (id === 'square') art = <Square />;
  else if (id === 'circle') art = <CircleShape />;
  else if (id === 'ruler') art = <Ruler />;
  else if (id === 'hand-right') art = <Hand side="right" />;
  else if (id === 'hand-left') art = <Hand side="left" />;
  else if (id === 'hands') art = (<g><g transform="translate(-24,0)"><Hand side="right" /></g><g transform="translate(24,0)"><Hand side="left" /></g></g>);
  else if (id === 'kid-front' || id === 'kid-back' || id === 'kid-center') art = <Kid pose={id === 'kid-back' ? 'back' : 'front'} />;
  else if (id === 'scene-class') art = <Scene kind="class" />;
  else if (id === 'scene-tree') art = <Scene kind="tree" />;
  else if (id === 'race') art = <Scene kind="race" />;
  else if (id === 'pen-on-table') art = <PenOnTable />;
  else if (id === 'venn-3') art = <Venn n={3} />;
  else if (id === 'empty-set' || id === 'empty-box') art = <Venn n={0} />;
  else if (id === 'lines' || id === 'lines-sets') art = (<g><circle cx="34" cy="60" r="24" fill="none" stroke="#1e50b4" strokeWidth="4" /><path d="M78 84 Q100 60 78 36" fill="none" stroke="#e5484d" strokeWidth="4" strokeLinecap="round" /></g>);
  else if (id === 'box-ball') art = <BoxBall inside />;
  else if (id === 'ball-in') art = <BoxBall inside />;
  else if (id === 'ball-out') art = <BoxBall inside={false} />;
  else if (id === 'ball-above') art = <BallAbove />;
  else if (id === 'ball-below') art = <BallBelow />;
  else if (id === 'table-pens' || id === 'table-34' || id === 'table-47' || id === 'table-plus1' || id === 'table-plus2') art = <GridBoard />;
  else if (id === 'bundle-10' || id === 'bundle-13' || id === 'tens') art = (<g><rect x="30" y="40" width="60" height="40" rx="6" fill="#ffe9a8" stroke={INK} strokeWidth="3" /><text x="60" y="66" textAnchor="middle" fontSize="20" fontWeight="800" fill={INK}>10</text></g>);
  else if (id === 'apples-join') art = <AppleJoin left={3} right={2} />;
  else if (id === 'apples-compare') art = <AppleCompare left={5} right={3} />;
  else if (id === 'swap' || id === 'group') art = (<g><polygon points="30,44 52,44 52,34 70,48 52,62 52,52 30,52" fill="#4a90e2" stroke={INK} strokeWidth="3" /><polygon points="90,72 68,72 68,62 50,76 68,90 68,80 90,80" fill="#e5484d" stroke={INK} strokeWidth="3" /></g>);
  else if (id === 'digits' || id === 'order-digits') art = (<g><Digit n="7" /><g transform="translate(44,0)"><Digit n="2" /></g></g>);
  else if (id === 'column-add') art = <ColumnAdd top={23} bottom={14} sum={37} />;
  else if (id === 'compare-14-17') art = (<g><Digit n="1" /><g transform="translate(28,0)"><Digit n="4" /></g><text x="62" y="64" textAnchor="middle" fontSize="18" fontWeight="800" fill={INK}>vs</text><g transform="translate(56,0)"><Digit n="1" /></g><g transform="translate(84,0)"><Digit n="7" /></g></g>);
  else if (id === 'compare-45-54') art = (<g><Digit n="4" /><g transform="translate(28,0)"><Digit n="5" /></g><text x="62" y="64" textAnchor="middle" fontSize="18" fontWeight="800" fill={INK}>vs</text><g transform="translate(56,0)"><Digit n="5" /></g><g transform="translate(84,0)"><Digit n="4" /></g></g>);
  else if (id === 'split-5') art = <SplitDots n={5} groups={[3, 2]} />;
  else if (id === 'split-5b') art = <SplitDots n={5} groups={[2, 3]} />;
  else if (id === 'split-16') art = <SplitDots n={10} groups={[6, 4]} />;
  else if (id === 'set-red') art = <Venn n={4} />;
  else if (id === 'set-fruits') art = (<g><g transform="translate(-12,10) scale(.8)"><Apple /></g><g transform="translate(12,10) scale(.8)"><Apple /></g></g>);
  else if (id === 'set-tag') art = (<g><g transform="translate(-10,10) scale(.8)"><Flower /></g><g transform="translate(14,10) scale(.8)"><Flower /></g></g>);
  else if (id === 'sets-compare' || id === 'buttons-set') art = <Venn n={3} />;
  else if (id === 'pens-erasers') art = (<g><g transform="translate(-18,16) scale(.65)"><PenOnTable /></g><g transform="translate(18,16) scale(.65)"><Square color="#f4a63b" /></g></g>);
  else if (id === 'cat') art = <Cat />;
  else if (id === 'rabbit') art = <Rabbit />;
  else if (id === 'fish') art = <Fish />;
  else if (id === 'coins-1-2-5') art = (<g><g transform="translate(-30,-14) scale(.8)"><Coin v="1" /></g><g transform="translate(30,-14) scale(.8)"><Coin v="2" /></g><g transform="translate(0,26) scale(.8)"><Coin v="5" /></g></g>);
  else if (id === 'coins-10-20-50' || id === 'coins-add') art = (<g><g transform="translate(-30,-14) scale(.8)"><Coin v="10" /></g><g transform="translate(30,-14) scale(.8)"><Coin v="20" /></g><g transform="translate(0,26) scale(.8)"><Coin v="50" /></g></g>);
  else if (id === 'assess-desk') art = <AssessDesk />;
  else if (id === 'assess-birds') art = <AssessBirds />;
  else if (id === 'assess-box') art = <AssessBox />;
  else if (id === 'assess-buttons') art = <AssessButtons />;
  else if (id === 'assess-scores') art = <AssessScores />;
  else if (id === 'assess-farm') art = <AssessFarm />;
  return (
    <svg className="art-svg" width={s} height={s} viewBox="0 0 120 120" role="img" aria-hidden="true">
      {art}
    </svg>
  );
}
