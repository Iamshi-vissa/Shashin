import { useQuery } from '@tanstack/react-query'
import { Camera, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FadeContent } from '@/components/bits/FadeContent'
import { SpotlightCard } from '@/components/bits/SpotlightCard'
import { PhotoViewer } from '@/components/PhotoViewer'
import { PullToRefresh } from '@/components/PullToRefresh'
import { Avatar, displayName } from '@/components/ui/Avatar'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { backend, type Post } from '@/lib/backend'
import { timeAgo } from '@/lib/dates'
import { keys, useMyPostToday } from '@/lib/queries'

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export function Today() {
  const feed = useQuery({
    queryKey: keys.feed,
    queryFn: () => backend.todayFeed(),
    refetchInterval: 60_000,
  })
  const mine = useMyPostToday()
  const [open, setOpen] = useState<number | null>(null)
  const posts = feed.data ?? []

  return (
    <Screen title="Today" subtitle={dateFmt.format(new Date())}>
      <PullToRefresh onRefresh={() => Promise.all([feed.refetch(), mine.refetch()])}>
        {mine.isSuccess && !mine.data && (
          <FadeContent>
            <Link
              to="/post"
              className="mb-5 flex items-center gap-4 rounded-3xl border border-accent/30 bg-accent/10 p-4"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink">
                <Camera size={22} />
              </span>
              <span>
                <span className="block font-semibold text-accent">You haven't posted today</span>
                <span className="block text-[13px] text-muted">
                  Take today's photo before midnight
                </span>
              </span>
            </Link>
          </FadeContent>
        )}

        {feed.isPending && (
          <div className="space-y-5">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="aspect-[3/4] w-full rounded-3xl" />
              </div>
            ))}
          </div>
        )}

        {feed.isError && (
          <p className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-[14px] text-danger">
            Couldn't load the feed. Pull down to try again.
          </p>
        )}

        {feed.isSuccess && posts.length === 0 && (
          <div className="mt-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-card text-muted">
              <Users size={28} />
            </div>
            <p className="mb-1 text-lg font-semibold">Nothing here yet</p>
            <p className="mb-6 text-[14px] text-muted">
              Photos from you and your friends in the last 24 hours show up here.
            </p>
            <Link to="/friends" className="font-semibold text-accent">
              Find friends →
            </Link>
          </div>
        )}

        <div className="space-y-6">
          {posts.map((p, i) => (
            <FadeContent key={p.id} delay={Math.min(i, 4) * 0.05}>
              <FeedCard post={p} onOpen={() => setOpen(i)} />
            </FadeContent>
          ))}
        </div>
      </PullToRefresh>
      <PhotoViewer posts={posts} index={open} onClose={() => setOpen(null)} />
    </Screen>
  )
}

function FeedCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  return (
    <article>
      <div className="mb-3 flex items-center gap-3">
        <Avatar profile={post.author} size={40} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{displayName(post.author)}</p>
          <p className="text-[12px] text-muted">
            @{post.author.username} · {timeAgo(post.created_at)}
          </p>
        </div>
      </div>
      <SpotlightCard className="grain">
        <button
          onClick={onOpen}
          className="block w-full"
          aria-label={`Open photo by ${displayName(post.author)}`}
        >
          <img
            src={post.image_url}
            alt={post.caption ?? `Photo by ${displayName(post.author)}`}
            loading="lazy"
            className="aspect-[3/4] w-full object-cover"
          />
        </button>
      </SpotlightCard>
      {post.caption && <p className="mt-3 px-1 text-[15px] leading-snug">{post.caption}</p>}
    </article>
  )
}
