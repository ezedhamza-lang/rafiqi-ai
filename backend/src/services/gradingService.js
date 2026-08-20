export const QUESTION_TYPES = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'TRUE_FALSE',
  ORDER: 'ORDER',
  EXTRACT: 'EXTRACT',
  FILL_BLANK: 'FILL_BLANK'
};

function normalize(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '')
    .toLowerCase();
}

function gradeQuestion(question, answer) {
  const type = question.type;
  const points = Number(question.points) || 1;
  let correct = false;

  switch (type) {
    case QUESTION_TYPES.MCQ:
      correct = String(answer ?? '') === String(question.correctOption ?? '');
      break;
    case QUESTION_TYPES.TRUE_FALSE:
      correct = String(answer ?? '').toUpperCase() === String(question.correctAnswer ?? '').toUpperCase();
      break;
    case QUESTION_TYPES.ORDER: {
      const expected = (question.orderItems || []).map((i) => normalize(i));
      const given = Array.isArray(answer) ? answer.map((a) => normalize(a)) : [];
      correct = expected.length > 0 && expected.length === given.length && expected.every((v, i) => v === given[i]);
      break;
    }
    case QUESTION_TYPES.EXTRACT:
    case QUESTION_TYPES.FILL_BLANK: {
      const expected = String(question.correctAnswer ?? '').split('|').map(normalize).filter(Boolean);
      correct = expected.some((v) => v === normalize(answer));
      break;
    }
    default:
      correct = false;
  }

  return {
    questionId: question.id,
    type,
    points,
    earned: correct ? points : 0,
    correct
  };
}

export function gradeQuiz(questions, answers = {}) {
  const graded = questions.map((q) => gradeQuestion(q, answers[q.id]));
  const totalPoints = graded.reduce((sum, g) => sum + g.points, 0);
  const score = graded.reduce((sum, g) => sum + g.earned, 0);
  const percent = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  return { graded, totalPoints, score, percent };
}
