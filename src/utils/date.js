import { getIsoWeek } from './calendar.js'

export function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export function formatDueDate(value) {
  if (!value) return ''

  const [year, month, day] = value.split('-').map(Number)

  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}

export function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatSelectedDate(date) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

export function getWeekNumber(date) {
  return getIsoWeek(date).week
}

export function getDueState(value, now = new Date()) {
  if (!value) return ''

  const [year, month, day] = value.split('-').map(Number)
  const dueDate = new Date(year, month - 1, day)
  const today = now

  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const diffInMs = dueDay.getTime() - todayDay.getTime()
  const diffInDays = Math.round(diffInMs / 86400000)

  if (diffInDays < 0) return 'overdue'
  if (diffInDays <= 2) return 'soon'
  return ''
}

export function formatTimeRange(startTime, endTime) {
  if (startTime && endTime) return `${startTime} - ${endTime}`
  if (startTime) return startTime
  return ''
}

export function formatWeekdayShort(dateString) {
  const date = parseLocalDate(dateString);

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
  });
}