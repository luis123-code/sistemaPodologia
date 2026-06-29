import { useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
  BarChart,
} from "recharts"
import { cn } from "@/lib/utils"

type ChartRow = Record<string, string | number>

type AreaChartShadcnProps = {
  data: ChartRow[]
  xKey: string
  yKey: string
  variant?: "area" | "bar" | "line"
  height?: number
  yMin?: number
  yMax?: number
  color?: string
  className?: string
  showGrid?: boolean
  showTooltip?: boolean
}

export function AreaChartShadcn({
  data,
  xKey,
  yKey,
  variant = "area",
  height = 220,
  yMin,
  yMax,
  color = "hsl(217 91% 60%)",
  className,
  showGrid = true,
  showTooltip = true,
}: AreaChartShadcnProps) {
  const chartData = useMemo(() => data.map((r) => ({ ...r })), [data])

  const domain: [number | "auto", number | "auto"] = [
    yMin ?? "auto",
    yMax ?? "auto",
  ]

  const id = useMemo(() => `gradient-${Math.random().toString(36).slice(2)}`, [])

  if (variant === "bar") {
    return (
      <div className={cn("w-full", className)} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(220 13% 91%)"
              />
            )}
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: "hsl(215 12% 46%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 11, fill: "hsl(215 12% 46%)" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            {showTooltip && (
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(220 13% 91%)",
                  background: "white",
                }}
                cursor={{ fill: "hsl(220 13% 91%)", opacity: 0.4 }}
              />
            )}
            <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(220 13% 91%)"
            />
          )}
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: "hsl(215 12% 46%)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 11, fill: "hsl(215 12% 46%)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          {showTooltip && (
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(220 13% 91%)",
                background: "white",
              }}
              cursor={{ stroke: "hsl(220 13% 91%)", strokeWidth: 1 }}
            />
          )}
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
