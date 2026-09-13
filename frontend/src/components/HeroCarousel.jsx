import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

const SLIDES = [
  {
    img: '/hero/student.webp',
    titleKey: 'home.heroCarousel.slides.student.title',
    subKey:  'home.heroCarousel.slides.student.sub',
    ctaKey:  'home.heroCarousel.slides.student.cta',
    to:      '/register',
    ctaIcon: 'person_add',
    accent:  '#f4ab2c'
  },
  {
    img: '/hero/teacher.webp',
    titleKey: 'home.heroCarousel.slides.teacher.title',
    subKey:  'home.heroCarousel.slides.teacher.sub',
    ctaKey:  'home.heroCarousel.slides.teacher.cta',
    to:      '/login',
    ctaIcon: 'school',
    accent:  '#60a5fa'
  },
  {
    img: '/hero/support.webp',
    titleKey: 'home.heroCarousel.slides.support.title',
    subKey:  'home.heroCarousel.slides.support.sub',
    ctaKey:  'home.heroCarousel.slides.support.cta',
    to:      '/help',
    ctaIcon: 'support_agent',
    accent:  '#34d399'
  },
  {
    img: '/hero/parent.webp',
    titleKey: 'home.heroCarousel.slides.parent.title',
    subKey:  'home.heroCarousel.slides.parent.sub',
    ctaKey:  'home.heroCarousel.slides.parent.cta',
    to:      '/registration',
    ctaIcon: 'family_restroom',
    accent:  '#f472b6'
  }
];

const INTERVAL = 5500;

export default function HeroCarousel() {
  const { t } = useI18n();
  const [cur, setCur] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const touchRef = useRef({ x0: 0, y0: 0 });
  const transitioning = useRef(false);

  const next = useCallback(() => {
    if (transitioning.current) return;
    transitioning.current = true;
    setDir(1);
    setCur(p => (p + 1) % SLIDES.length);
  }, []);

  const prev = useCallback(() => {
    if (transitioning.current) return;
    transitioning.current = true;
    setDir(-1);
    setCur(p => (p - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  const goTo = useCallback((i) => {
    if (transitioning.current || i === cur) return;
    transitioning.current = true;
    setDir(i > cur ? 1 : -1);
    setCur(i);
  }, [cur]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, INTERVAL);
    return () => clearInterval(id);
  }, [paused, next]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const onTouchStart = (e) => {
    touchRef.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x0;
    const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.y0);
    if (Math.abs(dx) > 50 && dy < 80) {
      dx < 0 ? next() : prev();
    }
  };

  const slide = SLIDES[cur];

  return (
    <section
      className="hero-carousel"
      role="region"
      aria-label={t('home.heroCarousel.ariaLabel', 'Hero Carousel')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Background images with parallax */}
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={`hero-carousel__bg ${i === cur ? 'active' : ''} ${i < cur ? 'exit-left' : 'exit-right'}`}
          style={{
            backgroundImage: `url('${s.img}')`,
            '--parallax-y': i === cur ? '0' : '16px'
          }}
          aria-hidden="true"
        />
      ))}

      {/* Dark overlay gradient */}
      <div className="hero-carousel__overlay" aria-hidden="true" />

      {/* Content */}
      <div className="hero-carousel__inner container">
        <div
          key={cur}
          className={`hero-carousel__slide ${dir === 1 ? 'slide-enter-right' : 'slide-enter-left'}`}
          onAnimationEnd={() => { transitioning.current = false; }}
        >
          <span className="hero-carousel__badge" style={{ borderColor: slide.accent, color: slide.accent }}>
            <span className="material-icons" style={{ fontSize: 16 }}>{slide.ctaIcon}</span>
            {t(`home.heroCarousel.slides.${['student','teacher','support','parent'][cur]}.badge`)}
          </span>

          <h1 className="hero-carousel__title">{t(slide.titleKey)}</h1>
          <p className="hero-carousel__sub">{t(slide.subKey)}</p>

          <div className="hero-carousel__cta">
            <Link to={slide.to} className="btn btn-primary btn-lg">
              <span className="material-icons">{slide.ctaIcon}</span> {t(slide.ctaKey)}
            </Link>
            <Link to="/help" className="btn btn-ghost btn-lg hero-carousel__ghost">
              {t('home.heroCarousel.learnMore')}
            </Link>
          </div>
        </div>
      </div>

      {/* Arrows */}
      <button type="button" className="hero-carousel__arrow hero-carousel__arrow--prev" onClick={prev} aria-label="Previous slide">
        <span className="material-icons">chevron_left</span>
      </button>
      <button type="button" className="hero-carousel__arrow hero-carousel__arrow--next" onClick={next} aria-label="Next slide">
        <span className="material-icons">chevron_right</span>
      </button>

      {/* Dots */}
      <div className="hero-carousel__dots" role="tablist">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === cur}
            aria-label={`Slide ${i + 1}`}
            className={`hero-carousel__dot ${i === cur ? 'active' : ''}`}
            style={i === cur ? { background: slide.accent } : undefined}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="hero-carousel__progress">
        <div
          key={cur}
          className="hero-carousel__progress-bar"
          style={{
            background: slide.accent,
            animationDuration: `${INTERVAL}ms`
          }}
        />
      </div>
    </section>
  );
}
