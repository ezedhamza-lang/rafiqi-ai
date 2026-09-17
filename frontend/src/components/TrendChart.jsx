export default function TrendChart({ points = [], height = 180 }) {
  if (!points || points.length < 2) {
    return (
      <div className="muted" style={{ textAlign: 'center', padding: '1.2rem 0' }}>
        لا توجد نقاط كافية لرسم المنحنى بعد.
      </div>
    );
  }

  const W = 560;
  const H = height;
  const pad = { top: 20, right: 16, bottom: 28, left: 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const maxY = 100;
  const minY = 0;
  const maxX = points.length - 1;

  const x = (i) => pad.left + (maxX === 0 ? innerW / 2 : (i / maxX) * innerW);
  const y = (percent) => pad.top + innerH - ((percent - minY) / (maxY - minY)) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.percent)}`).join(' ');
  const areaPath = `${linePath} L ${x(maxX)} ${pad.top + innerH} L ${x(0)} ${pad.top + innerH} Z`;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="trend-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="منحنى الأداء عبر الزمن" className="trend-chart">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6a00" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff6a00" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => (
          <line key={g} x1={pad.left} x2={W - pad.right} y1={y(g)} y2={y(g)} stroke="#e9ecef" strokeWidth="1" />
        ))}
        {gridLines.map((g) => (
          <text key={`t-${g}`} x={pad.left - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="#6c757d">
            {g}%
          </text>
        ))}

        <path d={areaPath} fill="url(#trendFill)" />
        <path d={linePath} fill="none" stroke="#ff6a00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.percent)} r="4" fill="#fff" stroke="#ff6a00" strokeWidth="2">
              <title>{`${p.subjectLabel || p.title || ''}: ${p.percent}%`}</title>
            </circle>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#6c757d">
              {p.shortLabel || `#${i + 1}`}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
