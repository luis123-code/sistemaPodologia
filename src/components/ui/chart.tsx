import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { cn } from "@/lib/utils"

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    color?: string
    icon?: React.ComponentType
  }
}

type ChartContextProps = { config: ChartConfig }
const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart must be used within a <ChartContainer />")
  return context
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
    children: React.ReactNode
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex justify-center text-xs",
          className
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children as any}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
})
ChartContainer.displayName = "ChartContainer"

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartLegend = RechartsPrimitive.Legend

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  label,
  labelFormatter,
  labelKey,
  nameKey,
  hideLabel = false,
  hideIndicator = false,
  ...props
}: any) {
  const { config } = useChart()

  if (!active || !payload?.length) return null

  const nestLabel = !hideLabel && !label
  const labelContent = !hideLabel && (
    <div className="mb-1.5 text-left">
      {nestLabel ? (
        <span className="text-muted-foreground text-xs">
          {payload[0]?.payload?.[labelKey ?? ""]}
        </span>
      ) : (
        label && (
          <span className="text-muted-foreground text-xs">
            {labelFormatter ? labelFormatter(label, payload) : label}
          </span>
        )
      )}
    </div>
  )

  return (
    <div
      className={cn(
        "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
      {...props}
    >
      {labelContent}
      <div className="grid gap-1.5">
        {payload.map((item: any, index: number) => {
          const key = `${nameKey || item.dataKey || item.name || "value"}`
          const itemConfig = config[key as string]
          const indicatorColor = item.color || itemConfig?.color

          return (
            <div
              key={index}
              className="flex w-full flex-wrap items-stretch gap-2"
            >
              {!hideIndicator && (
                <div className="flex h-2.5 w-2.5 items-center justify-center">
                  {indicator === "line" ? (
                    <div
                      className="h-full w-full rounded-full"
                      style={{ backgroundColor: indicatorColor }}
                    />
                  ) : indicator === "dashed" ? (
                    <div
                      className="h-full w-full rounded-full border-2 border-dashed"
                      style={{ borderColor: indicatorColor }}
                    />
                  ) : (
                    <div
                      className="h-full w-full rounded-full"
                      style={{ backgroundColor: indicatorColor }}
                    />
                  )}
                </div>
              )}
              <div className="flex flex-1 leading-none">
                <div className="mr-1.5 text-muted-foreground">
                  {itemConfig?.label || item.name}
                </div>
                <div className="font-mono font-medium tabular-nums text-foreground">
                  {item.value}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
ChartTooltipContent.displayName = "ChartTooltipContent"

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: any) {
  const { config } = useChart()

  if (!payload?.length) return null

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item: any, index: number) => {
        const key = `${nameKey || item.dataKey || item.value || "value"}`
        const itemConfig = config[key as string]

        return (
          <div
            key={index}
            className="flex items-center gap-1.5"
          >
            {!hideIcon && itemConfig?.icon && (
              (() => {
                const Icon = itemConfig.icon as any
                return <Icon className="h-2 w-2" />
              })()
            )}
            {!hideIcon && !itemConfig?.icon && (
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color || itemConfig?.color }}
              />
            )}
            <span className="text-muted-foreground text-xs">
              {itemConfig?.label || item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}
ChartLegendContent.displayName = "ChartLegendContent"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  useChart,
}
