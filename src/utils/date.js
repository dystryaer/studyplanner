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
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  const dayNr = (target.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)

  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstDayNr = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3)

  return 1 + Math.round((target - firstThursday) / 604800000)
}

export function getDueState(value) {
  if (!value) return ''

  const [year, month, day] = value.split('-').map(Number)
  const dueDate = new Date(year, month - 1, day)
  const today = new Date()

  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const diffInMs = dueDay.getTime() - todayDay.getTime()
  const diffInDays = Math.round(diffInMs / 86400000)

  if (diffInDays < 0) return 'overdue'
  if (diffInDays <= 2) return 'soon'
  return ''
}

export function formatWeekdayShort(dateString) {
  const date = parseLocalDate(dateString);

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
  });
}