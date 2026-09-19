import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function SlideArt({ s }) {
  const [failed, setFailed] = useState(false);
  if (s.image && !failed) {
    return <img src={s.image} alt="" className="promo-img" loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <div className="promo-art" aria-hidden="true">
      <img src="/owl-mascot.webp" alt="" className="promo-owl" loading="lazy" />
    </div>
  );
}

export default function PromoCarousel({ slides, interval = 6000 }) {
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    if (!slides || slides.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [slides, interval]);
  if (!slides || !slides.length) return null;
  const s = slides[idx % slides.length];
  return (
    <div className="promo-carousel" role="region" aria-roledescription="carousel">
      <div className={`promo-slide promo-tone-${s.tone || 'blue'}`} key={s.key}>
        <SlideArt s={s} />
        <div className="promo-text">
          <h3>{s.title}</h3>
          <p>{s.subtitle}</p>
          {s.cta && s.to && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(s.to)}>
              {s.cta}
            </button>
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="promo-dots">
          {slides.map((sl, i) => (
            <button
              key={sl.key}
              type="button"
              className={i === (idx % slides.length) ? 'on' : ''}
              onClick={() => setIdx(i)}
              aria-label={`slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
