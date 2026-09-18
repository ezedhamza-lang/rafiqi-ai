import { lazy, Suspense, Component } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
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

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div style={{ fontSize: '3rem', fontWeight: 900 }}>!</div>
          <p style={{ margin: '0.5rem 0 1.25rem', color: 'var(--muted)' }}>حدث خطأ غير متوقع</p>
          <Link className="btn btn-primary" to="/">العودة للرئيسية</Link>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <Link className="btn btn-primary" to="/">{t('common.backHome')}</Link>
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
            <ErrorBoundary>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
                  <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
                  <Route path="/account" element={<RequireRole><AccountSettings /></RequireRole>} />
                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<RequireRole roles={['ADMIN', 'SCHOOL_DIRECTOR', 'TEACHER']}><Dashboard /></RequireRole>} />
                    <Route path="/students" element={<RequireRole roles={['ADMIN', 'SCHOOL_DIRECTOR']}><Students /></RequireRole>} />
                    <Route path="/registration" element={<RequireRole roles={['ADMIN', 'SCHOOL_DIRECTOR']}><Registration /></RequireRole>} />
                    <Route path="/student" element={<RequireRole roles={['ADMIN', 'SCHOOL_DIRECTOR']}><StudentSection /></RequireRole>} />
                    <Route path="/my-requests" element={<RequireRole><MyRequests /></RequireRole>} />
                    <Route path="/payment" element={<RequireRole><PaymentCenter /></RequireRole>} />
                    <Route path="/messages" element={<RequireRole><Messages /></RequireRole>} />
                    <Route path="/message-center" element={<RequireRole><MessageCenter /></RequireRole>} />
                    <Route path="/help" element={<RequireRole><HelpRequest /></RequireRole>} />
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
            </ErrorBoundary>
          </main>
          <Footer />
        </NotificationProvider>
      </ChatProvider>
    </AuthProvider>
  );
}
