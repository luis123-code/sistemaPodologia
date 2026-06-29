import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

type Props = {
  values: number[];
  delayMs?: number;
  colorClassName?: string;
  /** Color directo (hex, rgb, hsl) — tiene prioridad sobre colorClassName */
  color?: string;
  className?: string;
};

export function SparklineAreaAnimated({ values, delayMs = 0, colorClassName, color: colorProp, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const gradId = `sparkGrad-${uid}`;
  const [visible, setVisible] = useState(false);

  const data = values.map((v, i) => ({ index: i, value: v }));

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  // Extrae color actual del CSS para el stroke/fill
  const [strokeColor, setStrokeColor] = useState<string>("hsl(217 91% 60%)");
  useEffect(() => {
    if (colorProp) {
      setStrokeColor(colorProp);
      return;
    }
    const el = document.createElement("div");
    el.className = colorClassName || "text-primary";
    document.body.appendChild(el);
    const color = getComputedStyle(el).color;
    setStrokeColor(color || "hsl(217 91% 60%)");
    document.body.removeChild(el);
  }, [colorClassName, colorProp]);

  if (!visible) return <span className={cn("inline-flex shrink-0 h-9 w-[5.5rem]", className)} />;

  return (
    <span className={cn("inline-flex shrink-0", colorClassName, className)}>
      <ResponsiveContainer width={88} height={36}>
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2.25}
            fill={`url(#${gradId})`}
            animationDuration={850}
            animationEasing="ease-out"
            isAnimationActive
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </span>
  );
}
