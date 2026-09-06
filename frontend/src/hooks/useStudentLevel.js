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
          cached = p?.canSeeAllGrades ? null : (p?.gradeId || p?.studentLevel || null);
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