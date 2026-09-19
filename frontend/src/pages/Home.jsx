import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';
import { Card, Badge } from '../components/ui/index.js';
import BooksShowcase from '../components/BooksShowcase.jsx';
import HeroCarousel from '../components/HeroCarousel.jsx';

const SERVICE_GROUPS = [
  {
    groupKey: 'student',
    color: '#0ea5e9',
    items: [
      { icon: 'school', key: 'studentSection', to: '/student' },
      { icon: 'task_alt', key: 'requiredWork' },
      { icon: 'bar_chart', key: 'grades' },
      { icon: 'schedule', key: 'absences' },
      { icon: 'explore', key: 'guidance' },
      { icon: 'list', key: 'optionalSubjects' },
      { icon: 'dashboard', key: 'dashboard' }
    ]
  },
  {
    groupKey: 'parent',
    color: '#7c6fd9',
    items: [
      { icon: 'family_restroom', key: 'myChild' },
      { icon: 'groups', key: 'myChildren' },
      { icon: 'warning', key: 'reports' },
      { icon: 'directions_bus', key: 'scholarship' },
      { icon: 'summarize', key: 'shortReports' }
    ]
  },
  {
    groupKey: 'admin',
    color: '#22a06b',
    items: [
      { icon: 'how_to_reg', key: 'registration' },
      { icon: 'manage_search', key: 'registrationRequests' },
      { icon: 'person_add', key: 'newRegistration' },
      { icon: 'assignment', key: 'procedures' },
      { icon: 'folder_open', key: 'myRequests' },
      { icon: 'description', key: 'schoolCertificate' }
    ]
  },
  {
    groupKey: 'teacher',
    color: '#E8A317',
    items: [
      { icon: 'notifications', key: 'alerts' },
      { icon: 'support_agent', key: 'support' },
      { icon: 'help_outline', key: 'help' }
    ]
  }
];


const STATS = [
  { key: 'teachers', field: 'teachers' },
  { key: 'students', field: 'students' },
  { key: 'institutions', field: 'schools' }
];

function formatStat(n) {
  if (n == null || Number.isNaN(Number(n))) return '…';
  const v = Number(n);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

function FaqSection({ faqs }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(0);
  return (
    <div className="faq-grid" id="faq">
      <div className="faq-card">
        <h2>{t('home.faq.title')}</h2>
        {faqs.slice(0, 4).map((item, i) => (
          <div className="faq-item" key={item.id}>
            <button
              type="button"
              className={`faq-question ${open === i ? 'open' : ''}`}
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
              aria-controls={`faq-answer-${item.id}`}
            >
              {item.question}
              <span className="material-icons" aria-hidden="true">expand_more</span>
            </button>
            <div id={`faq-answer-${item.id}`} className={`faq-answer ${open === i ? 'open' : ''}`}>
              <p>{item.answer}</p>
            </div>
          </div>
        ))}
        <div className="faq-actions">
          <Link to="/help" className="btn btn-primary">
            {t('home.faq.requestHelp')}
          </Link>
          <Link to="/help" className="btn btn-ghost">
            {t('home.faq.contactAdmin')}
          </Link>
        </div>
      </div>
      <div className="faq-card">
        <div className="faq-discover">
          <img src="/owl-mascot.webp" alt="Ø±ÙÙŠÙ‚ÙŠ" className="faq-owl" loading="lazy" />
          <div>
            <h2>{t('home.faq.discoverApp')}</h2>
            <p style={{ color: 'var(--muted)', lineHeight: 1.9, fontSize: '0.92rem' }}>
              {t('home.faq.description')}
            </p>
            <div className="hero-actions" style={{ justifyContent: 'flex-start' }}>
              <Link to="/register" className="btn btn-primary">
                <span className="material-icons">person_add</span> {t('home.faq.registerNow')}
              </Link>
              <Link to="/help" className="btn btn-ghost">
                <span className="material-icons">support_agent</span> {t('home.faq.support')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveStats, setLiveStats] = useState(null);
  const mainRef = useRef(null);

  useEffect(() => {
    const root = mainRef.current || document;
    const els = root.querySelectorAll('.fade-in-section');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '60px 0px -20px 0px' }
    );
    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 60) {
        el.classList.add('visible');
      } else {
        observer.observe(el);
      }
    });
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    api.get('/public/faqs')
      .then((f) => {
        setFaqs(f);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    api.get('/public/stats')
      .then(setLiveStats)
      .catch(() => setLiveStats(null));
  }, []);

  return (
    <>
      <HeroCarousel />

      <section
        className="announcements-banner"
        id="announcements"
        style={{
          backgroundImage: "url('/banner-roles.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#f0f4ff',
          width: '100%',
          aspectRatio: '3 / 1',
          borderRadius: '1.2rem',
          marginTop: '0.5rem'
        }}
      />

      <section className="section fade-in-section" id="digital-services">
        <div className="container">
          <h2 className="section-title">{t('home.servicesTitle')}</h2>
          <div className="title-bar" />
          {SERVICE_GROUPS.map((grp) => (
            <div className="service-group" key={grp.groupKey}>
              <h3 className="service-group-title" style={{ color: grp.color }}>
                <span className="material-icons" style={{ fontSize: 20 }}>{grp.items[0].icon}</span>
                {t(`home.serviceGroups.${grp.groupKey}`)}
              </h3>
              <div className="services-grid">
                {grp.items.map((s) => (
                  <Link
                    to={s.to || (s.key === 'newRegistration' ? '/registration' : '/dashboard')}
                    className="service-card"
                    key={s.key}
                    style={{ borderTop: `4px solid ${grp.color}` }}
                  >
                    <span
                      className="material-icons"
                      style={{ color: grp.color, background: `${grp.color}1a` }}
                    >
                      {s.icon}
                    </span>
                    <h4>{t(`home.services.${s.key}`)}</h4>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <BooksShowcase />

      <section className="section fade-in-section" style={{ background: 'var(--gradient-brand)', padding: '3rem 0' }}>
        <div className="container">
          <div className="stats-row">
            {STATS.map((s) => (
              <div className="stat-home" key={s.key}>
                <div className="stat-number">{formatStat(liveStats?.[s.field])}</div>
                <div className="stat-label">{t(`home.stats.${s.key}`)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section fade-in-section" style={{ background: 'var(--bg-elevated)' }}>
        <div className="container">
          <h2 className="section-title">{t('home.helpTitle')}</h2>
          <div className="title-bar" />
          {loading ? (
            <div className="loading-wrap">
              <span className="spinner" />
            </div>
          ) : (
            <FaqSection faqs={faqs} />
          )}
        </div>
      </section>

      {import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true' && (
        <section className="section">
          <div className="container">
            <h2 className="section-title">{t('home.demoTitle')}</h2>
            <div className="title-bar" />
            <Card title={t('home.demo.cardTitle')} subtitle={t('home.demo.cardSubtitle')}>
              <div className="demo-accounts" style={{ boxShadow: 'none', padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('home.demo.role')}</th>
                      <th>{t('home.demo.email')}</th>
                      <th>{t('home.demo.password')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><Badge variant="warning">{t('roles.superAdmin')}</Badge></td>
                      <td>admin@education.tn</td>
                      <td>admin123</td>
                    </tr>
                    <tr>
                      <td><Badge variant="info">{t('roles.schoolDirector')}</Badge></td>
                      <td>director@test.tn</td>
                      <td>director123</td>
                    </tr>
                    <tr>
                      <td><Badge variant="success">{t('roles.teacher')}</Badge></td>
                      <td>teacher@test.tn</td>
                      <td>teacher123</td>
                    </tr>
                    <tr>
                      <td><Badge variant="success">{t('roles.parent')}</Badge></td>
                      <td>parent@test.tn</td>
                      <td>parent123</td>
                    </tr>
                    <tr>
                      <td><Badge variant="info">{t('roles.student')}</Badge></td>
                      <td>student@test.tn</td>
                      <td>student123</td>
                    </tr>
                    <tr>
                      <td><Badge variant="primary">{t('roles.systemSuperAdmin')}</Badge></td>
                      <td>super@education.tn</td>
                      <td>super123</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </section>
      )}
    </>
  );
}
