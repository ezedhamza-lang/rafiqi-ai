import { useState, useEffect, useCallback , lazy, Suspense} from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import { Badge } from '../../components/ui/index.js';
import { getHomePath } from '../../roles.js';
const UnitAnalysis = lazy(() => import('./UnitAnalysis.jsx'));
const Quizzes = lazy(() => import('./Quizzes.jsx'));
const OfficialExams = lazy(() => import('./OfficialExams.jsx'));
const Correction = lazy(() => import('./Correction.jsx'));
const Results = lazy(() => import('./Results.jsx'));
const Averages = lazy(() => import('./Averages.jsx'));
const Memos = lazy(() => import('./Memos.jsx'));
const Resources = lazy(() => import('./Resources.jsx'));
const LessonPlan = lazy(() => import('./LessonPlan.jsx'));
const AnnualPlans = lazy(() => import('./AnnualPlans.jsx'));
const TeacherAI = lazy(() => import('./TeacherAI.jsx'));
const Schedules = lazy(() => import('./Schedules.jsx'));
const Suggestions = lazy(() => import('./Suggestions.jsx'));
const ClassSubjects = lazy(() => import('./ClassSubjects.jsx'));
const Attendance = lazy(() => import('./Attendance.jsx'));
const HealthRecords = lazy(() => import('./HealthRecords.jsx'));
const Library = lazy(() => import('./Library.jsx'));
const Assignments = lazy(() => import('./Assignments.jsx'));
const Analytics = lazy(() => import('./Analytics.jsx'));
const LiveSessions = lazy(() => import('./LiveSessions.jsx'));
const TeacherGradebook = lazy(() => import('./TeacherGradebook.jsx'));
const TeacherLessonProgress = lazy(() => import('./TeacherLessonProgress.jsx'));
const TeacherNotes = lazy(() => import('./TeacherNotes.jsx'));
const TeacherWorksheets = lazy(() => import('./TeacherWorksheets.jsx'));
const ClassGrades = lazy(() => import('./ClassGrades.jsx'));

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
    return <Navigate to={getHomePath(user)} replace />;
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

        <div className="tab-content">
          <Suspense fallback={null}>
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
            <Route path="worksheets" element={<TeacherWorksheets />} />
            <Route path="suggestions" element={<Suggestions />} />
            <Route path="grades" element={<ClassGrades />} />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        </Suspense>
        </div>
      </div>
    </div>
  );
}
