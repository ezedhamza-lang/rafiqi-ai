import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { useI18n } from './i18n/index.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import DashboardLayout from './pages/DashboardLayout.jsx';

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
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
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
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/teacher/*" element={<TeacherDashboard />} />
                  <Route path="/student-space/*" element={<StudentSpace />} />
                  <Route path="/parent/*" element={<ParentSpace />} />
                  <Route path="/director/*" element={<DirectorDashboard />} />
                  <Route path="/superadmin/*" element={<SuperAdminDashboard />} />
                </Route>
                <Route path="*" element={<Home />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </NotificationProvider>
      </ChatProvider>
    </AuthProvider>
  );
}
