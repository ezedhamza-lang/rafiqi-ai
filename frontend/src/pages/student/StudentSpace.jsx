import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getHomePath } from '../../roles.js';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import SpaceShell from '../../components/SpaceShell.jsx';
import StudentQuizzes from './StudentQuizzes.jsx';
import StudentOfficialExams from './StudentOfficialExams.jsx';
import StudentBooks from './StudentBooks.jsx';
import StudentVideos from './StudentVideos.jsx';
import StudentAdaptive from './StudentAdaptive.jsx';
import StudentLearningPlan from './StudentLearningPlan.jsx';
import StudentStories from './StudentStories.jsx';
import StudentTwin from './StudentTwin.jsx';
import AskRefeeqi from './AskRefeeqi.jsx';
import StudentSchedule from './StudentSchedule.jsx';
import StudentProfile from './StudentProfile.jsx';
import StudentSubjects from './StudentSubjects.jsx';
import PlayZone from './PlayZone.jsx';
import PaperExamScan from './PaperExamScan.jsx';
import StudentAssignments from './StudentAssignments.jsx';
import StudentLiveSessions from './StudentLiveSessions.jsx';
import StudentDailyRoutine from './StudentDailyRoutine.jsx';
import StudentFlashcards from './StudentFlashcards.jsx';
import SchoolCalendar from '../../components/SchoolCalendar.jsx';

export default function StudentSpace() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/student/profile');
      setProfile(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || user.role !== 'STUDENT') {
    return <Navigate to={getHomePath(user)} replace />;
  }

  const L = (k) => t(`studentSpace.tabs.${k}`);
  const DECOR = [
    { e: '⭐', top: '8%',  is: '6%',  s: 26, d: '0s' },
    { e: '✨', top: '16%', is: '88%', s: 22, d: '1.2s' },
    { e: '🌸', top: '30%', is: '4%',  s: 30, d: '0.6s' },
    { e: '🌟', top: '42%', is: '94%', s: 20, d: '2s' },
    { e: '💫', top: '55%', is: '3%',  s: 24, d: '1.6s' },
    { e: '🌼', top: '68%', is: '92%', s: 28, d: '0.3s' },
    { e: '✨', top: '80%', is: '8%',  s: 20, d: '2.4s' },
    { e: '⭐', top: '90%', is: '86%', s: 24, d: '1s' },
    { e: '🌷', top: '24%', is: '50%', s: 18, d: '1.8s' },
    { e: '🦋', top: '60%', is: '48%', s: 22, d: '0.9s' },
    { e: '🔯', top: '48%', is: '70%', s: 16, d: '2.2s' },
    { e: '🌸', top: '86%', is: '40%', s: 22, d: '1.4s' }
  ];
  const GROUPS = [
    { label: t('studentSpace.groups.main'), items: [
      { to: '', end: true, icon: 'home', label: L('home'), color: '#ff6a00' },
      { to: 'twin', icon: 'insights', label: L('twin'), color: '#10b981' },
    ] },
    { label: t('studentSpace.groups.learning'), items: [
      { to: 'books', icon: 'auto_stories', label: L('books'), color: '#14b8a6' },
      { to: 'stories', icon: 'library_books', label: L('stories'), color: '#06b6d4' },
      { to: 'subjects', icon: 'menu_book', label: L('subjects'), color: '#10b981' },
      { to: 'plan', icon: 'route', label: L('plan'), color: '#f59e0b' },
      { to: 'adaptive', icon: 'psychology', label: L('adaptive'), color: '#a855f7' },
      { to: 'flashcards', icon: 'style', label: L('flashcards'), color: '#eab308' },
      { to: 'routine', icon: 'today', label: L('routine'), color: '#8b5cf6' },
      { to: 'videos', icon: 'smart_display', label: L('videos'), color: '#0ea5e9' },
      { to: 'refeeqi', icon: 'smart_toy', label: L('refeeqi'), color: '#3b82f6' },
    ] },
    { label: t('studentSpace.groups.exams'), items: [
      { to: 'quizzes', icon: 'quiz', label: L('quizzes'), color: '#ef4444' },
      { to: 'official-exams', icon: 'description', label: L('officialExams'), color: '#3b82f6' },
      { to: 'assignments', icon: 'assignment', label: L('assignments'), color: '#f97316' },
      { to: 'live', icon: 'live_tv', label: L('live'), color: '#22c55e' },
      { to: 'paper-exam', icon: 'document_scanner', label: L('paperExam'), color: '#6366f1' },
      { to: 'schedule', icon: 'calendar_view_week', label: L('schedule'), color: '#f97316' },
      { to: 'calendar', icon: 'calendar_month', label: L('calendar'), color: '#8b5cf6' },
    ] },
    { label: t('studentSpace.groups.activities'), items: [
      { to: 'play', icon: 'sports_esports', label: L('play'), color: '#ec4899' },
    ] },
  ];

  return (
    <div className="student-space student-space--v2">
      <div className="space-decor" aria-hidden="true">
        {DECOR.map((d, i) => (
          <span
            key={i}
            className="decor"
            style={{ insetBlockStart: d.top, insetInlineStart: d.is, fontSize: d.s, animationDelay: d.d }}
          >
            {d.e}
          </span>
        ))}
      </div>
      <div className="container">
        <StudentProfile profile={profile} />
        <SpaceShell base="/student-space" title={t('studentSpace.sidebarTitle')} storageKey="rafiqi-student-sidebar" sections={GROUPS}>
          <Routes>
            <Route index element={<StudentTwin />} />
            <Route path="routine" element={<StudentDailyRoutine />} />
            <Route path="flashcards" element={<StudentFlashcards />} />
            <Route path="subjects" element={<StudentSubjects />} />
            <Route path="quizzes" element={<StudentQuizzes onChanged={load} />} />
            <Route path="official-exams" element={<StudentOfficialExams onChanged={load} />} />
            <Route path="assignments" element={<StudentAssignments onChanged={load} />} />
            <Route path="live" element={<StudentLiveSessions />} />
            <Route path="paper-exam" element={<PaperExamScan />} />
            <Route path="play" element={<PlayZone />} />
            <Route path="books" element={<StudentBooks />} />
            <Route path="adaptive" element={<StudentAdaptive />} />
            <Route path="plan" element={<StudentLearningPlan />} />
            <Route path="videos" element={<StudentVideos />} />
            <Route path="stories" element={<StudentStories />} />
            <Route path="calendar" element={<SchoolCalendar />} />
            <Route path="refeeqi" element={<AskRefeeqi />} />
            <Route path="twin" element={<StudentTwin />} />
            <Route path="schedule" element={<StudentSchedule />} />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        </SpaceShell>
      </div>
    </div>
  );
}
