import { useState, useRef } from 'react';
import SvgArt from './SvgArt';

function normAns(s) {
  if (s == null) return '';
  return String(s).trim().replace(/\s+/g, ' ')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/،/g, ',').replace(/؛/g, ';').replace(/؟/g, '?').replace(/أ/g, 'ا').replace(/إ/g, 'ا').replace(/آ/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
}

function rich(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    return p;
  });
}

const PERIOD_NAMES = {
  1: 'الأولى', 2: 'الثانية', 3: 'الثالثة', 4: 'الرابعة', 5: 'الخامسة', 6: 'السادسة'
};

export default function AssessmentPaper({ lesson, answers, onAnswer, submitting, submitResult, onSubmit }) {
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const paperRef = useRef(null);

  const blocks = lesson.blocks || [];
  const passages = [];
  let current = null;
  let exNum = 0;

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    if (b.kind === 'concept' && b.title && b.title.includes('السند')) {
      if (current) passages.push(current);
      current = { passage: b, exercises: [] };
    } else if (['question', 'math-input', 'textarea', 'drawing', 'match-pairs', 'picture-choice'].includes(b.kind)) {
      exNum++;
      const ex = { ...b, _num: exNum, _blockIdx: bi };
      if (current) {
        current.exercises.push(ex);
      } else {
        if (!current) current = { passage: null, exercises: [] };
        current.exercises.push(ex);
      }
    }
  }
  if (current) passages.push(current);

  if (passages.length === 0) {
    const allEx = [];
    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];
      if (['question', 'math-input', 'textarea', 'drawing', 'match-pairs', 'picture-choice'].includes(b.kind)) {
        exNum++;
        allEx.push({ ...b, _num: exNum, _blockIdx: bi });
      }
    }
    if (allEx.length) passages.push({ passage: null, exercises: allEx });
  }

  const totalPoints = passages.reduce((sum, pg) =>
    sum + pg.exercises.reduce((s, ex) => s + (ex.points || 3), 0), 0
  );

  const handleOption = (blockId, idx) => onAnswer(blockId, idx);
  const handleText = (blockId, val) => onAnswer(blockId, val);

  return (
    <div className="assessment-paper-wrap" ref={paperRef}>
      <style>{`
        .assessment-paper-wrap {
          max-width: 800px;
          margin: 0 auto;
          background: #fff;
          direction: rtl;
          font-family: 'Amiri', 'Noto Naskh Arabic', 'Traditional Arabic', serif;
          color: #222;
        }
        .paper-header {
          border: 2px solid #333;
          border-bottom: none;
          padding: 12px 16px;
          margin-bottom: 0;
          background: #f9f9f9;
        }
        .paper-header-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          font-size: 14px;
          margin-bottom: 6px;
        }
        .paper-header-grid .field {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .paper-header-grid .field label {
          font-weight: bold;
          white-space: nowrap;
        }
        .paper-header-grid .field input {
          flex: 1;
          border: none;
          border-bottom: 1px solid #999;
          background: transparent;
          font-family: inherit;
          font-size: 14px;
          padding: 2px 4px;
          outline: none;
          direction: rtl;
        }
        .paper-title-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 2px solid #333;
          border-top: 2px solid #333;
          padding: 8px 16px;
          background: #e8f5e9;
          font-size: 15px;
          font-weight: bold;
        }
        .paper-title-bar .period-badge {
          background: #388e3c;
          color: #fff;
          padding: 2px 10px;
          border-radius: 4px;
          font-size: 13px;
        }
        .paper-body {
          border: 2px solid #333;
          border-top: none;
          padding: 20px 24px;
          min-height: 400px;
        }
        .paper-passage {
          background: #fffde7;
          border: 1px solid #e0d8a0;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 20px;
        }
        .paper-passage h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #555;
          font-family: 'Amiri', serif;
        }
        .paper-passage p {
          margin: 0;
          line-height: 2;
          font-size: 16px;
        }
        .paper-exercise {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          padding: 10px 12px;
          border: 1px dashed #ccc;
          border-radius: 6px;
          background: #fafafa;
          page-break-inside: avoid;
        }
        .paper-exercise .ex-num {
          min-width: 32px;
          height: 32px;
          background: #1976d2;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .paper-exercise .ex-content {
          flex: 1;
        }
        .paper-exercise .ex-content .ex-text {
          font-size: 15px;
          line-height: 1.8;
          margin-bottom: 8px;
        }
        .paper-exercise .ex-points {
          font-size: 12px;
          color: #888;
          white-space: nowrap;
          margin-top: 4px;
        }
        .paper-exercise .mcq-options {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .paper-exercise .mcq-options label {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 14px;
          border: 1px solid #ccc;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.15s;
          background: #fff;
        }
        .paper-exercise .mcq-options label:hover {
          border-color: #1976d2;
          background: #e3f2fd;
        }
        .paper-exercise .mcq-options label.selected {
          border-color: #1976d2;
          background: #1976d2;
          color: #fff;
        }
        .paper-exercise .mcq-options input[type="radio"] {
          display: none;
        }
        .paper-exercise .text-input {
          width: 100%;
          border: none;
          border-bottom: 2px solid #999;
          background: transparent;
          font-family: inherit;
          font-size: 16px;
          padding: 4px 8px;
          outline: none;
          direction: rtl;
          text-align: center;
          max-width: 200px;
        }
        .paper-exercise .text-input:focus {
          border-bottom-color: #1976d2;
        }
        .paper-exercise textarea {
          width: 100%;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-family: inherit;
          font-size: 14px;
          padding: 8px;
          resize: vertical;
          min-height: 60px;
          direction: rtl;
          outline: none;
        }
        .paper-exercise textarea:focus {
          border-color: #1976d2;
        }
        .paper-scoring {
          margin-top: 24px;
          border: 2px solid #333;
          border-radius: 6px;
          overflow: hidden;
        }
        .paper-scoring h4 {
          margin: 0;
          padding: 8px 12px;
          background: #f5f5f5;
          font-size: 14px;
          border-bottom: 1px solid #ccc;
        }
        .paper-scoring table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          text-align: center;
        }
        .paper-scoring th, .paper-scoring td {
          border: 1px solid #ccc;
          padding: 6px 8px;
        }
        .paper-scoring th {
          background: #f0f0f0;
          font-weight: bold;
        }
        .paper-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          padding-top: 12px;
          border-top: 1px dashed #ccc;
        }
        .paper-footer .signature {
          font-size: 14px;
          color: #666;
        }
        .paper-submit-section {
          margin-top: 24px;
          text-align: center;
          padding: 20px;
          background: #f1f8e9;
          border: 2px solid #66bb6a;
          border-radius: 8px;
        }
        .paper-submit-section h3 {
          margin: 0 0 8px;
          color: #2e7d32;
        }
        .paper-submit-section p {
          margin: 0 0 12px;
          color: #555;
          font-size: 14px;
        }
        .paper-submit-btn {
          background: #4caf50;
          color: #fff;
          border: none;
          padding: 12px 32px;
          border-radius: 6px;
          font-size: 16px;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s;
        }
        .paper-submit-btn:hover { background: #388e3c; }
        .paper-submit-btn:disabled { background: #aaa; cursor: not-allowed; }
        .paper-submit-result {
          margin-top: 12px;
          padding: 10px;
          border-radius: 6px;
          font-size: 14px;
        }
        .paper-submit-result.success { background: #e8f5e9; color: #2e7d32; }
        .paper-submit-result.error { background: #ffebee; color: #c62828; }
        .paper-art-container {
          display: flex;
          justify-content: center;
          margin: 8px 0;
        }
        @media print {
          .paper-submit-section { display: none; }
          .assessment-paper-wrap { border: none; }
        }
        @media (max-width: 600px) {
          .paper-header-grid { grid-template-columns: 1fr; }
          .paper-exercise { flex-direction: column; gap: 8px; }
          .paper-body { padding: 12px; }
        }
      `}</style>

      {/* Paper Header */}
      <div className="paper-header">
        <div className="paper-header-grid">
          <div className="field">
            <label>المادة: الرياضيات</label>
          </div>
          <div className="field">
            <label>المستوى: الأول الأساسي</label>
          </div>
          <div className="field">
            <label>الفترة: {PERIOD_NAMES[lesson.period] || lesson.period}</label>
          </div>
        </div>
        <div className="paper-header-grid">
          <div className="field">
            <label>الاسم واللقب:</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="..............."
            />
          </div>
          <div className="field">
            <label>القسم:</label>
            <input
              type="text"
              value={studentClass}
              onChange={(e) => setStudentClass(e.target.value)}
              placeholder="..............."
            />
          </div>
          <div className="field">
            <label>التاريخ:</label>
            <span style={{ borderBottom: '1px solid #999', minWidth: 100, display: 'inline-block', textAlign: 'center' }}>
              {new Date().toLocaleDateString('ar-TN')}
            </span>
          </div>
        </div>
      </div>

      {/* Title Bar */}
      <div className="paper-title-bar">
        <span>{lesson.title}</span>
        <span className="period-badge">الفترة {PERIOD_NAMES[lesson.period] || ''}</span>
      </div>

      {/* Paper Body */}
      <div className="paper-body">
        {passages.map((pg, pi) => (
          <div key={pi}>
            {pg.passage && (
              <div className="paper-passage">
                <h3>{pg.passage.title}</h3>
                {pg.passage.art && (
                  <div className="paper-art-container">
                    <SvgArt name={pg.passage.art} width={220} height={120} />
                  </div>
                )}
                <p>{rich(pg.passage.text)}</p>
              </div>
            )}

            {pg.exercises.map((ex) => {
              const blockId = `${lesson.id}-${ex._blockIdx}`;
              const savedVal = answers[blockId];

              return (
                <div key={ex._num} className="paper-exercise">
                  <div className="ex-num">{ex._num}</div>
                  <div className="ex-content">
                    <div className="ex-text">
                      {ex.title && <strong>{ex.title}:</strong>} {rich(ex.text)}
                    </div>
                    {ex.art && (
                      <div className="paper-art-container">
                        <SvgArt name={ex.art} width={200} height={100} />
                      </div>
                    )}

                    {/* MCQ */}
                    {ex.kind === 'question' && ex.options && (
                      <div className="mcq-options">
                        {ex.options.map((opt, oi) => (
                          <label key={oi} className={savedVal === oi ? 'selected' : ''}>
                            <input
                              type="radio"
                              name={`ex-${blockId}`}
                              checked={savedVal === oi}
                              onChange={() => handleOption(blockId, oi)}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Math Input / Fill blank */}
                    {(ex.kind === 'math-input' || (ex.kind === 'question' && !ex.options)) && (
                      <input
                        type="text"
                        className="text-input"
                        placeholder={ex.placeholder || '.............'}
                        value={savedVal || ''}
                        onChange={(e) => handleText(blockId, e.target.value)}
                      />
                    )}

                    {/* Textarea */}
                    {ex.kind === 'textarea' && (
                      <textarea
                        placeholder={ex.placeholder || 'اكتب إجابتك هنا...'}
                        value={savedVal || ''}
                        onChange={(e) => handleText(blockId, e.target.value)}
                        rows={3}
                      />
                    )}

                    {/* Drawing */}
                    {ex.kind === 'drawing' && (
                      <div className="paper-art-container">
                        <span style={{ fontSize: 13, color: '#888' }}>(يمكنك الرسم هنا)</span>
                      </div>
                    )}

                    {/* Match Pairs */}
                    {ex.kind === 'match-pairs' && ex.pairs && (
                      <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                        {ex.pairs.map((p, pi2) => (
                          <div key={pi2} style={{ marginBottom: 4 }}>
                            {p.from} ←→ {p.to}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ex-points">({ex.points || 3} ن.ن)</div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Empty fallback if no passages */}
        {passages.length === 0 && blocks.map((b, i) => {
          if (b.kind === 'concept') {
            return (
              <div key={i} className="paper-passage">
                {b.title && <h3>{b.title}</h3>}
                <p>{rich(b.text)}</p>
              </div>
            );
          }
          return null;
        })}

        {/* Scoring Grid */}
        <div className="paper-scoring">
          <h4>جدول التنقيط</h4>
          <table>
            <thead>
              <tr>
                <th>المعيار</th>
                <th>م.1</th>
                <th>م.2</th>
                <th>م.3</th>
                <th>م.4</th>
                <th>المجموع</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>إجمالي النقط</td>
                <td>/{Math.ceil(totalPoints * 0.25)}</td>
                <td>/{Math.ceil(totalPoints * 0.25)}</td>
                <td>/{Math.ceil(totalPoints * 0.25)}</td>
                <td>/{Math.ceil(totalPoints * 0.5)}</td>
                <td style={{ fontWeight: 'bold' }}>/{totalPoints}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>المحصلة النهائية</td>
                <td colSpan={5}></td>
                <td>/20</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="paper-footer">
          <span className="signature">توقيع التلميذ: ...................</span>
          <span className="signature">توقيع المعلّم: ...................</span>
        </div>
      </div>

      {/* Submit Section */}
      <div className="paper-submit-section">
        <h3>إرسال الاختبار للمعلّم</h3>
        <p>بعد إكمال جميع التمارين، اضغط على الزر أدناه لإرسال إجاباتك للمعلّم للتصحيح.</p>
        {studentName.trim() && (
          <p style={{ fontWeight: 'bold', color: '#2e7d32' }}>التلميذ: {studentName}</p>
        )}
        <button
          className="paper-submit-btn"
          onClick={() => onSubmit({ studentName, studentClass })}
          disabled={submitting}
        >
          <span className="material-icons" style={{ fontSize: 20 }}>send</span>
          {submitting ? 'جاري الإرسال...' : 'أرسل للمعلّم'}
        </button>
        {submitResult && (
          <div className={`paper-submit-result ${submitResult.success ? 'success' : 'error'}`}>
            {submitResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
