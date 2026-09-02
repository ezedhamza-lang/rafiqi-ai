import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import { Badge } from '../../components/ui/index.js';
import UnitAnalysis from './UnitAnalysis.jsx';
import Quizzes from './Quizzes.jsx';
import OfficialExams from './OfficialExams.jsx';
import Correction from './Correction.jsx';
import Results from './Results.jsx';
import Averages from './Averages.jsx';
import Memos from './Memos.jsx';
import Resources from './Resources.jsx';
import LessonPlan from './LessonPlan.jsx';
import AnnualPlans from './AnnualPlans.jsx';
import TeacherAI from './TeacherAI.jsx';
import Schedules from './Schedules.jsx';
import Suggestions from './Suggestions.jsx';
import ClassSubjects from './ClassSubjects.jsx';
import Attendance from './Attendance.jsx';
import HealthRecords from './HealthRecords.jsx';
import Library from './Library.jsx';
import Assignments from './Assignments.jsx';
import Analytics from './Analytics.jsx';
import LiveSessions from './LiveSessions.jsx';
import TeacherGradebook from './TeacherGradebook.jsx';
import TeacherLessonProgress from './TeacherLessonProgress.jsx';
import TeacherNotes from './TeacherNotes.jsx';
import CopilotCard from '../../components/CopilotCard.jsx';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [classes, setClasses] = useState([]);
  const [quizCount, setQuizCount] = useState(0);
  const [memoCount, setMemoCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [cls, quizzes, memos] = await Promise.all([
        api.get('/teacher/classes'),
        api.get('/teacher/quizzes'),
        api.get('/teacher/memos')
      ]);
      setClasses(cls);
      setQuizCount(quizzes.length);
      setMemoCount(memos.length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || user.role !== 'TEACHER') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="teacher-space">
      <div className="container">
        <div className="space-head">
          <div>
            <h2>{t('teacherSpace.title')}</h2>
            <p className="sub">
              {t('teacherSpace.welcome', { firstName: user.firstName, lastName: user.lastName, count: classes.length })}
            </p>
          </div>
          <div className="space-stats">
            <Badge variant="info" icon="quiz">{t('teacherSpace.quizCount', { n: quizCount })}</Badge>
            <Badge variant="accent" icon="description">{t('teacherSpace.memoCount', { n: memoCount })}</Badge>
          </div>
        </div>

        <CopilotCard />

        <div className="tab-content">
          <Routes>
            <Route index element={<UnitAnalysis classes={classes} />} />
            <Route path="quizzes" element={<Quizzes classes={classes} onChanged={load} />} />
            <Route path="assignments" element={<Assignments classes={classes} onChanged={load} />} />
            <Route path="analytics" element={<Analytics classes={classes} onChanged={load} />} />
            <Route path="exams" element={<OfficialExams classes={classes} />} />
            <Route path="correction" element={<Correction />} />
            <Route path="class-subjects" element={<ClassSubjects classes={classes} />} />
            <Route path="results" element={<Results />} />
            <Route path="averages" element={<Averages />} />
            <Route path="gradebook" element={<TeacherGradebook />} />
            <Route path="lesson-progress" element={<TeacherLessonProgress />} />
            <Route path="notes" element={<TeacherNotes />} />
            <Route path="memos" element={<Memos onChanged={load} />} />
            <Route path="resources" element={<Resources />} />
            <Route path="library" element={<Library />} />
            <Route path="lesson-plan" element={<LessonPlan />} />
            <Route path="plans" element={<AnnualPlans />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="health" element={<HealthRecords />} />
            <Route path="ai" element={<TeacherAI />} />
            <Route path="schedules" element={<Schedules classes={classes} />} />
            <Route path="live" element={<LiveSessions />} />
            <Route path="suggestions" element={<Suggestions />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
