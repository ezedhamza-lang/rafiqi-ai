export const SUBJECT_CODES = ['MATH', 'READING', 'SCIENCE', 'STORIES'];
export const QUESTION_TYPE_CODES = ['MCQ', 'TRUE_FALSE', 'ORDER', 'EXTRACT', 'FILL_BLANK'];

export const blankQuestion = (id) => ({
  id: `q${id}`,
  type: 'MCQ',
  prompt: '',
  points: 1,
  options: ['', '', '', ''],
  correctOption: '',
  correctAnswer: ''
});

export default function QuestionEditor({ questions, onChange, t, prefix }) {
  const add = () => {
    onChange([...questions, blankQuestion(questions.length + 1)]);
  };

  const update = (idx, patch) => {
    onChange(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  return (
    <div className="questions-editor">
      {questions.map((q, qi) => (
        <div key={q.id} className="question-editor">
          <div className="form-row">
            <div className="form-group">
              <label>{t(`${prefix}.questionTypeLabel`, { n: qi + 1 })}</label>
              <select value={q.type} onChange={(e) => update(qi, { type: e.target.value, correctOption: '', correctAnswer: '' })}>
                {QUESTION_TYPE_CODES.map((code) => (
                  <option key={code} value={code}>{t(`teacherSpace.common.questionTypes.${code}`)}</option>
                ))}
              </select>
            </div>
            <div className="form-group grow">
              <label>{t(`${prefix}.questionTextLabel`)}</label>
              <input required value={q.prompt} onChange={(e) => update(qi, { prompt: e.target.value })} placeholder={t(`${prefix}.questionTextPlaceholder`)} />
            </div>
            <div className="form-group small">
              <label>{t(`${prefix}.pointsLabel`)}</label>
              <input type="number" min="1" value={q.points} onChange={(e) => update(qi, { points: Number(e.target.value) })} />
            </div>
          </div>

          {q.type === 'MCQ' && (
            <div className="options-row">
              {q.options.map((opt, oi) => (
                <div key={oi} className="option-field">
                  <input value={opt} onChange={(e) => update(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })} placeholder={t(`${prefix}.optionPlaceholder`, { n: oi + 1 })} />
                  <label className="radio">
                    <input type="radio" name={`correct-${q.id}`} checked={q.correctOption === String(oi)} onChange={() => update(qi, { correctOption: String(oi) })} />
                    {t('teacherSpace.common.correctLabel')}
                  </label>
                </div>
              ))}
            </div>
          )}

          {q.type === 'TRUE_FALSE' && (
            <div className="form-row">
              <label className="radio">
                <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === 'TRUE'} onChange={() => update(qi, { correctAnswer: 'TRUE' })} />
                {t('teacherSpace.common.correctLabel')}
              </label>
              <label className="radio">
                <input type="radio" name={`tf-${q.id}`} checked={q.correctAnswer === 'FALSE'} onChange={() => update(qi, { correctAnswer: 'FALSE' })} />
                {t('time.falseLabel')}
              </label>
            </div>
          )}

          {q.type === 'ORDER' && (
            <div className="form-group">
              <label>{t(`${prefix}.orderLabel`)}</label>
              <textarea
                value={(q.orderItems || []).join('\n')}
                onChange={(e) => update(qi, { orderItems: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                placeholder={t('teacherSpace.common.orderPlaceholder')}
              />
            </div>
          )}

          {(q.type === 'EXTRACT' || q.type === 'FILL_BLANK') && (
            <div className="form-group">
              <label>{t(`${prefix}.correctAnswerLabel`)}</label>
              <input value={q.correctAnswer} onChange={(e) => update(qi, { correctAnswer: e.target.value })} placeholder={t(`${prefix}.correctAnswerPlaceholder`)} />
            </div>
          )}
        </div>
      ))}
      <div className="form-actions">
        <button type="button" className="btn" onClick={add}>{t(`${prefix}.addQuestion`)}</button>
      </div>
    </div>
  );
}
