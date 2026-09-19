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
  { label: 'Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©', items: [
    { to: '', end: true, icon: 'analytics', label: 'ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø£Ø¯Ø§Ø¡', color: '#2563EB' },
  ] },
  { label: 'Ø§Ù„ØªØ®Ø·ÙŠØ· ÙˆØ§Ù„Ù…Ø­ØªÙˆÙ‰', items: [
    { to: 'lesson-plan', icon: 'calendar_month', label: 'Ø®Ø·Ø© Ø§Ù„Ø¯Ø±Ø³', color: '#10B981' },
    { to: 'plans', icon: 'event_note', label: 'Ø§Ù„Ø®Ø·Ø· Ø§Ù„Ø³Ù†ÙˆÙŠØ©', color: '#10B981' },
    { to: 'memos', icon: 'description', label: 'Ø§Ù„Ù…Ø°ÙƒØ±Ø§Øª', color: '#10B981' },
    { to: 'schedules', icon: 'calendar_view_week', label: 'Ø§Ù„Ø¬Ø¯Ø§ÙˆÙ„', color: '#10B981' },
    { to: 'class-subjects', icon: 'category', label: 'Ù…ÙˆØ§Ø¯ Ø§Ù„ÙØµÙˆÙ„', color: '#10B981' },
    { to: 'worksheets', icon: 'article', label: 'ØªÙ…Ø§Ø±ÙŠÙ†', color: '#10B981' },
    { to: 'resources', icon: 'folder_special', label: 'Ø§Ù„Ù…ÙˆØ§Ø±Ø¯', color: '#10B981' },
    { to: 'library', icon: 'local_library', label: 'Ø§Ù„Ù…ÙƒØªØ¨Ø©', color: '#10B981' },
  ] },
  { label: 'Ø§Ù„ØªÙ‚ÙŠÙŠÙ… ÙˆØ§Ù„Ù†ØªØ§Ø¦Ø¬', items: [
    { to: 'quizzes', icon: 'quiz', label: 'Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±Ø§Øª', color: '#E8A317' },
    { to: 'assignments', icon: 'assignment', label: 'Ø§Ù„ÙˆØ§Ø¬Ø¨Ø§Øª', color: '#E8A317' },
    { to: 'exams', icon: 'fact_check', label: 'Ø§Ù„Ø§Ù…ØªØ­Ø§Ù†Ø§Øª Ø§Ù„Ø±Ø³Ù…ÙŠØ©', color: '#E8A317' },
    { to: 'correction', icon: 'grading', label: 'Ø§Ù„ØªØµØ­ÙŠØ­', color: '#E8A317' },
    { to: 'results', icon: 'scoreboard', label: 'Ø§Ù„Ù†ØªØ§Ø¦Ø¬', color: '#E8A317' },
    { to: 'averages', icon: 'percent', label: 'Ø§Ù„Ù…Ø¹Ø¯Ù„Ø§Øª', color: '#E8A317' },
    { to: 'gradebook', icon: 'menu_book', label: 'Ø³Ø¬Ù„ Ø§Ù„Ø¯Ø±Ø¬Ø§Øª', color: '#E8A317' },
    { to: 'grades', icon: 'workspace_premium', label: 'Ø¯Ø±Ø¬Ø§Øª Ø§Ù„ÙØµÙˆÙ„', color: '#E8A317' },
    { to: 'analytics', icon: 'monitoring', label: 'Ø§Ù„ØªØ­Ù„ÙŠÙ„ ÙˆØ§Ù„ØªØµØ¯ÙŠØ±', color: '#E8A317' },
  ] },
  { label: 'Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© ÙˆØ§Ù„Ø£Ø¯ÙˆØ§Øª', items: [
    { to: 'lesson-progress', icon: 'trending_up', label: 'ØªÙ‚Ø¯Ù… Ø§Ù„Ø¯Ø±ÙˆØ³', color: '#06B6D4' },
    { to: 'notes', icon: 'rate_review', label: 'Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª', color: '#06B6D4' },
    { to: 'attendance', icon: 'event_available', label: 'Ø§Ù„Ø­Ø¶ÙˆØ± ÙˆØ§Ù„ØºÙŠØ§Ø¨', color: '#06B6D4' },
    { to: 'health', icon: 'favorite', label: 'Ø§Ù„Ø­Ø§Ù„Ø© Ø§Ù„ØµØ­ÙŠØ©', color: '#06B6D4' },
    { to: 'ai', icon: 'smart_toy', label: 'Ø±ÙÙŠÙ‚ÙŠ AI', color: '#06B6D4' },
    { to: 'live', icon: 'live_tv', label: 'Ø§Ù„Ø­ØµØµ Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø©', color: '#06B6D4' },
    { to: 'suggestions', icon: 'lightbulb', label: 'Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª Ø°ÙƒÙŠØ©', color: '#06B6D4' },
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
      <SpaceShell base="/teacher" title={t('teacherSpace.sidebarTitle') || 'ÙØ¶Ø§Ø¡ Ø§Ù„Ø£Ø³ØªØ§Ø°'} storageKey="rafiqi-teacher-sidebar" sections={TEACHER_GROUPS} hideThemeToggle>
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
