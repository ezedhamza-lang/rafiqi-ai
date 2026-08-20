import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from '../components/ui/index.js';

// كل فضاءات المستخدمين (أستاذ، ولي، تلميذ، إدارة، نظام) صار التنقل بينها من
// القائمة المنسدلة في الشريط العلوي (الهيدر) — بالتحويم عليها تتحل القائمة مباشرة،
// فما عادش يحتاج أي واجهة شريط جانبي (sidebar) يعيق الصفحة.
export default function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Spinner label="جارٍ التحميل..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="container">
      <div className="dash-content dash-content-full">
        <Outlet />
      </div>
    </div>
  );
}
