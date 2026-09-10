import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { useI18n } from './i18n/index.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import RequireRole from './components/RequireRole.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import DashboardLayout from './pages/DashboardLayout.jsx';
import { getHomePath } from './roles.js';

// Route-level code splitting: heavy dashboards load on demand (smaller initial bundle).
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Students = lazy(() => import('./pages/Students.jsx'));
const Registration = lazy(() => import('./pages/Registration.jsx'));
const StudentSection = lazy(() => import('./pages/StudentSection.jsx'));
const MyRequests = lazy(() => import('./pages/MyRequests.jsx'));
const PaymentCenter = lazy(() => import('./pages/PaymentCenter.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const MessageCenter = lazy(() => import('./pages/MessageCenter.jsx'));
const HelpRequest = lazy(() => import('./pages/HelpRequest.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const AccountSettings = lazy(() => import('./pages/AccountSettings.jsx'));
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard.jsx'));
const StudentSpace = lazy(() => import('./pages/student/StudentSpace.jsx'));
const ParentSpace = lazy(() => import('./pages/parent/ParentSpace.jsx'));
const DirectorDashboard = lazy(() => import('./pages/director/DirectorDashboard.jsx'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard.jsx'));

function RouteFallback() {
  return (
    <div className="loading-wrap" style={{ minHeight: '50vh' }}>
      <span className="spinner" />
    </div>
  );
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to={getHomePath(user)} replace />;
  return children;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <div style={{ fontSize: '3rem', fontWeight: 900 }}>404</div>
      <p className="sub" style={{ margin: '0.5rem 0 1.25rem' }}>{t('common.notFound')}</p>
      <a className="btn btn-primary" href="/">{t('common.backHome')}</a>
    </div>
  );
}

export default function App() {
  const { t } = useI18n();
  return (
    <AuthProvider>
      <ChatProvider>
        <NotificationProvider>
          <a href="#main-content" className="skip-link">
            {t('common.skipToContent')}
          </a>
          <Header />
          <main id="main-content" style={{ minHeight: '70vh' }} tabIndex={-1}>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
                <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
                <Route path="/account" element={<RequireRole><AccountSettings /></RequireRole>} />
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/registration" element={<Registration />} />
                  <Route path="/student" element={<StudentSection />} />
                  <Route path="/my-requests" element={<MyRequests />} />
                  <Route path="/payment" element={<PaymentCenter />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/message-center" element={<MessageCenter />} />
                  <Route path="/help" element={<HelpRequest />} />
                  <Route path="/admin" element={<RequireRole roles={['ADMIN', 'SUPER_ADMIN', 'SCHOOL_DIRECTOR']}><Admin /></RequireRole>} />
                  <Route path="/teacher/*" element={<RequireRole roles={['TEACHER']}><TeacherDashboard /></RequireRole>} />
                  <Route path="/student-space/*" element={<RequireRole roles={['STUDENT']}><StudentSpace /></RequireRole>} />
                  <Route path="/parent/*" element={<RequireRole roles={['PARENT']}><ParentSpace /></RequireRole>} />
                  <Route path="/director/*" element={<RequireRole roles={['SCHOOL_DIRECTOR', 'ADMIN']}><DirectorDashboard /></RequireRole>} />
                  <Route path="/superadmin/*" element={<RequireRole roles={['SUPER_ADMIN']}><SuperAdminDashboard /></RequireRole>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </NotificationProvider>
      </ChatProvider>
    </AuthProvider>
  );
}
