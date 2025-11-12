import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';

const AppShell = () => (
  <div className="min-h-screen bg-slate-50/70">
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-0 border-x border-slate-200/60 bg-white/70 backdrop-blur">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 pb-10 pt-4 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  </div>
);

export default AppShell;
