import { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';

const SUBJECT_CODES = ['MATH', 'READING', 'SCIENCE', 'STORIES'];
const STATUS_CLS = { SENT: 'warn', IN_REVIEW: 'warn', CORRECTED: 'good' };
const MAX_PAGES = 10;

function enhanceImage(file, errFactory) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetW = 1200;
      const scale = targetW / img.width;
      canvas.width = targetW;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrast = 1.25;
        gray = (gray - 128) * contrast + 128 + 18;
        gray = Math.max(0, Math.min(255, gray));
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) resolve({ blob, preview: canvas.toDataURL('image/jpeg', 0.85) });
        else reject(new Error(errFactory('imageProcessFailed')));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(errFactory('invalidImage')));
    };
    img.src = url;
  });
}

export default function PaperExamScan() {
  const { t, lang } = useI18n();
  const [subject, setSubject] = useState('MATH');
  const [examTitle, setExamTitle] = useState('');
  const [images, setImages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myExams, setMyExams] = useState([]);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    api
      .get('/teacher/student/submitted-exams')
      .then(setMyExams)
      .catch(() => {});
  }, []);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    if (images.length + files.length > MAX_PAGES) {
      setError(t('studentSpace.paperExam.maxPagesError', { n: MAX_PAGES }));
      return;
    }
    setError('');
    setProcessing(true);
    try {
      const enhanced = [];
      for (const f of files) {
        const r = await enhanceImage(f, (key) => t(`studentSpace.paperExam.${key}`));
        enhanced.push(r);
      }
      setImages((prev) => [...prev, ...enhanced]);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const removeImage = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e) => {
    e.preventDefault();
    if (!examTitle.trim()) {
      setError(t('studentSpace.paperExam.titleRequired'));
      return;
    }
    if (!images.length) {
      setError(t('studentSpace.paperExam.atLeastOnePage'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('subject', subject);
      fd.append('examTitle', examTitle.trim());
      images.forEach((img) => fd.append('images', img.blob, `page-${Date.now()}.jpg`));
      await api.post('/teacher/student/submitted-exams', fd);
      setSuccess(t('studentSpace.paperExam.sentSuccess'));
      setTimeout(() => setSuccess(''), 4000);
      setImages([]);
      setExamTitle('');
      const fresh = await api.get('/teacher/student/submitted-exams');
      setMyExams(fresh);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('studentSpace.paperExam.title')}</h3>
      </div>
      <p className="sub" style={{ marginBottom: 12 }}>
        {t('studentSpace.paperExam.intro')}
      </p>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <form onSubmit={submit} className="card-form">
        <div className="form-row">
          <div className="form-group grow">
            <label>{t('studentSpace.paperExam.examTitleLabel')}</label>
            <input
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder={t('studentSpace.paperExam.examTitlePlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('studentSpace.paperExam.subjectLabel')}</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECT_CODES.map((code) => (
                <option key={code} value={code}>{t(`studentSpace.paperExam.subjects.${code}`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>{t('studentSpace.paperExam.scannedPagesLabel', { n: images.length, max: MAX_PAGES })}</label>
          <div className="scan-actions">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple hidden
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
            <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()}>
              <span className="material-icons">photo_camera</span> {t('studentSpace.paperExam.scanCamera')}
            </button>
            <button type="button" className="btn" onClick={() => galleryRef.current?.click()}>
              <span className="material-icons">photo_library</span> {t('studentSpace.paperExam.uploadDevice')}
            </button>
          </div>
          {processing && <p className="muted">{t('studentSpace.paperExam.processing')}</p>}
        </div>

        {images.length > 0 && (
          <div className="scan-preview">
            {images.map((img, i) => (
              <div key={i} className="scan-thumb">
                <img src={img.preview} alt={t('studentSpace.paperExam.pageAlt', { n: i + 1 })} />
                <span className="scan-page-num">{i + 1}</span>
                <button type="button" className="scan-remove" onClick={() => removeImage(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={submitting || processing}>
          {submitting ? t('studentSpace.paperExam.submitting') : t('studentSpace.paperExam.submit')}
        </button>
      </form>

      <h4 style={{ marginTop: 28 }}>{t('studentSpace.paperExam.mySubmissions')}</h4>
      {myExams.length === 0 ? (
        <div className="empty">{t('studentSpace.paperExam.empty')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('studentSpace.paperExam.colExam')}</th>
                <th>{t('studentSpace.paperExam.colSubject')}</th>
                <th>{t('studentSpace.paperExam.colStatus')}</th>
                <th>{t('studentSpace.paperExam.colResult')}</th>
                <th>{t('studentSpace.paperExam.colFeedback')}</th>
                <th>{t('studentSpace.paperExam.colFile')}</th>
                <th>{t('studentSpace.paperExam.colDate')}</th>
              </tr>
            </thead>
            <tbody>
              {myExams.map((ex) => {
                const cls = STATUS_CLS[ex.status] || STATUS_CLS.SENT;
                return (
                  <tr key={ex.id}>
                    <td>{ex.examTitle}</td>
                    <td>{ex.subjectLabel}</td>
                    <td><span className={`badge ${cls}`}>{t(`studentSpace.paperExam.status.${ex.status || 'SENT'}`)}</span></td>
                    <td>{ex.score !== null && ex.score !== undefined ? `${ex.score} / 20` : t('studentSpace.paperExam.noValue')}</td>
                    <td>{ex.feedback || t('studentSpace.paperExam.noValue')}</td>
                    <td>
                      <a href={ex.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">{t('studentSpace.paperExam.viewPdf')}</a>
                    </td>
                    <td>{new Date(ex.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
