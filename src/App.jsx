import React, { useMemo, useState, useCallback, useRef } from 'react'
import { useConfig, useElementData, useVariable, useActionTrigger } from '@sigmacomputing/plugin'

// ── Constants ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const DOW_SUN = ['S','M','T','W','T','F','S']
const DOW_MON = ['M','T','W','T','F','S','S']

const THEMES = {
  Red:    { low: '#FDDEDE', high: '#8B2222' },
  Blue:   { low: '#D6EAFF', high: '#1B4F8B' },
  Green:  { low: '#D6F5E3', high: '#1A6B3A' },
  Purple: { low: '#F0DEFF', high: '#5B1A8B' },
  Orange: { low: '#FFF0D6', high: '#8B4A1A' },
  Teal:   { low: '#D6F5F5', high: '#1A6B6B' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDateKey(val) {
  if (val == null || val === '') return null
  if (typeof val === 'string') {
    const str = val.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str  // date-only ISO: return as-is
    if (/^\d{13}$/.test(str)) return utcKey(new Date(parseInt(str, 10)))
    if (/^\d{10}$/.test(str)) return utcKey(new Date(parseInt(str, 10) * 1000))
    const d = new Date(str)
    return isNaN(d.getTime()) ? null : utcKey(d)
  }
  if (typeof val === 'number') {
    const d = new Date(val > 9999999999 ? val : val * 1000)
    return isNaN(d.getTime()) ? null : utcKey(d)
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : utcKey(val)
  }
  return null
}

// Sigma stores dates as UTC midnight — always extract UTC components
function utcKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}

// Key from a calendar-grid Date (local time, built via new Date(year, month, day))
function cellKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function buildMonthGrid(year, month, firstDay) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  let startDow = first.getDay()
  if (firstDay === 1) startDow = (startDow + 6) % 7

  const weeks = []
  let week = []
  for (let i = 0; i < startDow; i++)
    week.push({ date: new Date(year, month, 1 - (startDow - i)), inMonth: false })
  for (let d = 1; d <= last.getDate(); d++) {
    week.push({ date: new Date(year, month, d), inMonth: true })
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    let d = 1
    while (week.length < 7) week.push({ date: new Date(year, month + 1, d++), inMonth: false })
    weeks.push(week)
  }
  return weeks
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

function interpolateColor(hex1, hex2, t) {
  const [r1,g1,b1] = hexToRgb(hex1), [r2,g2,b2] = hexToRgb(hex2)
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`
}

function isTextDark(hex1, hex2, t) {
  const [r1,g1,b1] = hexToRgb(hex1), [r2,g2,b2] = hexToRgb(hex2)
  const lum = (0.299*(r1+(r2-r1)*t) + 0.587*(g1+(g2-g1)*t) + 0.114*(b1+(b2-b1)*t)) / 255
  return lum >= 0.5
}

function valueFontSize(val) {
  const len = String(Math.round(Math.abs(val))).length
  if (len <= 2) return 32
  if (len <= 3) return 27
  if (len <= 5) return 21
  return 16
}

function formatValue(val, aggMethod) {
  if (val == null) return ''
  if (aggMethod === 'Average') return val % 1 === 0 ? val.toLocaleString() : val.toFixed(1)
  return Math.round(val).toLocaleString()
}

function formatDateLabel(key) {
  if (!key) return ''
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// ── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const config = useConfig()

  const sourceId   = config?.source
  const dateCol    = config?.dateColumn
  const valueCol   = config?.valueColumn
  const detailCol  = config?.detailColumn
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

  const rootRef = useRef(null)

  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [tooltip,   setTooltip]   = useState(null)

  const theme     = THEMES[colorTheme] || THEMES.Red
  const dowLabels = firstDay === 1 ? DOW_MON : DOW_SUN

  // ── Aggregate data ────────────────────────────────────────────────────────
  const { dayMap, detailMap } = useMemo(() => {
    const dayMap    = new Map()
    const detailMap = new Map()
    if (!elementData || !dateCol || !valueCol) return { dayMap, detailMap }

    const dates      = elementData[dateCol]  ?? []
    const values     = elementData[valueCol] ?? []
    const detailSrc  = detailCol ? (elementData[detailCol] ?? []) : values
    const isCount    = aggMethod === 'Count'
    const isDistinct = aggMethod === 'Count Distinct'

    // numGroups: date → number[]  (for Sum/Avg/Max/Min)
    // rawGroups: date → string[]  (for Count/Count Distinct)
    // detailGroups: date → string[]  (tooltip display)
    const numGroups    = new Map()
    const rawGroups    = new Map()
    const detailGroups = new Map()

    for (let i = 0; i < dates.length; i++) {
      const key = parseDateKey(dates[i])
      if (!key) continue

      const numV = Number(values[i])
      if (!isNaN(numV)) {
        if (!numGroups.has(key)) numGroups.set(key, [])
        numGroups.get(key).push(numV)
      }

      const rawV = values[i] != null ? String(values[i]) : null
      if (rawV != null) {
        if (!rawGroups.has(key)) rawGroups.set(key, [])
        rawGroups.get(key).push(rawV)
      }

      const detailV = detailSrc[i] != null ? String(detailSrc[i]) : null
      if (detailV != null) {
        if (!detailGroups.has(key)) detailGroups.set(key, [])
        detailGroups.get(key).push(detailV)
      }
    }

    const allKeys = new Set([...numGroups.keys(), ...rawGroups.keys()])
    let hasNumeric = false
    for (const [,v] of numGroups) if (v.length) { hasNumeric = true; break }

    for (const key of allKeys) {
      const numVals = numGroups.get(key) ?? []
      const rawVals = rawGroups.get(key) ?? []

      let val
      if (isCount)    val = rawVals.length
      else if (isDistinct) val = new Set(rawVals).size
      else if (!hasNumeric) val = rawVals.length  // non-numeric column fallback → count
      else {
        switch (aggMethod) {
          case 'Sum':     val = numVals.reduce((a,b) => a+b, 0); break
          case 'Average': val = numVals.reduce((a,b) => a+b, 0) / numVals.length; break
          case 'Max':     val = Math.max(...numVals); break
          case 'Min':     val = Math.min(...numVals); break
          default:        val = numVals.length
        }
      }
      dayMap.set(key, val)
    }

    for (const [key, vals] of detailGroups) detailMap.set(key, vals)
    return { dayMap, detailMap }
  }, [elementData, dateCol, valueCol, detailCol, aggMethod])

  const weeks = useMemo(() => buildMonthGrid(viewYear, viewMonth, firstDay), [viewYear, viewMonth, firstDay])

  const { monthTotal, monthMax } = useMemo(() => {
    let total = 0, max = 0
    for (const { date, inMonth } of weeks.flat()) {
      if (!inMonth) continue
      const val = dayMap.get(cellKey(date))
      if (val != null) { total += val; if (val > max) max = val }
    }
    return { monthTotal: total, monthMax: max }
  }, [weeks, dayMap])

  const handlePrev = useCallback(() => {
    if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11) }
    else setViewMonth(m => m-1)
  }, [viewMonth])

  const handleNext = useCallback(() => {
    if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0) }
    else setViewMonth(m => m+1)
  }, [viewMonth])

  const handleDayClick = useCallback((cell) => {
    if (!cell.inMonth) return
    const key = cellKey(cell.date)
    if (config?.selectedDate) setSelectedDate(key)
    if (config?.onDayClick)   triggerDayClick()
  }, [config, setSelectedDate, triggerDayClick])

  const handleMouseEnter = useCallback((cell, e) => {
    if (!cell.inMonth) return
    const key   = cellKey(cell.date)
    const value = dayMap.get(key)
    if (value == null) return
    const details  = detailMap.get(key) ?? []
    const cellRect = e.currentTarget.getBoundingClientRect()
    const rootRect = rootRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }

    // All coords are relative to .hc-root so position:absolute stays inside it
    const cW = rootRect.width
    const cH = rootRect.height
    const cLeft  = cellRect.left  - rootRect.left
    const cRight = cellRect.right - rootRect.left
    const cTop   = cellRect.top   - rootRect.top

    const tipW  = 220
    const shown = Math.min(details.length, 12)
    // Estimate rendered height: base + list header + items + overflow line
    const tipH  = 82 + (shown > 0 ? 12 + shown * 19 + (details.length > 12 ? 20 : 0) : 0)

    // Prefer right of cell; fall back to left; hard-clamp to container
    let x = cRight + 8 + tipW <= cW - 4 ? cRight + 8 : cLeft - tipW - 8
    x = Math.max(4, Math.min(x, cW - tipW - 4))

    let y = cTop
    y = Math.max(4, Math.min(y, cH - tipH - 4))

    setTooltip({ key, value, details, x, y })
  }, [dayMap, detailMap])

  const isConfigured = !!(sourceId && dateCol && valueCol)

  return (
    <div className="hc-root" ref={rootRef} onMouseLeave={() => setTooltip(null)}>
      {/* ── Header ─────────────────────────────────────────────────── */}
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

      {/* ── Month nav ──────────────────────────────────────────────── */}
      <div className="hc-nav">
        <button className="hc-nav-btn" onClick={handlePrev}>&#8249;</button>
        <button className="hc-nav-btn" onClick={handleNext}>&#8250;</button>
        <span className="hc-nav-label">{MONTH_NAMES[viewMonth].toUpperCase()} {viewYear}</span>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────── */}
      <div className="hc-grid">
        <div className="hc-dow-row">
          {dowLabels.map((lbl, i) => <div key={i} className="hc-dow-cell">{lbl}</div>)}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="hc-week">
            {week.map((cell, di) => {
              const key = cellKey(cell.date)
              const val = cell.inMonth ? dayMap.get(key) : null

              let bg       = cell.inMonth ? '#fafafa' : '#f5f5f5'
              let dateClr  = cell.inMonth ? '#9ca3af' : '#d1d5db'
              let valClr   = '#111827'

              if (cell.inMonth && val != null && val > 0 && monthMax > 0) {
                const t = val / monthMax
                bg      = interpolateColor(theme.low, theme.high, t)
                const dark = isTextDark(theme.low, theme.high, t)
                valClr  = dark ? '#111827' : '#ffffff'
                dateClr = dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'
              }

              return (
                <div
                  key={di}
                  className={`hc-cell${cell.inMonth ? ' hc-in' : ' hc-out'}`}
                  style={{ backgroundColor: bg, cursor: cell.inMonth ? 'pointer' : 'default' }}
                  onClick={() => handleDayClick(cell)}
                  onMouseEnter={(e) => handleMouseEnter(cell, e)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <span className="hc-date" style={{ color: dateClr }}>{cell.date.getDate()}</span>
                  {val != null && (
                    <span className="hc-val" style={{ color: valClr, fontSize: valueFontSize(val) }}>
                      {formatValue(val, aggMethod)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── Tooltip ────────────────────────────────────────────────── */}
      {tooltip && (
        <div className="hc-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="hc-tooltip-date">{formatDateLabel(tooltip.key)}</div>
          <div className="hc-tooltip-value">
            {formatValue(tooltip.value, aggMethod)}
            <span className="hc-tooltip-value-label"> {totalLabel}</span>
          </div>
          {tooltip.details.length > 0 && (
            <div className="hc-tooltip-list">
              {tooltip.details.slice(0, 12).map((d, i) => (
                <div key={i} className="hc-tooltip-item">{d}</div>
              ))}
              {tooltip.details.length > 12 && (
                <div className="hc-tooltip-more">+{tooltip.details.length - 12} more</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state overlay ─────────────────────────────────────── */}
      {!isConfigured && (
        <div className="hc-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p className="hc-empty-heading">Calendar Heatmap</p>
          <p className="hc-empty-body">Set <strong>Data Source</strong>, <strong>Date Column</strong>, and <strong>Value Column</strong> in the editor panel.</p>
        </div>
      )}
    </div>
  )
}
