import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import FleetOverview from './pages/FleetOverview.jsx';
import SiteDetail from './pages/SiteDetail.jsx';
import AlarmHub from './pages/AlarmHub.jsx';
import SharingCenter from './pages/SharingCenter.jsx';
import { useDashboardStore } from './store/dashboardStore.js';

const RootRedirect = () => {
  const user = useDashboardStore((state) => state.user);
  return user ? <Navigate to="/app" replace /> : <Navigate to="/login" replace />;
};

const App = () => (
  <Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/app" element={<AppShell />}>
        <Route index element={<FleetOverview />} />
        <Route path="sites/:siteId" element={<SiteDetail />} />
        <Route path="alarms" element={<AlarmHub />} />
        <Route path="access" element={<SharingCenter />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
