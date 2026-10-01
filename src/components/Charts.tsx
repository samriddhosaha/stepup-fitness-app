import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SeriesPoint } from '../lib/progress'

// Single-series charts only (bodyweight, weekly volume, one lift at a time),
// so no legend box is needed — the card title above each chart already
// names the series. Colors read straight off the CSS custom properties so
// both themes stay correct without duplicating the token values here.
function cssVar(name: string): string {
  if (typeof window === 'undefined') return '#000'
  return `rgb(${getComputedStyle(document.documentElement).getPropertyValue(name)})`
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-elevated px-3 py-2 text-xs">
      <p className="label-eyebrow text-faint mb-1">{label}</p>
      <p className="font-semibold text-ink">
        {payload[0].value}
        {unit ? ` ${unit}` : ''}
      </p>
    </div>
  )
}

export function TrendLineChart({
  data,
  unit,
  emptyLabel,
}: {
  data: SeriesPoint[]
  unit?: string
  emptyLabel: string
}) {
  if (data.length < 2) {
    return <p className="text-sm text-faint py-8 text-center">{emptyLabel}</p>
  }

  const accent = cssVar('--c-accent')
  const gridLine = cssVar('--c-hairline')
  const faint = cssVar('--c-faint')

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.1} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={gridLine} strokeDasharray="0" />
        <XAxis
          dataKey="date"
          tick={{ fill: faint, fontSize: 11 }}
          axisLine={{ stroke: gridLine }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: faint, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={accent}
          strokeWidth={2}
          fill="url(#trendFill)"
          dot={{ r: 4, fill: accent, stroke: cssVar('--c-canvas'), strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function VolumeBarChart({
  data,
  emptyLabel,
  unit = 'kg',
}: {
  data: SeriesPoint[]
  emptyLabel: string
  unit?: string
}) {
  if (data.length === 0) {
    return <p className="text-sm text-faint py-8 text-center">{emptyLabel}</p>
  }

  const accent = cssVar('--c-accent')
  const gridLine = cssVar('--c-hairline')
  const faint = cssVar('--c-faint')

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={gridLine} />
        <XAxis
          dataKey="date"
          tick={{ fill: faint, fontSize: 11 }}
          axisLine={{ stroke: gridLine }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis tick={{ fill: faint, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<ChartTooltip unit={unit} />} />
        <Bar dataKey="value" fill={accent} radius={[0, 0, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}
