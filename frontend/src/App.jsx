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
import Dashboard from './pages/Dashboard.jsx';
import Students from './pages/Students.jsx';
import Registration from './pages/Registration.jsx';
import MyRequests from './pages/MyRequests.jsx';
import PaymentCenter from './pages/PaymentCenter.jsx';
import HelpRequest from './pages/HelpRequest.jsx';
import Messages from './pages/Messages.jsx';
import MessageCenter from './pages/MessageCenter.jsx';
import StudentSection from './pages/StudentSection.jsx';
import Admin from './pages/Admin.jsx';
import TeacherDashboard from './pages/teacher/TeacherDashboard.jsx';
import StudentSpace from './pages/student/StudentSpace.jsx';
import ParentSpace from './pages/parent/ParentSpace.jsx';
import DirectorDashboard from './pages/director/DirectorDashboard.jsx';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard.jsx';

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
          </main>
          <Footer />
        </NotificationProvider>
      </ChatProvider>
    </AuthProvider>
  );
}
