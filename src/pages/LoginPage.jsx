import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, SunMedium } from 'lucide-react';
import { useDashboardStore } from '../store/dashboardStore.js';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';

const LoginPage = () => {
  const users = useDashboardStore((state) => state.users);
  const login = useDashboardStore((state) => state.login);
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? '');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedUserId) return;
    login(selectedUserId);
    const next = location.state?.from?.pathname ?? '/app';
    navigate(next, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900/80 to-slate-900/20 p-8 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
            <SunMedium className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal-200/80">Solar Fleet Studio</p>
            <h1 className="mt-2 text-3xl font-semibold">Choose a persona to enter the showcase</h1>
            <p className="mt-2 text-base text-slate-200/80">
              Authentication is intentionally mocked. Pick any persona to see how access levels
              reshape the dashboard.
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            {users.map((user) => {
              const selected = selectedUserId === user.id;
              return (
                <Card
                  key={user.id}
                  className={`relative cursor-pointer overflow-hidden border-white/10 bg-white/5 text-white transition hover:-translate-y-0.5 hover:border-white/40 ${
                    selected ? 'border-teal-300/70 shadow-xl' : ''
                  }`}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <CardHeader className="space-y-3 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-semibold">{user.name}</CardTitle>
                      <Badge variant="secondary" className="bg-white/10 text-white">
                        {user.role}
                      </Badge>
                    </div>
                    <CardDescription className="text-slate-200/80">{user.email}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-200/80">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-200" />
                      Access to {user.accessibleSiteIds.length} site
                      {user.accessibleSiteIds.length === 1 ? '' : 's'}
                    </div>
                    <p className="text-xs text-slate-400">
                      Click to impersonate. We store nothing -- it&apos;s purely client-side.
                    </p>
                    <label className="mt-3 flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        className="h-4 w-4 border-white/20 bg-transparent"
                        name="persona"
                        value={user.id}
                        checked={selected}
                        onChange={() => setSelectedUserId(user.id)}
                      />
                      Use this persona
                    </label>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button type="submit" className="w-full text-base font-semibold">
            Enter dashboard
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
