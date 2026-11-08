import { describe, expect, it } from 'vitest'
import {
  addDays,
  bestStreak,
  currentStreak,
  diffDays,
  localDate,
  timeAgo,
  weekLabel,
  weekStart,
} from './dates'

describe('localDate', () => {
  it('uses the local calendar day, not UTC', () => {
    // 23:30 local on Nov 8 is still Nov 8 locally, whatever the UTC date is.
    expect(localDate(new Date(2026, 10, 8, 23, 30))).toBe('2026-11-08')
  })
  it('rolls over exactly at local midnight', () => {
    expect(localDate(new Date(2026, 10, 8, 23, 59, 59))).toBe('2026-11-08')
    expect(localDate(new Date(2026, 10, 9, 0, 0, 0))).toBe('2026-11-09')
  })
})

describe('addDays / diffDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-12-30', '2027-01-02')).toBe(3)
  })
  it('is safe across DST changes', () => {
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
  })
})

describe('weekStart', () => {
  it('returns Monday', () => {
    expect(weekStart('2026-11-08')).toBe('2026-11-02') // Sunday
    expect(weekStart('2026-11-02')).toBe('2026-11-02') // Monday
    expect(weekStart('2026-11-04')).toBe('2026-11-02') // Wednesday
  })
})

describe('streaks', () => {
  const today = '2026-11-08'
  it('counts a streak ending today', () => {
    expect(currentStreak(['2026-11-06', '2026-11-07', '2026-11-08'], today)).toBe(3)
  })
  it('keeps the streak alive until midnight if only yesterday is posted', () => {
    expect(currentStreak(['2026-11-06', '2026-11-07'], today)).toBe(2)
  })
  it('breaks after a missed day', () => {
    expect(currentStreak(['2026-11-05', '2026-11-06'], today)).toBe(0)
    expect(currentStreak([], today)).toBe(0)
  })
  it('finds the best streak', () => {
    expect(bestStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-10', '2026-10-11'])).toBe(
      3,
    )
    expect(bestStreak([])).toBe(0)
  })
})

describe('labels', () => {
  it('labels weeks', () => {
    expect(weekLabel('2026-11-02', '2026-11-08')).toBe('This week')
    expect(weekLabel('2026-10-26', '2026-11-08')).toBe('Last week')
    expect(weekLabel('2026-10-19', '2026-11-08')).toBe('Oct 19 – 25')
    expect(weekLabel('2026-09-28', '2026-11-08')).toBe('Sep 28 – Oct 4')
  })
  it('formats relative time', () => {
    const now = Date.parse('2026-11-08T12:00:00Z')
    expect(timeAgo('2026-11-08T11:59:30Z', now)).toBe('just now')
    expect(timeAgo('2026-11-08T09:00:00Z', now)).toBe('3h ago')
  })
})
