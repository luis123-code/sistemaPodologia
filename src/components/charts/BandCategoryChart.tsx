import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type BandRow = Record<string, string | number>;

type BandCategoryChartProps = {
  rows: BandRow[];
  xKey: string;
  yKey: string;
  variant: "bar" | "line";
  height: number;
  yMin?: number;
  yMax?: number;
  colors?: string[];
  className?: string;
};

export function BandCategoryChart({ rows, xKey, yKey, variant, height, yMin, yMax, colors, className }: BandCategoryChartProps) {
  const data = useMemo(() => rows.map((r) => ({ ...r })), [rows]);
  const color = colors?.[0] || "#3b82f6";

  const domain: [number | "auto", number | "auto"] = [yMin ?? "auto", yMax ?? "auto"];

  if (variant === "line") {
    return (
      <div className={`relative w-full min-w-0 ${className || ''}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis domain={domain} tick={{ fontSize: 11 }} width={40} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: color }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className={`relative w-full min-w-0 ${className || ''}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis domain={domain} tick={{ fontSize: 11 }} width={40} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
