import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { useI18n } from './i18n/index.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import PublicAgenda from './pages/PublicAgenda.jsx';
import UserGuide from './pages/UserGuide.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Register from './pages/Register.jsx';
import DashboardLayout from './pages/DashboardLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import Registration from './pages/Registration.jsx';
import MyRequests from './pages/MyRequests.jsx';
import PaymentCenter from './pages/PaymentCenter.jsx';
import HelpRequest from './pages/HelpRequest.jsx';
import Messages from './pages/Messages.jsx';
import MessageCenter from './pages/MessageCenter.jsx';
import StudentSection from './pages/StudentSection.jsx';

// ترقية (28-08-2026): تقسيم الحزمة (Code Splitting) — لوحات الأدوار
// (أستاذ/تلميذ/ولي أمر/مدير/سوبر أدمن) و Admin.jsx (~15,700 سطر لوحدها)
// كانت كلها مُحمَّلة دفعة واحدة ضمن حزمة JS الرئيسية عند أول زيارة، حتى
// لو كان الزائر تلميذاً وما يحتاجش كود لوحة المدير إطلاقاً. React.lazy()
// يخلي كل لوحة تُحمَّل فقط عند الدخول لمسارها، فيتقلّص حجم أول تحميل
// بشكل محسوس (مهم لعائلات بانترنت ضعيف بالأرياف). راجع vite build قبل/
// بعد هذا التغيير في PENDING_FIXES.md.
const Admin = lazy(() => import('./pages/Admin.jsx'));
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard.jsx'));
const StudentSpace = lazy(() => import('./pages/student/StudentSpace.jsx'));
const ParentSpace = lazy(() => import('./pages/parent/ParentSpace.jsx'));
const DirectorDashboard = lazy(() => import('./pages/director/DirectorDashboard.jsx'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard.jsx'));

function RouteLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }} role="status" aria-live="polite">
      <span className="material-icons" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>autorenew</span>
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
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/agenda" element={<PublicAgenda />} />
                <Route path="/guide" element={<UserGuide />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
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

