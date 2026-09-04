import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { api } from '../../api/client.js';
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

const TABS = [
  { to: '', end: true, icon: 'home', key: 'home', color: '#0ea5e9' },
  { to: 'routine', icon: 'today', key: 'routine', color: '#8b5cf6' },
  { to: 'flashcards', icon: 'style', key: 'flashcards', color: '#f59e0b' },
  { to: 'subjects', icon: 'menu_book', key: 'subjects', color: '#10b981' },
  { to: 'quizzes', icon: 'quiz', key: 'quizzes', color: '#ef4444' },
  { to: 'official-exams', icon: 'description', key: 'officialExams', color: '#3b82f6' },
  { to: 'assignments', icon: 'assignment', key: 'assignments', color: '#f97316' },
  { to: 'live', icon: 'live_tv', key: 'live', color: '#22c55e' },
  { to: 'paper-exam', icon: 'document_scanner', key: 'paperExam', color: '#6366f1' },
  { to: 'play', icon: 'sports_esports', key: 'play', color: '#ec4899' },
  { to: 'books', icon: 'auto_stories', key: 'books', color: '#14b8a6' },
  { to: 'adaptive', icon: 'psychology', key: 'adaptive', color: '#a855f7' },
  { to: 'plan', icon: 'route', key: 'plan', color: '#f59e0b' },
  { to: 'videos', icon: 'smart_display', key: 'videos', color: '#ef4444' },
  { to: 'stories', icon: 'library_books', key: 'stories', color: '#06b6d4' },
  { to: 'calendar', icon: 'calendar_month', key: 'calendar', color: '#8b5cf6' },
  { to: 'refeeqi', icon: 'smart_toy', key: 'refeeqi', color: '#3b82f6' },
  { to: 'twin', icon: 'insights', key: 'twin', color: '#10b981' },
  { to: 'schedule', icon: 'calendar_view_week', key: 'schedule', color: '#f97316' }
];

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
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="student-space">
      <div className="container">
        <StudentProfile profile={profile} />

        <nav className="student-tabs-nav">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={`/student-space/${tab.to}`}
              end={tab.end}
              className={({ isActive }) => `student-tab-item ${isActive ? 'active' : ''}`}
              style={{ '--tab-color': tab.color }}
            >
              <span className="material-icons">{tab.icon}</span>
              <span className="student-tab-label">{t(`studentSpace.tabs.${tab.key}`)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="tab-content">
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
          </Routes>
        </div>
      </div>
    </div>
  );
}
