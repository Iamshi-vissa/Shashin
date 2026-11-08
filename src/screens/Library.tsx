import { useInfiniteQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { motion } from 'motion/react'
import { Grid3x3, Rows3, Star } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { CountUp } from '@/components/bits/CountUp'
import { FadeContent } from '@/components/bits/FadeContent'
import { PhotoViewer } from '@/components/PhotoViewer'
import { Avatar, displayName } from '@/components/ui/Avatar'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth, useMe } from '@/lib/auth'
import { backend, type Post, type Profile } from '@/lib/backend'
import {
  addDays,
  bestStreak,
  currentStreak,
  localDate,
  monthLabel,
  parseDay,
  weekDays,
  weekLabel,
  weekStart,
} from '@/lib/dates'
import { keys, useFriendships, usePostDates } from '@/lib/queries'

const WEEKS_PER_PAGE = 8
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function Library() {
  const me = useMe()
  const { profile } = useAuth()
  const friendships = useFriendships()
  const [selected, setSelected] = useState(me)
  const [view, setView] = useState<'weeks' | 'grid'>('weeks')

  const people: Profile[] = useMemo(
    () => [...(profile ? [profile] : []), ...(friendships.data?.friends ?? [])],
    [profile, friendships.data],
  )
  const person = people.find((p) => p.id === selected)

  return (
    <Screen
      title="Library"
      subtitle={
        selected === me ? 'Your days, week by week' : `${person ? displayName(person) : ''}'s days`
      }
      action={
        <div
          className="flex rounded-2xl border border-line bg-card p-1"
          role="tablist"
          aria-label="View"
        >
          {(
            [
              ['weeks', Rows3, 'Weeks'],
              ['grid', Grid3x3, 'Grid'],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              aria-label={label}
              onClick={() => setView(v)}
              className={clsx(
                'flex h-9 w-10 items-center justify-center rounded-xl transition',
                view === v ? 'bg-card-2 text-ink' : 'text-muted',
              )}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
      }
    >
      {people.length > 1 && (
        <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              aria-pressed={selected === p.id}
              className={clsx(
                'flex h-10 shrink-0 items-center gap-2 rounded-full border pl-1 pr-4 text-[14px] font-medium transition',
                selected === p.id
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-line bg-card text-ink',
              )}
            >
              <Avatar profile={p} size={30} />
              {p.id === me ? 'Me' : displayName(p)}
            </button>
          ))}
        </div>
      )}
      <PersonLibrary key={selected} userId={selected} view={view} />
    </Screen>
  )
}

function PersonLibrary({ userId, view }: { userId: string; view: 'weeks' | 'grid' }) {
  const today = localDate()
  const thisMonday = weekStart(today)
  const dates = usePostDates(userId)
  const earliest = dates.data?.length ? dates.data[dates.data.length - 1] : today

  const pages = useInfiniteQuery({
    queryKey: keys.library(userId),
    initialPageParam: 0,
    enabled: dates.isSuccess,
    queryFn: async ({ pageParam }) => {
      const newestMonday = addDays(thisMonday, -7 * WEEKS_PER_PAGE * pageParam)
      const oldestMonday = addDays(newestMonday, -7 * (WEEKS_PER_PAGE - 1))
      const posts = await backend.postsForUser(userId, oldestMonday, addDays(newestMonday, 6))
      const mondays = Array.from({ length: WEEKS_PER_PAGE }, (_, i) =>
        addDays(newestMonday, -7 * i),
      )
      return {
        mondays: mondays.filter((m) => addDays(m, 6) >= weekStart(earliest)),
        posts,
        oldestMonday,
      }
    },
    getNextPageParam: (last, _all, param) => (last.oldestMonday > earliest ? param + 1 : undefined),
  })

  const allPosts = useMemo(() => pages.data?.pages.flatMap((p) => p.posts) ?? [], [pages.data])
  const byDay = useMemo(() => new Map(allPosts.map((p) => [p.post_date, p])), [allPosts])
  const mondays = useMemo(() => pages.data?.pages.flatMap((p) => p.mondays) ?? [], [pages.data])
  // Viewer goes oldest → newest so swiping left moves forward in time.
  const chrono = useMemo(
    () => [...allPosts].sort((a, b) => a.post_date.localeCompare(b.post_date)),
    [allPosts],
  )
  const [open, setOpen] = useState<number | null>(null)
  const openPost = (p: Post) => setOpen(chrono.findIndex((x) => x.id === p.id))

  const stats = useMemo(() => {
    const d = dates.data ?? []
    const weekSet = new Set(weekDays(thisMonday))
    return {
      total: d.length,
      current: currentStreak(d, today),
      week: d.filter((x) => weekSet.has(x)).length,
      best: bestStreak(d),
    }
  }, [dates.data, thisMonday, today])

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pages.hasNextPage && !pages.isFetchingNextPage)
          void pages.fetchNextPage()
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [pages])

  return (
    <>
      <div className="mb-6 grid grid-cols-4 gap-2">
        <Stat label="Photos" value={stats.total} />
        <Stat label="Streak" value={stats.current} accent />
        <Stat label="This week" value={stats.week} suffix="/7" />
        <Stat label="Best" value={stats.best} />
      </div>

      {(dates.isPending || pages.isPending) && (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-36 w-full rounded-3xl" />
        </div>
      )}

      {dates.isSuccess && dates.data.length === 0 && (
        <p className="mb-6 rounded-2xl border border-dashed border-line p-5 text-center text-[14px] text-muted">
          No photos yet. Each day you post fills a square here.
        </p>
      )}

      {view === 'weeks' ? (
        <div>
          {mondays.map((m, i) => {
            const newMonth = i === 0 || monthLabel(m) !== monthLabel(mondays[i - 1])
            return (
              <Fragment key={m}>
                {newMonth && (
                  <div
                    className="sticky z-20 -mx-5 bg-bg/85 px-5 py-2 text-[13px] font-semibold uppercase tracking-wider text-muted backdrop-blur"
                    style={{ top: 'calc(var(--safe-top) + 88px)' }}
                  >
                    {monthLabel(m)}
                  </div>
                )}
                <WeekCard monday={m} today={today} byDay={byDay} onOpen={openPost} />
              </Fragment>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {allPosts.map((p, i) => (
            <FadeContent key={p.id} delay={(i % 9) * 0.02}>
              <button
                onClick={() => openPost(p)}
                className="block w-full overflow-hidden rounded-xl"
                aria-label={`Open photo from ${p.post_date}`}
              >
                <img
                  src={p.image_url}
                  alt=""
                  loading="lazy"
                  className="aspect-[3/4] w-full object-cover transition hover:scale-105"
                />
              </button>
            </FadeContent>
          ))}
        </div>
      )}

      <div ref={sentinel} className="h-10" />
      {pages.isFetchingNextPage && <Skeleton className="h-36 w-full rounded-3xl" />}
      <PhotoViewer posts={chrono} index={open} onClose={() => setOpen(null)} />
    </>
  )
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string
  value: number
  suffix?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-line bg-card px-2 py-3 text-center">
      <p
        className={clsx('text-[22px] font-bold tabular-nums leading-none', accent && 'text-accent')}
      >
        <CountUp to={value} />
        {suffix && <span className="text-[13px] font-medium text-muted">{suffix}</span>}
      </p>
      <p className="mt-1.5 text-[11px] text-muted">{label}</p>
    </div>
  )
}

function WeekCard({
  monday,
  today,
  byDay,
  onOpen,
}: {
  monday: string
  today: string
  byDay: Map<string, Post>
  onOpen: (p: Post) => void
}) {
  const days = weekDays(monday)
  const count = days.filter((d) => byDay.has(d)).length
  const perfect = count === 7

  return (
    <FadeContent className="mb-4">
      <section
        aria-label={weekLabel(monday, today)}
        className={clsx(
          'rounded-3xl border bg-card p-3.5',
          perfect ? 'border-accent/50' : 'border-line',
        )}
      >
        <header className="mb-3 flex items-center justify-between px-0.5">
          <h3 className="text-[15px] font-semibold">{weekLabel(monday, today)}</h3>
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            {perfect && (
              <motion.span
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                className="text-accent"
              >
                <Star size={15} fill="currentColor" aria-label="Perfect week" />
              </motion.span>
            )}
            <span className={clsx('tabular-nums', perfect && 'font-semibold text-accent')}>
              {count}/7
            </span>
          </span>
        </header>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const post = byDay.get(d)
            const isToday = d === today
            const future = d > today
            return (
              <div key={d} className="text-center">
                <button
                  disabled={!post}
                  onClick={() => post && onOpen(post)}
                  aria-label={`${parseDay(d).toDateString()}${post ? '' : future ? ', upcoming' : ', no photo'}`}
                  className={clsx(
                    'relative block aspect-[3/4] w-full overflow-hidden rounded-lg',
                    post ? 'bg-card-2' : future ? 'border border-dashed border-line' : 'bg-bg/60',
                    isToday && 'ring-2 ring-accent ring-offset-2 ring-offset-card',
                  )}
                >
                  {post && (
                    <img
                      src={post.image_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
                <span
                  className={clsx(
                    'mt-1 block text-[10px]',
                    isToday ? 'font-bold text-accent' : 'text-muted',
                  )}
                >
                  {DOW[i]}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </FadeContent>
  )
}
