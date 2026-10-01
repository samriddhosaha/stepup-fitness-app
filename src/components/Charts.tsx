import type { ReactNode } from 'react'
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
import { parseISODateLocal } from '../lib/format'
import type { SeriesPoint } from '../lib/progress'

// Single-series charts only (bodyweight, weekly volume, one lift at a time),
// so no legend box is needed — the card title above each chart already
// names the series. Colors read straight off the CSS custom properties so
// both themes stay correct without duplicating the token values here.
function cssVar(name: string): string {
  if (typeof window === 'undefined') return '#000'
  return `rgb(${getComputedStyle(document.documentElement).getPropertyValue(name)})`
}

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

interface TimePoint extends SeriesPoint {
  t: number
}
const withTime = (data: SeriesPoint[]): TimePoint[] =>
  data.map((p) => ({ ...p, t: parseISODateLocal(p.date).getTime() }))

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: { value: number; payload: TimePoint }[]
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-elevated px-3 py-2 text-xs">
      <p className="label-eyebrow text-faint mb-1">{payload[0]!.payload.date}</p>
      <p className="font-semibold text-ink">
        {payload[0]!.value}
        {unit ? ` ${unit}` : ''}
      </p>
    </div>
  )
}

/** A chart with a spoken summary and a data table, so the numbers aren't only in the picture. */
function ChartFigure({
  title,
  summary,
  data,
  unit,
  children,
}: {
  title: string
  summary: string
  data: SeriesPoint[]
  unit?: string
  children: ReactNode
}) {
  return (
    <figure>
      <div role="img" aria-label={`${title}. ${summary}`}>
        {children}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
      <details className="mt-2">
        <summary className="text-sm font-semibold text-accent cursor-pointer min-h-11 flex items-center">
          View data
        </summary>
        <table className="w-full text-sm mt-1">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-left text-faint">
              <th scope="col" className="font-semibold py-1">
                Date
              </th>
              <th scope="col" className="font-semibold py-1 text-right">
                {unit ? `Value (${unit})` : 'Value'}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.date} className="border-t border-dotted border-hairline">
                <td className="py-1">{p.date}</td>
                <td className="py-1 text-right">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function describe(data: SeriesPoint[], unit?: string): string {
  const first = data[0]!
  const last = data[data.length - 1]!
  const u = unit ? ` ${unit}` : ''
  return `${data.length} entries from ${first.date} to ${last.date}, from ${first.value}${u} to ${last.value}${u}.`
}

export function TrendLineChart({
  title,
  data,
  unit,
  emptyLabel,
}: {
  title: string
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
  const points = withTime(data)

  return (
    <ChartFigure title={title} summary={describe(data, unit)} data={data} unit={unit}>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.1} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={gridLine} strokeDasharray="0" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={shortDate}
            tick={{ fill: faint, fontSize: 11 }}
            axisLine={{ stroke: gridLine }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis tick={{ fill: faint, fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={['auto', 'auto']} />
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
    </ChartFigure>
  )
}

export function VolumeBarChart({
  title,
  data,
  emptyLabel,
  unit = 'kg',
}: {
  title: string
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
  const points = withTime(data)

  return (
    <ChartFigure
      title={title}
      summary={`Weekly totals for ${data.length} week${data.length === 1 ? '' : 's'}, most recent ${data[data.length - 1]!.value} ${unit}.`}
      data={data}
      unit={unit}
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={gridLine} />
          <XAxis
            dataKey="t"
            tickFormatter={shortDate}
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
    </ChartFigure>
  )
}
