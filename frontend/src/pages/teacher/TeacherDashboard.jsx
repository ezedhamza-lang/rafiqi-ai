import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import { Badge } from '../../components/ui/index.js';
import { getHomePath } from '../../roles.js';
import SpaceShell from '../../components/SpaceShell.jsx';
import PromoCarousel from '../../components/PromoCarousel.jsx';

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
    { to: '', end: true, icon: 'analytics', label: 'تحليل الأداء', color: '#2563EB' },
  ] },
  { label: 'التخطيط والمحتوى', items: [
    { to: 'lesson-plan', icon: 'calendar_month', label: 'خطة الدرس', color: '#10B981' },
    { to: 'plans', icon: 'event_note', label: 'الخطط السنوية', color: '#10B981' },
    { to: 'memos', icon: 'description', label: 'المذكرات', color: '#10B981' },
    { to: 'schedules', icon: 'calendar_view_week', label: 'الجداول', color: '#10B981' },
    { to: 'class-subjects', icon: 'category', label: 'مواد الفصول', color: '#10B981' },
    { to: 'worksheets', icon: 'article', label: 'تمارين', color: '#10B981' },
    { to: 'resources', icon: 'folder_special', label: 'الموارد', color: '#10B981' },
    { to: 'library', icon: 'local_library', label: 'المكتبة', color: '#10B981' },
  ] },
  { label: 'التقييم والنتائج', items: [
    { to: 'quizzes', icon: 'quiz', label: 'الاختبارات', color: '#E8A317' },
    { to: 'assignments', icon: 'assignment', label: 'الواجبات', color: '#E8A317' },
    { to: 'exams', icon: 'fact_check', label: 'الامتحانات الرسمية', color: '#E8A317' },
    { to: 'correction', icon: 'grading', label: 'التصحيح', color: '#E8A317' },
    { to: 'results', icon: 'scoreboard', label: 'النتائج', color: '#E8A317' },
    { to: 'averages', icon: 'percent', label: 'المعدلات', color: '#E8A317' },
    { to: 'gradebook', icon: 'menu_book', label: 'سجل الدرجات', color: '#E8A317' },
    { to: 'grades', icon: 'workspace_premium', label: 'درجات الفصول', color: '#E8A317' },
    { to: 'analytics', icon: 'monitoring', label: 'التحليل والتصدير', color: '#E8A317' },
  ] },
  { label: 'المتابعة والأدوات', items: [
    { to: 'lesson-progress', icon: 'trending_up', label: 'تقدم الدروس', color: '#06B6D4' },
    { to: 'notes', icon: 'rate_review', label: 'الملاحظات', color: '#06B6D4' },
    { to: 'attendance', icon: 'event_available', label: 'الحضور والغياب', color: '#06B6D4' },
    { to: 'health', icon: 'favorite', label: 'الحالة الصحية', color: '#06B6D4' },
    { to: 'ai', icon: 'smart_toy', label: 'رفيقي AI', color: '#06B6D4' },
    { to: 'live', icon: 'live_tv', label: 'الحصص المباشرة', color: '#06B6D4' },
    { to: 'suggestions', icon: 'lightbulb', label: 'اقتراحات ذكية', color: '#06B6D4' },
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
      <SpaceShell base="/teacher" title={t('teacherSpace.sidebarTitle') || 'فضاء الأستاذ'} storageKey="rafiqi-teacher-sidebar" sections={TEACHER_GROUPS} hideThemeToggle>
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

        <PromoCarousel slides={[
          { key: 's1', image: '/tea-classroom.webp', tone: 'navy', title: t('teacherSpace.promo.s1t'), subtitle: t('teacherSpace.promo.s1s') },
          { key: 's2', image: '/tea-analytics.webp', tone: 'blue', title: t('teacherSpace.promo.s2t'), subtitle: t('teacherSpace.promo.s2s') },
          { key: 's3', image: '/tea-memo.webp', tone: 'gold', title: t('teacherSpace.promo.s3t'), subtitle: t('teacherSpace.promo.s3s') }
        ]} />

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
