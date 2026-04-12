import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface DateRangeValue {
  fromDate?: string
  toDate?: string
}

interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (range: DateRangeValue) => void
  placeholder?: string
  label?: string
  className?: string
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function getCalendarDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = first.getDay()
  const mondayFirst = startDow === 0 ? 6 : startDow - 1
  const daysInMonth = last.getDate()
  const result: (number | null)[] = []
  for (let i = 0; i < mondayFirst; i++) result.push(null)
  for (let d = 1; d <= daysInMonth; d++) result.push(d)
  const total = result.length
  const remainder = total % 7
  const fill = remainder === 0 ? 0 : 7 - remainder
  for (let i = 0; i < fill; i++) result.push(null)
  return result
}

interface CalendarGridProps {
  from: string
  to: string
  onFromChange: (iso: string) => void
  onToChange: (iso: string) => void
  viewYear: number
  viewMonth: number
  onViewChange: (year: number, month: number) => void
}

function CalendarGrid({
  from,
  to,
  onFromChange,
  onToChange,
  viewYear,
  viewMonth,
  onViewChange,
}: CalendarGridProps) {
  const days = getCalendarDays(viewYear, viewMonth)
  const fromTime = from ? new Date(from + 'T12:00:00').getTime() : 0
  const toTime = to ? new Date(to + 'T12:00:00').getTime() : 0

  const handleDayClick = useCallback(
    (day: number) => {
      const iso = toISO(new Date(viewYear, viewMonth, day))
      if (!from || (from && to)) {
        onFromChange(iso)
        onToChange('')
      } else {
        const fromT = new Date(from + 'T12:00:00').getTime()
        const clickT = new Date(iso + 'T12:00:00').getTime()
        if (clickT < fromT) {
          onFromChange(iso)
          onToChange(from)
        } else {
          onToChange(iso)
        }
      }
    },
    [from, to, viewYear, viewMonth, onFromChange, onToChange]
  )

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) onViewChange(viewYear - 1, 11)
    else onViewChange(viewYear, viewMonth - 1)
  }, [viewYear, viewMonth, onViewChange])

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) onViewChange(viewYear + 1, 0)
    else onViewChange(viewYear, viewMonth + 1)
  }, [viewYear, viewMonth, onViewChange])

  const today = toISO(new Date())

  return (
    <div className="calendar-grid">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          aria-label="Mes anterior"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          aria-label="Mes siguiente"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-xs">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            {w}
          </div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="py-1.5" />
          const iso = toISO(new Date(viewYear, viewMonth, day))
          const t = new Date(iso + 'T12:00:00').getTime()
          const isInRange =
            fromTime && toTime
              ? t >= Math.min(fromTime, toTime) && t <= Math.max(fromTime, toTime)
              : false
          const isStart = iso === from || iso === to
          const isSelected = isStart
          const isToday = iso === today
          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleDayClick(day)}
              className={`
                relative py-1.5 rounded text-slate-700 transition-colors dark:text-slate-200
                hover:bg-sky-100 dark:hover:bg-sky-900/40
                ${isInRange ? 'bg-sky-100 dark:bg-sky-900/30' : ''}
                ${isSelected ? 'bg-sky-500 text-white hover:bg-sky-600 dark:bg-sky-500 dark:hover:bg-sky-600' : ''}
                ${isToday && !isSelected ? 'ring-1 ring-slate-300 dark:ring-slate-500' : ''}
              `}
              aria-label={`${day} ${MONTHS[viewMonth]} ${viewYear}`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Seleccionar rango de fechas',
  label = 'Rango de fechas',
  className = '',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(value.fromDate ?? '')
  const [to, setTo] = useState(value.toDate ?? '')
  const [viewYear, setViewYear] = useState(() => {
    if (value.fromDate) return new Date(value.fromDate + 'T12:00:00').getFullYear()
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (value.fromDate) return new Date(value.fromDate + 'T12:00:00').getMonth()
    return new Date().getMonth()
  })
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const updatePosition = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const gap = 4
    const dropdownWidth = 260
    let left = rect.left
    if (left + dropdownWidth > window.innerWidth) left = window.innerWidth - dropdownWidth - 8
    if (left < 8) left = 8
    setDropdownPosition({ top: rect.bottom + gap, left: Math.round(left) })
  }, [])

  const openPicker = useCallback(() => {
    setFrom(value.fromDate ?? '')
    setTo(value.toDate ?? '')
    if (value.fromDate) {
      const d = new Date(value.fromDate + 'T12:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    } else {
      const n = new Date()
      setViewYear(n.getFullYear())
      setViewMonth(n.getMonth())
    }
    setOpen(true)
    requestAnimationFrame(updatePosition)
  }, [value.fromDate, value.toDate, updatePosition])

  const setPreset = useCallback(
    (fromStr: string, toStr: string) => {
      onChange({ fromDate: fromStr, toDate: toStr })
      setOpen(false)
    },
    [onChange]
  )

  const presets: { label: string; from: string; to: string }[] = (() => {
    const today = new Date()
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() + mondayOffset)
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(lastMonday.getDate() - 7)
    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastSunday.getDate() + 6)
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    return [
      { label: 'Esta semana', from: toISO(thisMonday), to: toISO(now) },
      { label: 'La semana pasada', from: toISO(lastMonday), to: toISO(lastSunday) },
      { label: 'Este mes', from: toISO(firstThisMonth), to: toISO(now) },
      { label: 'El mes pasado', from: toISO(firstLastMonth), to: toISO(lastLastMonth) },
    ]
  })()

  useEffect(() => {
    if (!open) return
    updatePosition()
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      const portal = document.getElementById('date-range-picker-portal')
      if (portal?.contains(target)) return
      setOpen(false)
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleScrollResize = () => updatePosition()
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScrollResize, true)
    window.addEventListener('resize', handleScrollResize)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScrollResize, true)
      window.removeEventListener('resize', handleScrollResize)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open || !from || !to) return
    const valueUnchanged =
      from === (value.fromDate ?? '') && to === (value.toDate ?? '')
    if (valueUnchanged) return
    onChange({ fromDate: from, toDate: to })
    setOpen(false)
  }, [open, from, to, onChange, value.fromDate, value.toDate])

  const displayText =
    value.fromDate && value.toDate
      ? `${formatDisplayDate(value.fromDate)} – ${formatDisplayDate(value.toDate)}`
      : value.fromDate
        ? `Desde ${formatDisplayDate(value.fromDate)}`
        : value.toDate
          ? `Hasta ${formatDisplayDate(value.toDate)}`
          : placeholder

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className="input-base flex w-full min-w-[12rem] cursor-pointer items-center justify-between gap-2 text-left font-normal"
        style={{ appearance: 'none' }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={!value.fromDate && !value.toDate ? 'text-slate-400 dark:text-slate-500' : ''}>
          {displayText}
        </span>
        <span className="pointer-events-none shrink-0 text-slate-400 dark:text-slate-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </span>
      </button>

      {open &&
        createPortal(
          <div
            id="date-range-picker-portal"
            role="dialog"
            aria-label="Rango de fechas"
            className="fixed z-[100] w-[16.25rem] rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            <CalendarGrid
              from={from}
              to={to}
              onFromChange={setFrom}
              onToChange={setTo}
              viewYear={viewYear}
              viewMonth={viewMonth}
              onViewChange={(y, m) => {
                setViewYear(y)
                setViewMonth(m)
              }}
            />
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-600 dark:bg-slate-800/50">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Rangos rápidos</p>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPreset(p.from, p.to)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
