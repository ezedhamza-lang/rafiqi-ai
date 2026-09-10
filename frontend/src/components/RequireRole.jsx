import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getHomePath } from '../roles.js';

/**
 * RequireRole — حاجز صلاحيات موحّد.
 * - غير مسجّل ⇒ /login مع حفظ الوجهة للعودة بعدها.
 * - دور غير مسموح ⇒ يُعاد إلى الصفحة الرئيسية الخاصة بدوره.
 * ملاحظة: هذا حاجز واجهة فقط؛ الصلاحيات الحقيقية يفرضها الخادم على كل مسار.
 */
export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getHomePath(user)} replace />;
  }
  return children;
}
