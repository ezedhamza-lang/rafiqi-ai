import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/index.jsx';

const COLORS = ['#E8A317', '#ef4444', '#D97706', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000'];
const SIZES = [3, 6, 10, 16];

function DrawingCanvas({ onSave }) {
  const canvasRef = useRef(null);
  const [color, setColor] = useState('#E8A317');
  const [size, setSize] = useState(6);
  const [drawing, setDrawing] = useState(false);
  const lastPos = useRef(null);
  const { t } = useI18n();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDraw = (e) => {
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!drawing) return;
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { setDrawing(false); };

  const clear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const save = () => {
    const data = canvasRef.current.toDataURL('image/png');
    onSave({ type: 'drawing', data, timestamp: Date.now() });
    clear();
  };

  return (
    <div className="cp-draw">
      <canvas ref={canvasRef} width={600} height={400}
        className="cp-draw__canvas"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
      <div className="cp-draw__tools">
        <div className="cp-draw__colors">
          {COLORS.map(c => (
            <button key={c} className={`cp-color-btn ${color === c ? 'cp-color-btn--active' : ''}`}
              style={{ background: c }} onClick={() => setColor(c)}
              aria-label={t('studentSpace.portfolio.colorAria', { color: c })} />
          ))}
        </div>
        <div className="cp-draw__sizes">
          {SIZES.map(s => (
            <button key={s} className={`cp-size-btn ${size === s ? 'cp-size-btn--active' : ''}`}
              onClick={() => setSize(s)} aria-label={t('studentSpace.portfolio.sizeAria', { size: s })}>
              <span style={{ width: s, height: s, background: 'currentColor', borderRadius: '50%', display: 'block' }} />
            </button>
          ))}
        </div>
        <button className="cp-draw__clear" onClick={clear} aria-label={t('studentSpace.portfolio.clear')}>
          <span className="material-icons">delete</span>
        </button>
        <button className="cp-draw__save" onClick={save} aria-label={t('studentSpace.portfolio.save')}>
          <span className="material-icons">save</span>
        </button>
      </div>
    </div>
  );
}

function StoryWriter({ onSave }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const { t } = useI18n();

  const save = () => {
    if (!content.trim()) return;
    onSave({ type: 'story', title: title || t('studentSpace.portfolio.untitled'), content, timestamp: Date.now() });
    setTitle('');
    setContent('');
  };

  return (
    <div className="cp-story">
      <input className="cp-story__title" placeholder={t('studentSpace.portfolio.storyTitle')}
        value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="cp-story__content" placeholder={t('studentSpace.portfolio.storyContent')}
        value={content} onChange={e => setContent(e.target.value)} rows={8} />
      <button className="cp-story__save" onClick={save}>
        <span className="material-icons">save</span>
        {t('studentSpace.portfolio.saveStory')}
      </button>
    </div>
  );
}

function AudioRecorder({ onSave }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const { t } = useI18n();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      chunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
      };
      mediaRecorder.current.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      /* mic not available */
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
    }
    setRecording(false);
  };

  const save = () => {
    if (!audioUrl) return;
    onSave({ type: 'audio', title: title || t('studentSpace.portfolio.untitledAudio'), audioUrl, duration, timestamp: Date.now() });
    setAudioUrl(null);
    setTitle('');
    setDuration(0);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="cp-audio">
      <input className="cp-audio__title" placeholder={t('studentSpace.portfolio.audioTitle')}
        value={title} onChange={e => setTitle(e.target.value)} />
      <div className="cp-audio__controls">
        {!recording ? (
          <button className="cp-audio__start" onClick={startRecording}>
            <span className="material-icons">mic</span>
            {t('studentSpace.portfolio.startRec')}
          </button>
        ) : (
          <button className="cp-audio__stop" onClick={stopRecording}>
            <span className="material-icons">stop</span>
            {fmt(duration)}
          </button>
        )}
      </div>
      {audioUrl && (
        <div className="cp-audio__preview">
          <audio src={audioUrl} controls className="cp-audio__player" />
          <button className="cp-audio__save" onClick={save}>
            <span className="material-icons">save</span>
            {t('studentSpace.portfolio.saveAudio')}
          </button>
        </div>
      )}
    </div>
  );
}

function PortfolioGallery({ items, onDelete }) {
  const { t } = useI18n();
  if (!items || items.length === 0) {
    return <div className="cp-gallery__empty">{t('studentSpace.portfolio.empty')}</div>;
  }
  return (
    <div className="cp-gallery">
      {items.map((item, i) => (
        <div key={i} className="cp-gallery__item">
          <div className="cp-gallery__item-header">
            <span className="cp-gallery__item-type">
              {item.type === 'drawing' ? '🎨' : item.type === 'story' ? '📝' : '🎵'}
            </span>
            <span className="cp-gallery__item-date">
              {new Date(item.timestamp).toLocaleDateString('ar-TN', { month: 'short', day: 'numeric' })}
            </span>
            <button className="cp-gallery__delete" onClick={() => onDelete(i)} aria-label={t('studentSpace.portfolio.deleteWork')}>
              <span className="material-icons">close</span>
            </button>
          </div>
          {item.type === 'drawing' && <img src={item.data} alt="drawing" className="cp-gallery__img" />}
          {item.type === 'story' && (
            <div className="cp-gallery__story">
              <strong>{item.title}</strong>
              <p>{item.content}</p>
            </div>
          )}
          {item.type === 'audio' && (
            <div className="cp-gallery__audio">
              <span>{item.title}</span>
              <audio src={item.audioUrl} controls className="cp-audio__player" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StudentPortfolio() {
  const { t } = useI18n();
  const [tab, setTab] = useState('draw');
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rafiqi-portfolio') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('rafiqi-portfolio', JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item) => {
    setItems(prev => [item, ...prev]);
  }, []);

  const deleteItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="student-portfolio">
      <div className="cp-header" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
        <span className="material-icons cp-header__icon">palette</span>
        <div>
          <h2 className="cp-header__title">{t('studentSpace.portfolio.title')}</h2>
          <p className="cp-header__sub">{t('studentSpace.portfolio.subtitle')}</p>
        </div>
      </div>

      <div className="cp-tabs">
        <button className={`cp-tab ${tab === 'draw' ? 'cp-tab--active' : ''}`} onClick={() => setTab('draw')}>
          <span className="material-icons">brush</span>
          {t('studentSpace.portfolio.draw')}
        </button>
        <button className={`cp-tab ${tab === 'story' ? 'cp-tab--active' : ''}`} onClick={() => setTab('story')}>
          <span className="material-icons">edit_note</span>
          {t('studentSpace.portfolio.writeStory')}
        </button>
        <button className={`cp-tab ${tab === 'audio' ? 'cp-tab--active' : ''}`} onClick={() => setTab('audio')}>
          <span className="material-icons">mic</span>
          {t('studentSpace.portfolio.recordAudio')}
        </button>
        <button className={`cp-tab ${tab === 'gallery' ? 'cp-tab--active' : ''}`} onClick={() => setTab('gallery')}>
          <span className="material-icons">collections</span>
          {t('studentSpace.portfolio.myWorks')} ({items.length})
        </button>
      </div>

      <div className="cp-content">
        {tab === 'draw' && <DrawingCanvas onSave={addItem} />}
        {tab === 'story' && <StoryWriter onSave={addItem} />}
        {tab === 'audio' && <AudioRecorder onSave={addItem} />}
        {tab === 'gallery' && <PortfolioGallery items={items} onDelete={deleteItem} />}
      </div>
    </div>
  );
}
