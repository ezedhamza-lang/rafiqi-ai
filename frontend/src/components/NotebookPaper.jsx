import { useRef, useEffect, useState } from 'react';

export default function NotebookPaper({ hint, onSave, height = 220 }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  const drawGrid = (ctx, w, h) => {
    // white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    // light blue horizontal lines (like seyès)
    ctx.strokeStyle = '#a9c4f5';
    ctx.lineWidth = 1;
    for (let y = 24; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      // thinner intermediate line
      ctx.strokeStyle = '#d6e4ff';
      ctx.beginPath();
      ctx.moveTo(0, y - 12);
      ctx.lineTo(w, y - 12);
      ctx.stroke();
      ctx.strokeStyle = '#a9c4f5';
    }
    // vertical lines faint
    ctx.strokeStyle = '#d6e4ff';
    for (let x = 48; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // red margin
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(44, 0);
    ctx.lineTo(44, h);
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    drawGrid(ctx, rect.width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 3;
  }, [height]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const end = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    if (onSave && hasInk) onSave(canvasRef.current.toDataURL('image/png'));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, height);
    drawGrid(ctx, rect.width, height);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasInk(false);
  };

  return (
    <div className="notebook-paper-wrap">
      {hint && <div className="notebook-hint">{hint}</div>}
      <div className="notebook-paper">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${height}px`, touchAction: 'none', cursor: 'crosshair', display: 'block' }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="notebook-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={clear}>
          <span className="material-icons" style={{ fontSize: 16 }}>delete</span> امسح
        </button>
        {hasInk && <span className="notebook-saved">✓ تمت الكتابة</span>}
      </div>
    </div>
  );
}
