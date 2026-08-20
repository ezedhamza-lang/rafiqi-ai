export default function Skeleton({ width, height = 16, variant = 'text', className = '', style, ...rest }) {
  const cls = ['ui-skeleton'];
  if (variant === 'circle') cls.push('ui-skeleton-circle');
  if (variant === 'rect') cls.push('ui-skeleton-rect');
  if (className) cls.push(className);
  return (
    <span
      className={cls.join(' ')}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonCard({ lines = 3, height = 'auto', className = '' }) {
  return (
    <div className={`ui-skeleton-card ${className}`} style={{ height }} aria-hidden="true">
      <Skeleton variant="rect" height={110} width="100%" />
      <div style={{ padding: '1rem', display: 'grid', gap: '0.6rem' }}>
        <Skeleton width="70%" height={18} />
        {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
          <Skeleton key={i} width={`${90 - i * 15}%`} height={12} />
        ))}
      </div>
    </div>
  );
}
