import React, { useMemo, useState, useCallback } from 'react'
import { useConfig, useElementData, useVariable, useActionTrigger } from '@sigmacomputing/plugin'

// ── Constants ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DOW_SUN = ['S','M','T','W','T','F','S']
const DOW_MON = ['M','T','W','T','F','S','S']

// low → high hex colors per theme
const THEMES = {
  Red:    { low: '#FDDEDE', high: '#8B2222' },
  Blue:   { low: '#D6EAFF', high: '#1B4F8B' },
  Green:  { low: '#D6F5E3', high: '#1A6B3A' },
  Purple: { low: '#F0DEFF', high: '#5B1A8B' },
  Orange: { low: '#FFF0D6', high: '#8B4A1A' },
  Teal:   { low: '#D6F5F5', high: '#1A6B6B' },
}

const AGG_FNS = {
  Sum:     (vals) => vals.reduce((a, b) => a + b, 0),
  Count:   (vals) => vals.length,
  Average: (vals) => vals.reduce((a, b) => a + b, 0) / vals.length,
  Max:     (vals) => Math.max(...vals),
  Min:     (vals) => Math.min(...vals),
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDateKey(val) {
  if (val == null || val === '') return null

  // ISO date-only string (YYYY-MM-DD): return components directly.
  // Do NOT run through new Date() — browsers parse date-only ISO strings as
  // UTC midnight, so local date extraction would shift the day in UTC- timezones.
  if (typeof val === 'string' || typeof val === 'number') {
    const str = String(val).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
    if (/^\d{10}$/.test(str)) {
      const d = new Date(parseInt(str, 10) * 1000)
      if (isNaN(d.getTime())) return null
      return utcKey(d)
    }
    if (/^\d{13}$/.test(str)) {
      const d = new Date(parseInt(str, 10))
      if (isNaN(d.getTime())) return null
      return utcKey(d)
    }
    const d = new Date(str)
    if (isNaN(d.getTime())) return null
    // For ISO datetime strings Sigma sends dates as UTC midnight — use UTC components
    return utcKey(d)
  }

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    // Sigma stores dates as UTC midnight — extract UTC date to get the correct calendar day
    return utcKey(val)
  }

  return null
}

// Extract a YYYY-MM-DD key using UTC components (matches Sigma's UTC-midnight storage)
function utcKey(d) {
  const y   = d.getUTCFullYear()
  const m   = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildMonthGrid(year, month, firstDay) {
  // firstDay: 0 = Sun, 1 = Mon
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth  = new Date(year, month + 1, 0)

  let startDow = firstOfMonth.getDay()
  if (firstDay === 1) startDow = (startDow + 6) % 7

  const weeks = []
  let week = []

  // Leading days from previous month
  for (let i = 0; i < startDow; i++) {
    week.push({ date: new Date(year, month, 1 - (startDow - i)), inMonth: false })
  }

  // Days of this month
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    week.push({ date: new Date(year, month, d), inMonth: true })
    if (week.length === 7) { weeks.push(week); week = [] }
  }

  // Trailing days from next month
  if (week.length > 0) {
    let d = 1
    while (week.length < 7) week.push({ date: new Date(year, month + 1, d++), inMonth: false })
    weeks.push(week)
  }

  return weeks
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function interpolateColor(hex1, hex2, t) {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`
}

function isTextDark(hex1, hex2, t) {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  const lum = (0.299 * (r1 + (r2 - r1) * t) + 0.587 * (g1 + (g2 - g1) * t) + 0.114 * (b1 + (b2 - b1) * t)) / 255
  return lum >= 0.5
}

function valueFontSize(val) {
  const len = String(Math.round(Math.abs(val))).length
  if (len <= 2) return 28
  if (len <= 3) return 24
  if (len <= 5) return 19
  return 15
}

function formatValue(val, aggMethod) {
  if (val == null) return null
  if (aggMethod === 'Average') {
    return val % 1 === 0 ? val.toLocaleString() : val.toFixed(1)
  }
  return Math.round(val).toLocaleString()
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const config = useConfig()

  const sourceId   = config?.source
  const dateCol    = config?.dateColumn
  const valueCol   = config?.valueColumn
  const aggMethod  = config?.aggregation  || 'Sum'
  const title      = config?.title        || 'Calendar'
  const subtitle   = config?.subtitle     || ''
  const totalLabel = config?.totalLabel   || title
  const showTotal  = config?.showTotal !== false && config?.showTotal !== 'false'
  const colorTheme = config?.colorTheme   || 'Red'
  const firstDay   = config?.firstDay === 'Monday' ? 1 : 0

  const elementData = useElementData(sourceId)

  const [, setSelectedDate] = useVariable('selectedDate')
  const triggerDayClick     = useActionTrigger('onDayClick')

  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const theme     = THEMES[colorTheme] || THEMES.Red
  const dowLabels = firstDay === 1 ? DOW_MON : DOW_SUN

  // ── Aggregate Sigma data into { 'YYYY-MM-DD': value } ───────────────────
  const dayMap = useMemo(() => {
    const map = new Map()
    if (!elementData || !dateCol || !valueCol) return map

    const dates  = elementData[dateCol]  ?? []
    const values = elementData[valueCol] ?? []
    const aggFn  = AGG_FNS[aggMethod] || AGG_FNS.Sum

    const groups = new Map()
    const isCount = aggMethod === 'Count'
    for (let i = 0; i < dates.length; i++) {
      const key = parseDateKey(dates[i])
      if (!key) continue
      // Count aggregation works with any column type — it just counts rows.
      // All other methods require a numeric value; skip NaN rows.
      const v = isCount ? 1 : Number(values[i])
      if (!isCount && isNaN(v)) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(v)
    }

    for (const [key, vals] of groups) {
      map.set(key, aggFn(vals))
    }

    return map
  }, [elementData, dateCol, valueCol, aggMethod])

  const weeks = useMemo(() => buildMonthGrid(viewYear, viewMonth, firstDay), [viewYear, viewMonth, firstDay])

  // ── Month stats ──────────────────────────────────────────────────────────
  const { monthTotal, monthMax } = useMemo(() => {
    let total = 0, max = 0
    for (const { date, inMonth } of weeks.flat()) {
      if (!inMonth) continue
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
      const val = dayMap.get(key)
      if (val != null) { total += val; if (val > max) max = val }
    }
    return { monthTotal: total, monthMax: max }
  }, [weeks, dayMap])

  // ── Navigation ────────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }, [viewMonth])

  const handleNext = useCallback(() => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }, [viewMonth])

  // ── Day click ─────────────────────────────────────────────────────────────
  const handleDayClick = useCallback((cell) => {
    if (!cell.inMonth) return
    const key = `${cell.date.getFullYear()}-${String(cell.date.getMonth()+1).padStart(2,'0')}-${String(cell.date.getDate()).padStart(2,'0')}`
    setSelectedDate(key)
    triggerDayClick()
  }, [setSelectedDate, triggerDayClick])

  const isConfigured = !!(sourceId && dateCol && valueCol)

  return (
    <div className="hc-root">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="hc-header">
        <div className="hc-title">{title}</div>
        {subtitle && <div className="hc-subtitle">{subtitle}</div>}
        {showTotal && isConfigured && (
          <div className="hc-kpi">
            <span className="hc-kpi-num">{Math.round(monthTotal).toLocaleString()}</span>
            <span className="hc-kpi-label">{totalLabel}</span>
          </div>
        )}
      </div>

      {/* ── Month nav ─────────────────────────────────────────────────── */}
      <div className="hc-nav">
        <button className="hc-nav-btn" onClick={handlePrev} aria-label="Previous month">&#8249;</button>
        <button className="hc-nav-btn" onClick={handleNext} aria-label="Next month">&#8250;</button>
        <span className="hc-nav-label">{MONTH_NAMES[viewMonth].toUpperCase()} {viewYear}</span>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      <div className="hc-grid">
        {/* Day-of-week header */}
        <div className="hc-dow-row">
          {dowLabels.map((lbl, i) => (
            <div key={i} className="hc-dow-cell">{lbl}</div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div key={wi} className="hc-week">
            {week.map((cell, di) => {
              const key = `${cell.date.getFullYear()}-${String(cell.date.getMonth()+1).padStart(2,'0')}-${String(cell.date.getDate()).padStart(2,'0')}`
              const val = cell.inMonth ? dayMap.get(key) : null

              let bgColor   = cell.inMonth ? '#f9fafb' : '#f3f4f6'
              let dateColor = cell.inMonth ? '#6b7280' : '#d1d5db'
              let valColor  = '#111827'

              if (cell.inMonth && val != null && val > 0 && monthMax > 0) {
                const t = val / monthMax
                bgColor  = interpolateColor(theme.low, theme.high, t)
                const dark = isTextDark(theme.low, theme.high, t)
                valColor  = dark ? '#111827' : '#ffffff'
                dateColor = dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)'
              }

              const fontSize = val != null ? valueFontSize(val) : 28

              return (
                <div
                  key={di}
                  className={`hc-cell${cell.inMonth ? ' hc-in' : ' hc-out'}`}
                  style={{ backgroundColor: bgColor, cursor: cell.inMonth ? 'pointer' : 'default' }}
                  onClick={() => handleDayClick(cell)}
                >
                  <span className="hc-date" style={{ color: dateColor }}>
                    {cell.date.getDate()}
                  </span>
                  {val != null && (
                    <span className="hc-val" style={{ color: valColor, fontSize }}>
                      {formatValue(val, aggMethod)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── Empty state overlay ───────────────────────────────────────── */}
      {!isConfigured && (
        <div className="hc-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="hc-empty-heading">Calendar Heatmap</p>
          <p className="hc-empty-body">
            Set <strong>Data Source</strong>, <strong>Date Column</strong>,<br />
            and <strong>Value Column</strong> in the editor panel.
          </p>
        </div>
      )}
    </div>
  )
}
