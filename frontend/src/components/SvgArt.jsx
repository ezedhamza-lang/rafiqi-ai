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
  return (
    <g>
      <circle cx="60" cy="30" r="14" fill="#ffd9a0" stroke={INK} strokeWidth="3" />
      <path d="M46 28 Q60 12 74 28" fill="#5c3a1e" strokeWidth="4" />
      <rect x="48" y="46" width="24" height="34" rx="8" fill={pose === 'back' ? '#9db8e8' : '#4a90e2'} stroke={INK} strokeWidth="3" />
      <line x1="52" y1="80" x2="52" y2="102" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <line x1="68" y1="80" x2="68" y2="102" stroke={INK} strokeWidth="4" strokeLinecap="round" />
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

function Scene({ kind }) {
  if (kind === 'class') {
    return (
      <g>
        <rect x="10" y="14" width="100" height="92" rx="10" fill="#eef3ff" stroke="#9db8e8" strokeWidth="3" />
        <rect x="30" y="60" width="60" height="10" rx="3" fill="#8a5a2b" />
        <rect x="34" y="70" width="8" height="22" fill="#8a5a2b" />
        <rect x="78" y="70" width="8" height="22" fill="#8a5a2b" />
        <circle cx="50" cy="42" r="9" fill="#ffd9a0" stroke={INK} strokeWidth="2.5" />
        <rect x="43" y="51" width="14" height="12" rx="4" fill="#4a90e2" />
        <circle cx="78" cy="36" r="9" fill="#ffd9a0" stroke={INK} strokeWidth="2.5" />
        <rect x="71" y="45" width="14" height="20" rx="4" fill="#e5484d" />
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
  if (diceMatch) art = <Dice n={Number(diceMatch[1])} />;
  else if (fingerMatch) art = <Fingers n={Number(fingerMatch[1])} />;
  else if (coinMatch) art = <Coin v={coinMatch[1]} />;
  else if (digitMatch) art = <Digit n={digitMatch[1]} />;
  else if (/^dots-\d+$/.test(id || '')) art = <Dots n={Number(id.split('-')[1])} />;
  else if (id === 'flower') art = <Flower />;
  else if (id === 'butterfly') art = <Butterfly />;
  else if (id === 'bird' || id === 'bird-up' || id === 'bird-down') art = <Bird />;
  else if (id === 'ball' || id === 'ball-in' || id === 'ball-out') art = <Ball />;
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
  else if (id === 'venn-3' || id === 'set-red' || id === 'set-fruits' || id === 'set-tag' || id === 'sets-compare' || id === 'buttons-set' || id === 'pens-erasers' || id === 'split-5' || id === 'split-5b' || id === 'split-16') art = <Venn n={3} />;
  else if (id === 'empty-set' || id === 'empty-box') art = <Venn n={0} />;
  else if (id === 'birds-nests') art = (<g><Bird /><g transform="translate(36,34) scale(.7)"><Bird /></g></g>);
  else if (id === 'lines' || id === 'lines-sets') art = (<g><circle cx="34" cy="60" r="24" fill="none" stroke="#1e50b4" strokeWidth="4" /><path d="M78 84 Q100 60 78 36" fill="none" stroke="#e5484d" strokeWidth="4" strokeLinecap="round" /></g>);
  else if (id === 'box-ball') art = <BoxBall inside />;
  else if (id === 'ball-in') art = <BoxBall inside />;
  else if (id === 'ball-out') art = <BoxBall inside={false} />;
  else if (id === 'ball-above') art = <BallAbove />;
  else if (id === 'ball-below') art = <BallBelow />;
  else if (id === 'table-pens' || id === 'table-34' || id === 'table-47' || id === 'table-plus1' || id === 'table-plus2') art = <GridBoard />;
  else if (id === 'bundle-10' || id === 'bundle-13') art = (<g><rect x="30" y="40" width="60" height="40" rx="6" fill="#ffe9a8" stroke={INK} strokeWidth="3" /><text x="60" y="66" textAnchor="middle" fontSize="20" fontWeight="800" fill={INK}>10</text></g>);
  else if (id === 'apples-join' || id === 'apples-compare' || id === 'balls-5' || id === 'marbles-15' || id === 'flowers-2') art = (<g><Apple /><g transform="translate(34,20) scale(.8)"><Apple /></g><g transform="translate(-32,18) scale(.8)"><Apple /></g></g>);
  else if (id === 'swap' || id === 'group') art = (<g><polygon points="30,44 52,44 52,34 70,48 52,62 52,52 30,52" fill="#4a90e2" stroke={INK} strokeWidth="3" /><polygon points="90,72 68,72 68,62 50,76 68,90 68,80 90,80" fill="#e5484d" stroke={INK} strokeWidth="3" /></g>);
  else if (id === 'tens') art = (<g><rect x="30" y="40" width="60" height="40" rx="6" fill="#ffe9a8" stroke={INK} strokeWidth="3" /><text x="60" y="66" textAnchor="middle" fontSize="20" fontWeight="800" fill={INK}>10</text></g>);
  else if (id === 'digits' || id === 'order-digits') art = (<g><Digit n="7" /><g transform="translate(44,0)"><Digit n="2" /></g></g>);
  else if (id === 'column-add' || id === 'compare-14-17' || id === 'compare-45-54' || id === 'pen-on-table' || id === 'race' || id === 'scene-class' || id === 'scene-tree') art = <Scene kind={id === 'scene-tree' ? 'tree' : id === 'race' ? 'race' : 'class'} />;
  else if (id === 'cat') art = <Cat />;
  else if (id === 'rabbit') art = <Rabbit />;
  else if (id === 'fish') art = <Fish />;
  else if (id === 'coins-10-20-50' || id === 'coins-add') art = (<g><g transform="translate(-30,-14) scale(.8)"><Coin v="10" /></g><g transform="translate(30,-14) scale(.8)"><Coin v="20" /></g><g transform="translate(0,26) scale(.8)"><Coin v="50" /></g></g>);
  return (
    <svg className="art-svg" width={s} height={s} viewBox="0 0 120 120" role="img" aria-hidden="true">
      {art}
    </svg>
  );
}
