import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore.js';

const ProtectedRoute = () => {
  const user = useDashboardStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
