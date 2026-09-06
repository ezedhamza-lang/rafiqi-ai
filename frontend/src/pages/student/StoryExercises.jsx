import { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/index.jsx';

function normAr(t) {
  return String(t ?? '')
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[«»""'()،,؛;.!؟?\[\]:-]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isCorrect(user, expected) {
  if (!user || !expected) return false;
  return normAr(user) === normAr(expected);
}

function extractTrueFalse(answer) {
  const n = normAr(answer);
  if (n.includes('خطا')) return 'FALSE';
  if (n.includes('صحيح') || n.includes('صح')) return 'TRUE';
  if (n.includes('❌') || n.includes('✘')) return 'FALSE';
  if (n.includes('✅') || n.includes('✔')) return 'TRUE';
  return null;
}

function ExerciseWrapper({ num, children }) {
  return (
    <div className="story-exercise">
      {num != null && <span className="exercise-num">{num}</span>}
      {children}
    </div>
  );
}

function CheckRow({ onCheck, showAnswer, answer, checked, correct }) {
  const { t } = useI18n();
  return (
    <div className="exercise-check-row">
      <button type="button" className="btn btn-sm" onClick={onCheck}>{t('studentSpace.storyExercises.check')}</button>
      {checked && (
        <span className={`exercise-feedback ${correct ? 'ok' : 'no'}`}>
          {correct ? t('studentSpace.storyExercises.correct') : t('studentSpace.storyExercises.incorrect')}
        </span>
      )}
      {showAnswer && <span className="exercise-answer">{t('studentSpace.storyExercises.answerLabel', { value: answer })}</span>}
    </div>
  );
}

function MCQExercise({ ex, num }) {
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const correct = sel != null && isCorrect(ex.options[sel], ex.answer);
  return (
    <ExerciseWrapper num={num}>
      <p className="exercise-q">{ex.q}</p>
      <div className="exercise-options">
        {ex.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={`exercise-option ${sel === i ? 'selected' : ''} ${checked && (i === sel ? (correct ? 'ok' : 'no') : isCorrect(opt, ex.answer) ? 'ok' : '')}`}
            onClick={() => { setSel(i); setChecked(false); }}
          >
            {opt}
          </button>
        ))}
      </div>
      <CheckRow
        onCheck={() => setChecked(true)}
        showAnswer={checked}
        answer={ex.answer}
        checked={checked}
        correct={correct}
      />
    </ExerciseWrapper>
  );
}

function TrueFalseExercise({ ex, num }) {
  const { t } = useI18n();
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(false);
  const expected = extractTrueFalse(ex.answer);
  const correct = sel != null && sel === expected;
  return (
    <ExerciseWrapper num={num}>
      <p className="exercise-q">{ex.q}</p>
      <div className="exercise-options tf-options">
        <button
          type="button"
          className={`exercise-option ${sel === 'TRUE' ? 'selected' : ''} ${checked && (sel === 'TRUE' ? (correct ? 'ok' : 'no') : expected === 'TRUE' ? 'ok' : '')}`}
          onClick={() => { setSel('TRUE'); setChecked(false); }}
        >{t('studentSpace.storyExercises.trueOption')}</button>
        <button
          type="button"
          className={`exercise-option ${sel === 'FALSE' ? 'selected' : ''} ${checked && (sel === 'FALSE' ? (correct ? 'ok' : 'no') : expected === 'FALSE' ? 'ok' : '')}`}
          onClick={() => { setSel('FALSE'); setChecked(false); }}
        >{t('studentSpace.storyExercises.falseOption')}</button>
      </div>
      <CheckRow
        onCheck={() => setChecked(true)}
        showAnswer={checked}
        answer={ex.answer}
        checked={checked}
        correct={correct}
      />
    </ExerciseWrapper>
  );
}

function FillExercise({ ex, num }) {
  const { t } = useI18n();
  const blanks = (ex.q || '').split('___').length - 1;
  const expectedParts = (ex.answer || '').split('/').map((s) => s.trim()).filter(Boolean);
  const multi = blanks > 1 && expectedParts.length === blanks;
  const [val, setVal] = useState('');
  const [vals, setVals] = useState(expectedParts.map(() => ''));
  const [checked, setChecked] = useState(false);

  if (multi) {
    const correct = checked && expectedParts.every((p, i) => matchAr(normAr(vals[i]), normAr(p)));
    const qParts = (ex.q || '').split('___');
    return (
      <ExerciseWrapper num={num}>
        <p className="exercise-q">
          {qParts.map((part, i) => (
            <span key={i}>
              {part}
              {i < qParts.length - 1 && (
                <input
                  value={vals[i]}
                  onChange={(e) => {
                    const next = [...vals];
                    next[i] = e.target.value;
                    setVals(next);
                    setChecked(false);
                  }}
                  className={`exercise-inline-input ${checked ? (matchAr(normAr(vals[i]), normAr(expectedParts[i])) ? 'ok' : 'no') : ''}`}
                />
              )}
            </span>
          ))}
        </p>
        <CheckRow
          onCheck={() => setChecked(true)}
          showAnswer={checked}
          answer={ex.answer}
          checked={checked}
          correct={correct}
        />
      </ExerciseWrapper>
    );
  }

  const correct = isCorrect(val, ex.answer);
  const alternatives = (ex.answer || '').split('/').map((s) => s.trim()).filter(Boolean);
  const correctAny = alternatives.length > 1 && alternatives.some((a) => matchAr(normAr(val), normAr(a)));
  const finalCorrect = alternatives.length > 1 && !ex.q.includes('___') ? correctAny : correct;
  return (
    <ExerciseWrapper num={num}>
      <p className="exercise-q">{ex.q}</p>
      <div className="exercise-fill">
        <input
          value={val}
          onChange={(e) => { setVal(e.target.value); setChecked(false); }}
          placeholder={t('studentSpace.storyExercises.fillPlaceholder')}
          className={`exercise-input ${checked ? (finalCorrect ? 'ok' : 'no') : ''}`}
        />
      </div>
      <CheckRow
        onCheck={() => setChecked(true)}
        showAnswer={checked}
        answer={ex.answer}
        checked={checked}
        correct={finalCorrect}
      />
    </ExerciseWrapper>
  );
}

function OrderExercise({ ex, num }) {
  const { t } = useI18n();
  const [order, setOrder] = useState(ex.content || []);
  const [checked, setChecked] = useState(false);
  const move = (i, dir) => {
    const arr = [...order];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setOrder(arr);
    setChecked(false);
  };
  const expectedOrder = (ex.answer || '').split(/[→↔←]/).map((s) => normAr(s));
  const correct = checked && order.length === expectedOrder.length && order.every((o, i) => {
    const a = normAr(o);
    const b = expectedOrder[i];
    return a === b || (a && b && (a.startsWith(b) || b.startsWith(a)));
  });
  return (
    <ExerciseWrapper num={num}>
      <p className="exercise-q">{ex.q}</p>
      <p className="exercise-hint">{t('studentSpace.storyExercises.orderHint')}</p>
      <div className="exercise-order">
        {order.map((item, i) => (
          <div key={i} className="exercise-order-item">
            <span className="order-idx">{i + 1}</span>
            <span className="order-text">{item}</span>
            <span className="order-btns">
              <button type="button" className="btn btn-sm" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="btn btn-sm" disabled={i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
            </span>
          </div>
        ))}
      </div>
      <CheckRow
        onCheck={() => setChecked(true)}
        showAnswer={checked}
        answer={ex.answer}
        checked={checked}
        correct={correct}
      />
    </ExerciseWrapper>
  );
}

function matchAr(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function MatchExercise({ ex, num }) {
  const { t } = useI18n();
  const left = ex.left || [];
  const right = ex.right || [];
  const answerPairs = (ex.answer || '')
    .split('/')
    .map((part) => part.split(/[←↔]/).map((s) => normAr(s.trim())))
    .filter((p) => p.length === 2);

  const hasStructured = left.length > 0 && right.length > 0;
  const half = ex.content ? Math.floor(ex.content.length / 2) : 0;
  const hasBothHalves = ex.content && ex.content.length % 2 === 0 && ex.content.length === answerPairs.length * 2;
  const leftOnly = ex.content && ex.content.length > 0 && !hasBothHalves;
  const showPlain = !hasStructured && !hasBothHalves && !leftOnly;

  const [selL, setSelL] = useState(null);
  const [selR, setSelR] = useState(null);
  const [matched, setMatched] = useState([]);
  const [checked, setChecked] = useState(false);
  const [fills, setFills] = useState(() => (ex.content || []).map(() => ''));

  if (showPlain) {
    return (
      <ExerciseWrapper num={num}>
        <p className="exercise-q">{ex.q}</p>
        <p className="exercise-content-list">{(ex.content || []).join('  /  ')}</p>
        <div className="exercise-answer-block"><strong>{t('studentSpace.storyExercises.answerBold')}</strong> {ex.answer}</div>
      </ExerciseWrapper>
    );
  }

  if (leftOnly) {
    const colL = ex.content;
    const expectedFor = (c) => {
      const cn = normAr(c);
      const pair = answerPairs.find(([ea, eb]) => matchAr(cn, ea) || matchAr(cn, eb));
      if (!pair) return null;
      return matchAr(cn, pair[0]) ? pair[1] : pair[0];
    };
    const correct = checked && colL.every((c, i) => {
      const exp = expectedFor(c);
      return exp != null && matchAr(normAr(fills[i] ?? ''), exp);
    });
    return (
      <ExerciseWrapper num={num}>
        <p className="exercise-q">{ex.q}</p>
        <p className="exercise-hint">{t('studentSpace.storyExercises.matchFillHint')}</p>
        {colL.map((c, i) => (
          <div key={i} className="match-fill-row">
            <span className="classify-item">{c}</span>
            <input
              value={fills[i] ?? ''}
              onChange={(e) => {
                const next = [...fills];
                next[i] = e.target.value;
                setFills(next);
                setChecked(false);
              }}
              placeholder={t('studentSpace.storyExercises.matchFillPlaceholder')}
              className={`exercise-input match-fill-input ${checked ? (expectedFor(c) && matchAr(normAr(fills[i]), expectedFor(c)) ? 'ok' : 'no') : ''}`}
            />
          </div>
        ))}
        <CheckRow
          onCheck={() => setChecked(true)}
          showAnswer={checked}
          answer={ex.answer}
          checked={checked}
          correct={correct}
        />
      </ExerciseWrapper>
    );
  }

  const colL = hasStructured ? left : ex.content.slice(0, half);
  const colR = hasStructured ? right : ex.content.slice(half);

  const tapL = (i) => {
    if (matched.some((m) => m[0] === i)) return;
    setSelL(i);
    if (selR != null) {
      setMatched([...matched, [i, selR]]);
      setSelL(null); setSelR(null);
    }
  };
  const tapR = (i) => {
    if (matched.some((m) => m[1] === i)) return;
    setSelR(i);
    if (selL != null) {
      setMatched([...matched, [selL, i]]);
      setSelL(null); setSelR(null);
    }
  };

  const correct = checked && matched.length === answerPairs.length && matched.every(([a, b]) =>
    answerPairs.some(([ea, eb]) =>
      (matchAr(normAr(colL[a]), ea) && matchAr(normAr(colR[b]), eb)) ||
      (matchAr(normAr(colL[a]), eb) && matchAr(normAr(colR[b]), ea))
    )
  );

  return (
    <ExerciseWrapper num={num}>
      <p className="exercise-q">{ex.q}</p>
      <p className="exercise-hint">{t('studentSpace.storyExercises.matchHint')}</p>
      <div className="exercise-match">
        <div className="match-col">
          {colL.map((it, i) => (
            <button
              key={i}
              type="button"
              className={`match-item ${selL === i ? 'selected' : ''} ${matched.some((m) => m[0] === i) ? 'done' : ''}`}
              onClick={() => tapL(i)}
            >{it}</button>
          ))}
        </div>
        <div className="match-col">
          {colR.map((it, i) => (
            <button
              key={i}
              type="button"
              className={`match-item ${selR === i ? 'selected' : ''} ${matched.some((m) => m[1] === i) ? 'done' : ''}`}
              onClick={() => tapR(i)}
            >{it}</button>
          ))}
        </div>
      </div>
      {matched.length > 0 && (
        <div className="match-pairs">
          {matched.map(([a, b], i) => (
            <span key={i} className="match-pair">{colL[a]} ← {colR[b]}</span>
          ))}
        </div>
      )}
      <CheckRow
        onCheck={() => setChecked(true)}
        showAnswer={checked}
        answer={ex.answer}
        checked={checked}
        correct={correct}
      />
    </ExerciseWrapper>
  );
}

function parseClassify(answer) {
  const cats = [];
  const itemCat = {};
  const allMatch = (answer || '').trim().match(/^كُلُّهَا\s+(.+)$/);
  if (allMatch) {
    const cat = allMatch[1].trim();
    cats.push(cat);
    return { cats, itemCat, allInOne: cat };
  }
  (answer || '').split('/').forEach((part) => {
    const p = part.trim();
    if (!p) return;
    let items = null;
    let cat = null;
    const paren = p.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (paren) {
      items = paren[1];
      cat = paren[2].trim();
    } else {
      const colon = p.match(/^([^:]+):\s*(.+)$/);
      if (colon) {
        items = colon[2];
        cat = colon[1].trim();
      }
    }
    if (cat && items) {
      const list = items.split(/[،,]\s*|(?:\s*و\s*)/).map((s) => s.trim()).filter(Boolean);
      if (list.length > 0 && !cats.includes(cat)) cats.push(cat);
      list.forEach((it) => {
        const n = normAr(it);
        if (n && itemCat[n] == null) itemCat[n] = cat;
      });
    }
  });
  return { cats, itemCat, allInOne: null };
}

function ClassifyExercise({ ex, num }) {
  const { t } = useI18n();
  const content = ex.content || [];
  const { cats, itemCat, allInOne } = useMemo(() => parseClassify(ex.answer), [ex.answer]);
  const [assign, setAssign] = useState({});
  const [checked, setChecked] = useState(false);

  const catOf = (c) => {
    if (allInOne) return allInOne;
    const cn = normAr(c);
    if (itemCat[cn] != null) return itemCat[cn];
    const found = Object.entries(itemCat).find(([k]) => cn && k && (cn.startsWith(k) || k.startsWith(cn) || cn.includes(k) || k.includes(cn)));
    return found ? found[1] : null;
  };

  const correct = checked && content.every((c) => assign[c] && catOf(c) && normAr(assign[c]) === normAr(catOf(c)));

  if (cats.length === 0 || content.some((c) => catOf(c) == null)) {
    return (
      <ExerciseWrapper num={num}>
        <p className="exercise-q">{ex.q}</p>
        <p className="exercise-content-list">{(content || []).join('  /  ')}</p>
        <div className="exercise-answer-block"><strong>{t('studentSpace.storyExercises.answerBold')}</strong> {ex.answer}</div>
      </ExerciseWrapper>
    );
  }

  return (
    <ExerciseWrapper num={num}>
      <p className="exercise-q">{ex.q}</p>
      {content.map((c, i) => (
        <div key={i} className="classify-row">
          <span className="classify-item">{c}</span>
          <select className="classify-select" value={assign[c] || ''} onChange={(e) => { setAssign({ ...assign, [c]: e.target.value }); setChecked(false); }}>
            <option value="">{t('studentSpace.storyExercises.chooseCategory')}</option>
            {cats.map((ct, j) => <option key={j} value={ct}>{ct}</option>)}
          </select>
        </div>
      ))}
      <CheckRow
        onCheck={() => setChecked(true)}
        showAnswer={checked}
        answer={ex.answer}
        checked={checked}
        correct={correct}
      />
    </ExerciseWrapper>
  );
}

export default function StoryExercises({ exercises, activities, questions, matchPairs }) {
  const { t } = useI18n();
  const items = [];
  if (Array.isArray(exercises)) {
    exercises.forEach((ex, i) => {
      const type = ex.type || '';
      let node = null;
      if (type.includes('اختيار من متعدد') && Array.isArray(ex.options) && ex.options.length > 0) node = <MCQExercise key={i} ex={ex} num={i + 1} />;
      else if (type.includes('صح أو خطأ') || type.includes('صحيح') || type.includes('خطأ')) node = <TrueFalseExercise key={i} ex={ex} num={i + 1} />;
      else if (type.includes('مطابقة') || ex.left || (Array.isArray(ex.content) && ex.content.length > 2 && (ex.answer || '').includes('←'))) node = <MatchExercise key={i} ex={ex} num={i + 1} />;
      else if (type.includes('ترتيب') && Array.isArray(ex.content)) node = <OrderExercise key={i} ex={ex} num={i + 1} />;
      else if (type.includes('تصنيف') && Array.isArray(ex.content)) node = <ClassifyExercise key={i} ex={ex} num={i + 1} />;
      else if (type.includes('تكميل') || type.includes('تصريف') || type.includes('قواعد') || type.includes('فهم') || type.includes('وعي صوتي') || type.includes('لغة') || type.includes('استخراج') || type.includes('أكمل')) node = <FillExercise key={i} ex={ex} num={i + 1} />;
      else if (ex.options && ex.options.length > 0) node = <MCQExercise key={i} ex={ex} num={i + 1} />;
      else if (ex.q) node = <FillExercise key={i} ex={ex} num={i + 1} />;
      if (node) items.push(node);
    });
  }

  if (Array.isArray(activities)) {
    const byCat = {};
    activities.forEach((a) => {
      const cat = a.category || t('studentSpace.storyExercises.defaultActivityCategory');
      (byCat[cat] = byCat[cat] || []).push(a);
    });
    let n = items.length;
    Object.entries(byCat).forEach(([cat, acts]) => {
      items.push(
        <div key={`cat-${cat}`} className="activity-cat">
          <h5 className="activity-cat-title">{cat}</h5>
          {acts.map((a, i) => (
            <ActivityItem key={i} a={a} num={++n} />
          ))}
        </div>
      );
    });
  }

  if (Array.isArray(questions)) {
    questions.forEach((q, i) => {
      const item = { q: q.q || q.question, answer: q.a || q.answer || '', options: q.options };
      items.push(
        <MCQExercise
          key={`q-${i}`}
          ex={item}
          num={items.length + 1}
        />
      );
    });
  }

  if (Array.isArray(matchPairs) && matchPairs.length > 0) {
    const left = matchPairs.map((p) => p.left);
    const right = matchPairs.map((p) => p.right);
    const answer = matchPairs.map((p) => `${p.left} ↔ ${p.right}`).join(' / ');
    items.push(
      <MatchExercise
        key="mp"
        num={items.length + 1}
        ex={{ q: t('studentSpace.storyExercises.defaultMatchQuestion'), left, right, answer, type: 'تمرين مطابقة' }}
      />
    );
  }

  return (
    <div className="story-exercises">
      <h4 className="story-exercises-title">{t('studentSpace.storyExercises.title')}</h4>
      {items}
    </div>
  );
}

function ActivityItem({ a, num }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  return (
    <div className="story-exercise">
      <span className="exercise-num">{num}</span>
      <p className="exercise-q">{a.text}</p>
      {a.answer && (
        <div className="exercise-check-row">
          <button type="button" className="btn btn-sm" onClick={() => setShow(!show)}>{show ? t('studentSpace.storyExercises.hideAnswer') : t('studentSpace.storyExercises.showAnswer')}</button>
          {show && <span className="exercise-answer">{t('studentSpace.storyExercises.answerLabel', { value: a.answer })}</span>}
        </div>
      )}
    </div>
  );
}
