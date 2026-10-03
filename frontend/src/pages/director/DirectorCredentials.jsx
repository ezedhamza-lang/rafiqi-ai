// بطاقات الدخول للتلميذ (المرحلة C) — إصدار، عرض، طباعة، CSV.
// القاعدة: كلمة السر تُطلب من الخادم مرة واحدة عند الإصدار فقط؛ لا تُحفظ في
// المتصفح ولا تُطلب في أي قراءة ⇒ لا تُطبع بالخطأ ولا تُرسل في تقرير.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { levelLabel, statusLabel } from '../../utils/labels.js';

const MODES = [
  { key: 'card', labelKey: 'directorCredentials.modes.card' },
  { key: 'temporary', labelKey: 'directorCredentials.modes.temporary' }
];

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function DirectorCredentials() {
  const { t, lang } = useI18n();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [info, setInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [cards, setCards] = useState([]);
  const [mode, setMode] = useState('card');
  const [sharedPw, setSharedPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/director/classes')
      .then((list) => {
        setClasses(list);
        setClassId((prev) => prev || (list[0] ? String(list[0].id) : ''));
      })
      .catch((e) => setErr(e.message));
  }, []);

  const load = useCallback(async (id) => {
    if (!id) {
      setRows([]);
      setInfo(null);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await api.get(`/director/classes/${id}/credentials`);
      setRows(res.students);
      setInfo(res.class);
    } catch (e) {
      setErr(e.message);
      setRows([]);
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(classId);
  }, [classId, load]);

  const mergeCard = (card) => {
    setCards((prev) => {
      const rest = prev.filter((c) => c.studentId !== card.studentId);
      return [...rest, card].sort((a, b) => String(a.lastName).localeCompare(String(b.lastName), 'ar'));
    });
    // نبدأ من بيانات نظيفة لكل قسم ⇒ بطاقات القسم الجديد لا تُخلط بالأخرى
    if (!classId) setCards([]);
  };

  const issueOne = async (student, chosenMode) => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const body = { mode: chosenMode };
      const custom = chosenMode === 'card' ? sharedPw.trim() : '';
      if (custom) body.password = custom;
      const card = await api.post(`/director/credentials/${student.id}`, body);
      mergeCard(card);
      setMsg(t('directorCredentials.issuedMsg', { name: `${card.firstName} ${card.lastName}` }));
      await load(classId);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const issueAll = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const body = { classId: Number(classId), mode };
      const custom = mode === 'card' ? sharedPw.trim() : '';
      if (custom) body.password = custom;
      const res = await api.post('/director/credentials/bulk', body);
      setCards((prev) => {
        const map = new Map(prev.map((c) => [c.studentId, c]));
        for (const c of res.cards) map.set(c.studentId, c);
        return [...map.values()].sort((a, b) => String(a.lastName).localeCompare(String(b.lastName), 'ar'));
      });
      setMsg(
        t('directorCredentials.bulkMsg', { issued: res.issued, skipped: res.skipped, failures: res.failures.length })
      );
      await load(classId);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // levelText = تسمية جاهزة (ليست خامًا) — لذلك اسمها يوضّح ذلك ويتفادى حارس الأكواد
  const printable = useMemo(
    () => ({
      school: t('directorCredentials.cardSchool'),
      className: info?.name || '',
      levelText: levelLabel(info?.level, lang),
      year: info?.schoolYear || ''
    }),
    [info, t, lang]
  );

  const downloadCsv = () => {
    if (cards.length === 0) return;
    const header = [t('directorCredentials.csv.name'), t('directorCredentials.csv.email'), t('directorCredentials.csv.password')];
    const lines = [header.join(';')];
    for (const c of cards) {
      lines.push([`${c.firstName} ${c.lastName}`, c.email, c.password].map(csvEscape).join(';'));
    }
    // BOM حتى تفتح Excel العربية سليمة
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cartes-${(info?.name || 'classe').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('directorCredentials.title')}</h3>
        <p className="muted">{t('directorCredentials.subtitle')}</p>
      </div>

      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}
      {err && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{err}</div>}

      <div className="creds-toolbar">
        <label className="creds-field">
          <span>{t('directorCredentials.classLabel')}</span>
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setCards([]); }}>
            {classes.length === 0 && <option value="">{t('directorCredentials.noClasses')}</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c._count?.students ?? 0})
              </option>
            ))}
          </select>
        </label>

        <div className="creds-field">
          <span>{t('directorCredentials.modeLabel')}</span>
          <div className="creds-modes">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`badge ${mode === m.key ? 'badge-approved' : ''}`}
                style={{ cursor: 'pointer', border: 'none' }}
                onClick={() => setMode(m.key)}
              >
                {t(m.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <label className="creds-field">
          <span>{t('directorCredentials.sharedPwLabel')}</span>
          <input
            type="text"
            value={sharedPw}
            onChange={(e) => setSharedPw(e.target.value)}
            placeholder={t('directorCredentials.sharedPwPlaceholder')}
            autoComplete="off"
          />
        </label>

        <div className="creds-actions">
          <button className="btn" disabled={busy || !classId || !rows.some((r) => r.email)} onClick={issueAll}>
            <span className="material-icons">confirmation_number</span> {t('directorCredentials.issueAll')}
          </button>
          <button className="btn btn-ghost" disabled={cards.length === 0} onClick={() => window.print()}>
            <span className="material-icons">print</span> {t('directorCredentials.print')}
          </button>
          <button className="btn btn-ghost" disabled={cards.length === 0} onClick={downloadCsv}>
            <span className="material-icons">download</span> {t('directorCredentials.csvBtn')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap"><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="empty">{t('directorCredentials.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('directorCredentials.studentColumn')}</th>
                <th>{t('directorCredentials.emailColumn')}</th>
                <th>{t('directorCredentials.levelColumn')}</th>
                <th>{t('directorCredentials.statusColumn')}</th>
                <th>{t('directorCredentials.issuedColumn')}</th>
                <th>{t('directorCredentials.actionsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.firstName} {r.lastName}</td>
                  <td>{r.email || '—'}</td>
                  <td>{levelLabel(r.level, lang)}</td>
                  <td>
                    {!r.email ? (
                      <span className="badge badge-pending">{t('directorCredentials.noAccount')}</span>
                    ) : (
                      <span className={`badge badge-${r.accountStatus === 'ACTIVE' ? 'approved' : 'pending'}`}>
                        {statusLabel(r.accountStatus, lang)}
                      </span>
                    )}
                  </td>
                  <td>
                    {r.credentialsIssuedAt ? (
                      <>
                        <span className="badge badge-approved">{t('directorCredentials.issuedYes')}</span>
                        {r.needsChange && (
                          <span className="badge badge-pending" style={{ marginInlineStart: '0.3rem' }}>
                            {t('directorCredentials.needsChange')}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="badge badge-pending">{t('directorCredentials.issuedNo')}</span>
                    )}
                  </td>
                  <td className="actions">
                    {!r.email ? (
                      <span className="muted">{t('directorCredentials.noAccount')}</span>
                    ) : (
                      <>
                        <button className="btn btn-sm" disabled={busy} onClick={() => issueOne(r, mode)}>
                          <span className="material-icons">vpn_key</span> {t('directorCredentials.issueBtn')}
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          disabled={busy}
                          onClick={() => issueOne(r, mode === 'card' ? 'temporary' : 'card')}
                          title={t('directorCredentials.issueOtherMode')}
                        >
                          {t(mode === 'card' ? 'directorCredentials.asTemporary' : 'directorCredentials.asCard')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cards.length > 0 && (
        <div className="creds-cards-wrap">
          <h4>{t('directorCredentials.cardsTitle', { n: cards.length })}</h4>
          <p className="muted">{t('directorCredentials.cardsHint')}</p>
          <div className="creds-cards">
            {cards.map((c) => (
              <div className="creds-card" key={c.studentId}>
                <div className="creds-card__head">
                  <strong>{c.firstName} {c.lastName}</strong>
                  <span>{printable.className}</span>
                </div>
                <div className="creds-card__row"><span>{t('directorCredentials.cardEmail')}</span><code>{c.email}</code></div>
                <div className="creds-card__row"><span>{t('directorCredentials.cardPassword')}</span><code>{c.password}</code></div>
                <div className="creds-card__foot">
                  {printable.levelText} · {printable.year}
                  {c.mustChangePassword && <em>{t('directorCredentials.cardMustChange')}</em>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
