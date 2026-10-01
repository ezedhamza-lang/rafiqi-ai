import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

let cached = null;
let inflight = null;

export function useStudentLevel() {
  const [level, setLevel] = useState(cached);

  useEffect(() => {
    if (cached) {
      setLevel(cached);
      return;
    }
    if (!inflight) {
      inflight = api
        .get('/student/profile')
        .then((p) => {
          // المعرّف وحده: اسم المستوى الخام ليس معرّف سنة، وكل المستهلكين
          // (الكتب/التوافق/البطاقات/القصص/الفيديوهات) يقارنون gradeId —
          // إرجاع الاسم الخام كان يفرّغ القوائم في بعض الأقسام.
          cached = p?.canSeeAllGrades ? null : (p?.gradeId || null);
          return cached;
        })
        .catch(() => {
          cached = null;
          return null;
        });
    }
    inflight.then(setLevel);
  }, []);

  return level;
}