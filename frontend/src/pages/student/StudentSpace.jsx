import { useState, useEffect, useCallback , lazy, Suspense} from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getHomePath } from '../../roles.js';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
import SpaceShell from '../../components/SpaceShell.jsx';
const StudentQuizzes = lazy(() => import('./StudentQuizzes.jsx'));
const StudentOfficialExams = lazy(() => import('./StudentOfficialExams.jsx'));
const StudentBooks = lazy(() => import('./StudentBooks.jsx'));
const StudentVideos = lazy(() => import('./StudentVideos.jsx'));
const StudentAdaptive = lazy(() => import('./StudentAdaptive.jsx'));
const StudentLearningPlan = lazy(() => import('./StudentLearningPlan.jsx'));
const StudentStories = lazy(() => import('./StudentStories.jsx'));
const StudentTwin = lazy(() => import('./StudentTwin.jsx'));
const AskRefeeqi = lazy(() => import('./AskRefeeqi.jsx'));
const StudentSchedule = lazy(() => import('./StudentSchedule.jsx'));
const StudentProfile = lazy(() => import('./StudentProfile.jsx'));
const StudentSubjects = lazy(() => import('./StudentSubjects.jsx'));
const PlayZone = lazy(() => import('./PlayZone.jsx'));
const PaperExamScan = lazy(() => import('./PaperExamScan.jsx'));
const StudentAssignments = lazy(() => import('./StudentAssignments.jsx'));
const StudentLiveSessions = lazy(() => import('./StudentLiveSessions.jsx'));
const StudentDailyRoutine = lazy(() => import('./StudentDailyRoutine.jsx'));
const StudentFlashcards = lazy(() => import('./StudentFlashcards.jsx'));
const StudentDashboard = lazy(() => import('./StudentDashboard.jsx'));
const StudentRewards = lazy(() => import('./StudentRewards.jsx'));
const StudentExperiments = lazy(() => import('./StudentExperiments.jsx'));
const StudentPortfolio = lazy(() => import('./StudentPortfolio.jsx'));
const StudentDailyChallenge = lazy(() => import('./StudentDailyChallenge.jsx'));
const StudentProgress = lazy(() => import('./StudentProgress.jsx'));
const StudentVirtualFriend = lazy(() => import('./StudentVirtualFriend.jsx'));
const StudentCertificates = lazy(() => import('./StudentCertificates.jsx'));
const StudentLeaderboard = lazy(() => import('./StudentLeaderboard.jsx'));
const StudentWeeklyChallenge = lazy(() => import('./StudentWeeklyChallenge.jsx'));
const StudentFriendships = lazy(() => import('./StudentFriendships.jsx'));
const SchoolCalendar = lazy(() => import('../../components/SchoolCalendar.jsx'));

export default function StudentSpace() {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [profile, setProfile] = useState(null);

  const fullPath = location.pathname.replace('/student-space/', '').replace('/student-space', '');
  const isFullWidth = ['books', 'stories'].includes(fullPath);

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
    { e: 'â­', top: '8%',  is: '6%',  s: 26, d: '0s' },
    { e: 'âœ¨', top: '16%', is: '88%', s: 22, d: '1.2s' },
    { e: 'ðŸŒ¸', top: '30%', is: '4%',  s: 30, d: '0.6s' },
    { e: 'ðŸŒŸ', top: '42%', is: '94%', s: 20, d: '2s' },
    { e: 'ðŸ’«', top: '55%', is: '3%',  s: 24, d: '1.6s' },
    { e: 'ðŸŒ¼', top: '68%', is: '92%', s: 28, d: '0.3s' },
    { e: 'âœ¨', top: '80%', is: '8%',  s: 20, d: '2.4s' },
    { e: 'â­', top: '90%', is: '86%', s: 24, d: '1s' },
    { e: 'ðŸŒ·', top: '24%', is: '50%', s: 18, d: '1.8s' },
    { e: 'ðŸ¦‹', top: '60%', is: '48%', s: 22, d: '0.9s' },
    { e: 'ðŸ”¯', top: '48%', is: '70%', s: 16, d: '2.2s' },
    { e: 'ðŸŒ¸', top: '86%', is: '40%', s: 22, d: '1.4s' }
  ];
  const BUBBLES = [
    { color: 'rgba(167,139,250,.35)', size: 18, left: '8%',  dur: '15s', delay: '0s', peak: '.45' },
    { color: 'rgba(244,114,182,.3)',  size: 14, left: '22%', dur: '12s', delay: '2s', peak: '.4' },
    { color: 'rgba(96,165,250,.3)',   size: 20, left: '40%', dur: '18s', delay: '4s', peak: '.5' },
    { color: 'rgba(52,211,153,.3)',   size: 12, left: '58%', dur: '14s', delay: '1s', peak: '.35' },
    { color: 'rgba(250,204,21,.3)',   size: 16, left: '75%', dur: '16s', delay: '3s', peak: '.4' },
    { color: 'rgba(248,113,113,.25)', size: 10, left: '90%', dur: '13s', delay: '5s', peak: '.35' },
    { color: 'rgba(192,132,252,.3)',  size: 22, left: '15%', dur: '20s', delay: '6s', peak: '.3' },
    { color: 'rgba(56,189,248,.25)',  size: 15, left: '65%', dur: '17s', delay: '2.5s', peak: '.4' },
  ];
  const STARS = [
    { c: '#facc15', s: 4, left: '12%', top: '15%', dur: '3s', delay: '0s' },
    { c: '#f472b6', s: 3, left: '35%', top: '8%',  dur: '4s', delay: '1s' },
    { c: '#60a5fa', s: 5, left: '55%', top: '20%', dur: '2.5s', delay: '0.5s' },
    { c: '#34d399', s: 3, left: '78%', top: '12%', dur: '3.5s', delay: '1.5s' },
    { c: '#facc15', s: 4, left: '92%', top: '25%', dur: '3s', delay: '2s' },
    { c: '#a78bfa', s: 3, left: '5%',  top: '40%', dur: '4s', delay: '0.8s' },
    { c: '#f472b6', s: 4, left: '45%', top: '55%', dur: '3s', delay: '1.2s' },
    { c: '#60a5fa', s: 3, left: '85%', top: '48%', dur: '3.5s', delay: '0.3s' },
    { c: '#34d399', s: 5, left: '25%', top: '70%', dur: '2.8s', delay: '1.8s' },
    { c: '#facc15', s: 3, left: '68%', top: '80%', dur: '4s', delay: '0.6s' },
  ];
  const GROUPS = [
    { label: t('studentSpace.groups.main'), items: [
      { to: '', end: true, icon: 'insights', label: L('twin'), color: '#10b981' },
      { to: 'dashboard', icon: 'dashboard', label: L('dashboard'), color: '#10b981' },
      { to: 'rewards', icon: 'emoji_events', label: L('rewards'), color: '#E8A317' },
    ] },
    { label: t('studentSpace.groups.learning'), items: [
      { to: 'books', icon: 'auto_stories', label: L('books'), color: '#E8A317' },
      { to: 'stories', icon: 'library_books', label: L('stories'), color: '#E8A317' },
      { to: 'subjects', icon: 'menu_book', label: L('subjects'), color: '#E8A317' },
      { to: 'plan', icon: 'route', label: L('plan'), color: '#fbbf24' },
      { to: 'adaptive', icon: 'psychology', label: L('adaptive'), color: '#E8A317' },
      { to: 'flashcards', icon: 'style', label: L('flashcards'), color: '#E8A317' },
      { to: 'routine', icon: 'today', label: L('routine'), color: '#E8A317' },
      { to: 'videos', icon: 'smart_display', label: L('videos'), color: '#E8A317' },
      { to: 'refeeqi', icon: 'smart_toy', label: L('refeeqi'), color: '#E8A317' },
    ] },
    { label: t('studentSpace.groups.exams'), items: [
      { to: 'quizzes', icon: 'quiz', label: L('quizzes'), color: '#ef4444' },
      { to: 'official-exams', icon: 'description', label: L('officialExams'), color: '#E8A317' },
      { to: 'assignments', icon: 'assignment', label: L('assignments'), color: '#E8A317' },
      { to: 'live', icon: 'live_tv', label: L('live'), color: '#22c55e' },
      { to: 'paper-exam', icon: 'document_scanner', label: L('paperExam'), color: '#E8A317' },
      { to: 'schedule', icon: 'calendar_view_week', label: L('schedule'), color: '#E8A317' },
      { to: 'calendar', icon: 'calendar_month', label: L('calendar'), color: '#E8A317' },
    ] },
    { label: t('studentSpace.groups.activities'), items: [
      { to: 'play', icon: 'sports_esports', label: L('play'), color: '#E8A317' },
      { to: 'experiments', icon: 'science', label: L('experiments'), color: '#10b981' },
      { to: 'portfolio', icon: 'palette', label: L('portfolio'), color: '#8b5cf6' },
      { to: 'daily-challenge', icon: 'emoji_events', label: L('dailyChallenge'), color: '#ef4444' },
      { to: 'progress', icon: 'trending_up', label: L('progress'), color: '#3b82f6' },
      { to: 'virtual-friend', icon: 'pets', label: L('virtualFriend'), color: '#06b6d4' },
    ] },
    { label: t('studentSpace.groups.rewards', 'Ø§Ù„Ù…ÙƒØ§ÙØ¢Øª'), items: [
      { to: 'leaderboard', icon: 'leaderboard', label: L('leaderboard'), color: '#E8A317' },
      { to: 'weekly-challenge', icon: 'date_range', label: L('weeklyChallenge'), color: '#ef4444' },
      { to: 'certificates', icon: 'school', label: L('certificates'), color: '#8b5cf6' },
      { to: 'friendships', icon: 'group', label: L('friendships'), color: '#06b6d4' },
    ] },
  ];

  return (
    <div className="student-space student-space--v2">
      <div className="kid-bubbles" aria-hidden="true">
        {BUBBLES.map((b, i) => (
          <span key={`b${i}`} className="kid-bubble" style={{
            left: b.left, width: b.size, height: b.size,
            background: b.color,
            '--dur': b.dur, '--delay': b.delay, '--peak': b.peak,
          }} />
        ))}
      </div>
      <div className="kid-stars" aria-hidden="true">
        {STARS.map((s, i) => (
          <span key={`s${i}`} className="kid-star" style={{
            left: s.left, top: s.top,
            '--c': s.c, '--s': s.s, '--dur': s.dur, '--delay': s.delay,
          }} />
        ))}
      </div>
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
      <Suspense fallback={null}>
        <StudentProfile profile={profile} />
      </Suspense>
      <SpaceShell base="/student-space" title={t('studentSpace.sidebarTitle')} storageKey="rafiqi-student-sidebar" sections={GROUPS} fullWidth={isFullWidth}>
        <Suspense fallback={null}>
        <Routes>
          <Route index element={<StudentTwin />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="rewards" element={<StudentRewards />} />
          <Route path="routine" element={<StudentDailyRoutine />} />
          <Route path="flashcards" element={<StudentFlashcards />} />
          <Route path="subjects" element={<StudentSubjects />} />
          <Route path="quizzes" element={<StudentQuizzes onChanged={load} />} />
          <Route path="official-exams" element={<StudentOfficialExams onChanged={load} />} />
          <Route path="assignments" element={<StudentAssignments onChanged={load} />} />
          <Route path="live" element={<StudentLiveSessions />} />
          <Route path="paper-exam" element={<PaperExamScan />} />
          <Route path="play" element={<PlayZone />} />
          <Route path="experiments" element={<StudentExperiments />} />
          <Route path="portfolio" element={<StudentPortfolio />} />
          <Route path="daily-challenge" element={<StudentDailyChallenge />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="virtual-friend" element={<StudentVirtualFriend />} />
          <Route path="leaderboard" element={<StudentLeaderboard />} />
          <Route path="weekly-challenge" element={<StudentWeeklyChallenge />} />
          <Route path="certificates" element={<StudentCertificates />} />
          <Route path="friendships" element={<StudentFriendships />} />
          <Route path="books" element={<StudentBooks />} />
          <Route path="adaptive" element={<StudentAdaptive />} />
          <Route path="plan" element={<StudentLearningPlan />} />
          <Route path="videos" element={<StudentVideos />} />
          <Route path="stories" element={<StudentStories />} />
          <Route path="calendar" element={<SchoolCalendar />} />
          <Route path="refeeqi" element={<AskRefeeqi />} />
          <Route path="schedule" element={<StudentSchedule />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </Suspense>
      </SpaceShell>
    </div>
  );
}
