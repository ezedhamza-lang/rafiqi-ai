import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';
import { formatDate as fmtDate } from '../utils/formatUtils.js';
import { CALENDAR_TYPE_LABEL_KEYS, CALENDAR_TYPE_ICONS } from '../roles.js';

const MONTHS_AR = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAYS_AR = ['إث', 'ثل', 'أر', 'خم', 'جم', 'سب', 'أح'];

const TYPE_COLORS = {
  HOLIDAY: '#22a06b',
  EXAM: '#e0593b',
  MEETING: '#0ea5e9',
  ACTIVITY: '#7c6fd9',
  OTHER: '#f59e0b'
};

const TYPE_ORDER = ['HOLIDAY', 'EXAM', 'MEETING', 'ACTIVITY', 'OTHER'];

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthMatrix(year, month) {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-start
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function PublicAgenda() {
  const { t, lang } = useI18n();
  const today = new Date();
  const [view, setView] = useState('annual');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/public/calendar?year=${year}`)
      .then((data) => {
        if (!cancelled) setEvents(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'تعذّر تحميل الأجندة');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const byDate = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      const key = startOfDay(new Date(ev.date)).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const monthEvents = useMemo(
    () =>
      events.filter((ev) => {
        const d = new Date(ev.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      }),
    [events, year, month]
  );

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const changePeriod = (delta) => {
    if (view === 'annual') setYear((y) => y + delta);
    else changeMonth(delta);
  };

  const cells = useMemo(() => monthMatrix(year, month), [year, month]);

  return (
    <div className="container" style={{ padding: '2rem 1rem 3rem' }}>
      <div className="panel-head" style={{ marginBottom: '1.2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-icons">calendar_month</span>
          {t('agenda.title')}
          <span className="badge badge-chip" style={{ background: '#0ea5e9', color: '#fff' }}>{t('agenda.newBadge')}</span>
        </h2>
        <p className="muted">{t('agenda.subtitle')}</p>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center', marginBottom: '1.2rem' }}>
        <div className="segmented">
          <button className={`btn ${view === 'annual' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('annual')}>
            <span className="material-icons">view_module</span> {t('agenda.annual')}
          </button>
          <button className={`btn ${view === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('monthly')}>
            <span className="material-icons">calendar_view_month</span> {t('agenda.monthly')}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginInlineStart: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => changePeriod(-1)} aria-label={t('agenda.prev')}>
            <span className="material-icons">chevron_right</span>
          </button>
          {view === 'monthly' && (
            <strong style={{ minWidth: '8rem', textAlign: 'center' }}>
              {MONTHS_AR[month - 1]} {year}
            </strong>
          )}
          {view === 'annual' && (
            <strong style={{ minWidth: '6rem', textAlign: 'center' }}>{year}</strong>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => changePeriod(1)} aria-label={t('agenda.next')}>
            <span className="material-icons">chevron_left</span>
          </button>
          {view === 'annual' && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setYear(today.getFullYear()); }}>{t('agenda.goToday')}</button>
          )}
          {view === 'monthly' && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}>{t('agenda.goToday')}</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap"><span className="spinner" /></div>
      ) : (
        <>
          {view === 'monthly' ? (
            <div className="panel">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '0.5rem' }}>
                {WEEKDAYS_AR.map((w) => (
                  <div key={w} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--muted)' }}>{w}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {cells.map((d, i) => {
                  if (d == null) return <div key={`e${i}`} style={{ minHeight: '84px', background: 'var(--bg-elevated)' }} />;
                  const key = new Date(year, month - 1, d).toISOString().slice(0, 10);
                  const dayEvents = byDate[key] || [];
                  const isToday = d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
                  return (
                    <div
                      key={key}
                      style={{
                        minHeight: '84px',
                        border: `1px solid var(--border)`,
                        borderRadius: '8px',
                        padding: '4px',
                        background: isToday ? 'var(--accent-soft)' : 'var(--bg)'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>{d}</div>
                      {dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          title={`${ev.title} (${t(CALENDAR_TYPE_LABEL_KEYS[ev.type] || 'agenda')})`}
                          style={{
                            marginTop: '2px',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: '#fff',
                            background: TYPE_COLORS[ev.type] || TYPE_COLORS.OTHER,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h4>{MONTHS_AR[month - 1]} {year} — {monthEvents.length} {t('agenda.legend')}</h4>
                {monthEvents.length === 0 ? (
                  <div className="empty">{t('agenda.noEvents')}</div>
                ) : (
                  <div className="cards-grid">
                    {monthEvents.map((ev) => (
                      <div key={ev.id} className="card-item">
                        <div className="panel-head">
                          <span className="material-icons" style={{ color: TYPE_COLORS[ev.type] || TYPE_COLORS.OTHER }}>
                            {CALENDAR_TYPE_ICONS[ev.type] || 'event'}
                          </span>
                          <strong>{fmtDate(ev.date, lang)}</strong>
                        </div>
                        <h4>{ev.title}</h4>
                        {ev.description && <p className="muted">{ev.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '1rem'
              }}
            >
              {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => {
                const mcells = monthMatrix(year, m);
                return (
                  <div key={m} className="panel" style={{ padding: '0.6rem' }}>
                    <h4 style={{ textAlign: 'center', marginBottom: '0.4rem' }}>{MONTHS_AR[m - 1]}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                      {WEEKDAYS_AR.map((w) => (
                        <div key={w} style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--muted)' }}>{w}</div>
                      ))}
                      {mcells.map((d, i) => {
                        if (d == null) return <div key={`e${i}`} />;
                        const key = new Date(year, m - 1, d).toISOString().slice(0, 10);
                        const dayEvents = byDate[key] || [];
                        const color = dayEvents[0] ? TYPE_COLORS[dayEvents[0].type] || TYPE_COLORS.OTHER : null;
                        return (
                          <div
                            key={key}
                            title={dayEvents.map((e) => e.title).join('\n')}
                            style={{
                              textAlign: 'center',
                              fontSize: '0.65rem',
                              padding: '2px 0',
                              borderRadius: '4px',
                              background: color ? `${color}22` : 'transparent',
                              color: color || 'var(--text)',
                              border: dayEvents.length ? `1px solid ${color}` : '1px solid transparent'
                            }}
                          >
                            {d}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <strong style={{ color: 'var(--muted)' }}>{t('agenda.legend')}:</strong>
            {TYPE_ORDER.map((tp) => (
              <span key={tp} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: TYPE_COLORS[tp] }} />
                {t(CALENDAR_TYPE_LABEL_KEYS[tp])}
              </span>
            ))}
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/register" className="btn btn-outline">
              <span className="material-icons">person_add</span> {t('home.hero.createAccount')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
