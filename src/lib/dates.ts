/**
 * Date helpers. All "days" are calendar dates in the phone's local time zone,
 * formatted as YYYY-MM-DD. Never use toISOString() for a day: that is UTC.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day of `d` as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse YYYY-MM-DD as local midnight. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Add `n` calendar days to a YYYY-MM-DD string (DST-safe). */
export function addDays(day: string, n: number): string {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

/** Whole calendar days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = parseDay(day).getDay() // 0 = Sunday
  return addDays(day, -((dow + 6) % 7))
}

/** The 7 days (Mon..Sun) of the week starting at `monday`. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/**
 * Consecutive posting days ending today, or ending yesterday if today
 * has no post yet (the streak is still alive until midnight).
 */
export function currentStreak(days: Iterable<string>, today: string = localDate()): number {
  const set = new Set(days)
  let cursor = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(cursor)) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

/** Longest run of consecutive days. */
export function bestStreak(days: Iterable<string>): number {
  const sorted = [...new Set(days)].sort()
  let best = 0
  let run = 0
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && diffDays(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "This week" / "Last week" / "Oct 27 – Nov 2". */
export function weekLabel(monday: string, today: string = localDate()): string {
  const thisWeek = weekStart(today)
  if (monday === thisWeek) return 'This week'
  if (monday === addDays(thisWeek, -7)) return 'Last week'
  const a = parseDay(monday)
  const b = parseDay(addDays(monday, 6))
  const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`
  const right =
    a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${MONTHS[b.getMonth()]} ${b.getDate()}`
  const year = a.getFullYear() !== parseDay(today).getFullYear() ? `, ${b.getFullYear()}` : ''
  return `${left} – ${right}${year}`
}

export function monthLabel(day: string): string {
  const d = parseDay(day)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86_400)}d ago`
}
