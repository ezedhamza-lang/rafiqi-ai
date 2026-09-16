import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import { Badge } from '../../components/ui/index.js';
import { getHomePath } from '../../roles.js';
import SpaceShell from '../../components/SpaceShell.jsx';

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

const TEACHER_GROUPS = [
  { label: 'الرئيسية', items: [
    { to: '', end: true, icon: 'analytics', label: 'تحليل الأداء', color: '#3b82f6' },
  ] },
  { label: 'التخطيط والإعداد', items: [
    { to: 'lesson-plan', icon: 'calendar_month', label: 'خطة الدرس', color: '#06b6d4' },
    { to: 'plans', icon: 'event_note', label: 'الخطط السنوية', color: '#0891b2' },
    { to: 'memos', icon: 'description', label: 'المذكرات', color: '#f59e0b' },
    { to: 'schedules', icon: 'calendar_view_week', label: 'الجداول', color: '#8b5cf6' },
  ] },
  { label: 'المواد والمحتوى', items: [
    { to: 'class-subjects', icon: 'category', label: 'مواد الفصول', color: '#8b5cf6' },
    { to: 'worksheets', icon: 'article', label: 'تمارين', color: '#a855f7' },
    { to: 'resources', icon: 'folder_special', label: 'الموارد', color: '#ec4899' },
    { to: 'library', icon: 'local_library', label: 'المكتبة', color: '#d946ef' },
  ] },
  { label: 'التقييم والاختبارات', items: [
    { to: 'quizzes', icon: 'quiz', label: 'الاختبارات', color: '#ef4444' },
    { to: 'assignments', icon: 'assignment', label: 'الواجبات', color: '#f97316' },
    { to: 'exams', icon: 'fact_check', label: 'الامتحانات الرسمية', color: '#dc2626' },
    { to: 'correction', icon: 'grading', label: 'التصحيح', color: '#f59e0b' },
  ] },
  { label: 'النتائج والتقارير', items: [
    { to: 'results', icon: 'scoreboard', label: 'النتائج', color: '#10b981' },
    { to: 'averages', icon: 'percent', label: 'المعدلات', color: '#14b8a6' },
    { to: 'gradebook', icon: 'menu_book', label: 'سجل الدرجات', color: '#059669' },
    { to: 'grades', icon: 'workspace_premium', label: 'درجات الفصول', color: '#047857' },
    { to: 'analytics', icon: 'monitoring', label: 'التحليل والتصدير', color: '#3b82f6' },
  ] },
  { label: 'المتابعة والتقدم', items: [
    { to: 'lesson-progress', icon: 'trending_up', label: 'تقدم الدروس', color: '#f59e0b' },
    { to: 'notes', icon: 'rate_review', label: 'الملاحظات', color: '#8b5cf6' },
    { to: 'attendance', icon: 'fact_check', label: 'الحضور والغياب', color: '#10b981' },
    { to: 'health', icon: 'favorite', label: 'الحالة الصحية', color: '#ef4444' },
  ] },
  { label: 'الأدوات الذكية', items: [
    { to: 'ai', icon: 'smart_toy', label: 'رفيقي AI', color: '#3b82f6' },
    { to: 'live', icon: 'live_tv', label: 'الحصص المباشرة', color: '#22c55e' },
    { to: 'suggestions', icon: 'lightbulb', label: 'اقتراحات ذكية', color: '#eab308' },
  ] },
];

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
      <SpaceShell base="/teacher" title={t('teacherSpace.sidebarTitle') || 'فضاء الأستاذ'} storageKey="rafiqi-teacher-sidebar" sections={TEACHER_GROUPS}>
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
      </SpaceShell>
    </div>
  );
}
