import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { cn } from '../lib/utils.js';

const deltaTone = {
  positive: 'text-emerald-600',
  negative: 'text-rose-600',
  neutral: 'text-slate-500'
};

const StatCard = ({ label, value, hint, delta, icon: Icon }) => (
  <Card className="bg-white/95 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      {Icon && <Icon className="h-5 w-5 text-slate-300" />}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {delta?.text && (
        <p className={cn('mt-1 text-xs font-medium', deltaTone[delta.trend ?? 'neutral'])}>
          {delta.text}
        </p>
      )}
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

export default StatCard;
