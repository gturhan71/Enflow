import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { ReportChartSeries } from '../../types';
import { PIE_COLORS } from './helpers';

export default function ChartBlock({ c }: { c: ReportChartSeries }) {
  const data = c.data.filter(d => d.value !== 0 || c.type === 'bar');
  if (data.length === 0) return null;
  return (
    <div className="glass-card p-5 rounded-2xl">
      <h4 className="text-sm font-black text-slate-900 mb-3">{c.title}</h4>
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {c.type === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${e.value}`} labelLine={false} fontSize={10}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
            </PieChart>
          ) : c.type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
              <Line type="monotone" dataKey="value" stroke="hsl(151 86% 39%)" strokeWidth={2} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
              <XAxis dataKey="name" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
