import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './ui/card.jsx';

const TrendChart = ({ title, subtitle, data, lines, yLabel, actions, xKey = 'date' }) => (
  <Card className="h-full bg-white/95 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <div>
        <CardTitle>{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </div>
      {actions}
    </CardHeader>
    <CardContent className="pt-6">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey={xKey}
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              width={60}
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={
                yLabel
                  ? {
                      value: yLabel,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: '#94a3b8', fontSize: 12 }
                    }
                  : undefined
              }
            />
            <Tooltip contentStyle={{ borderRadius: '12px', borderColor: '#e2e8f0' }} />
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color}
                strokeWidth={2.5}
                dot={false}
                connectNulls
                name={line.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

export default TrendChart;
