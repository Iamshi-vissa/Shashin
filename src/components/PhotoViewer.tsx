import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Post } from '@/lib/backend'
import { parseDay, timeAgo } from '@/lib/dates'
import { Avatar, displayName } from './ui/Avatar'

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/** Full-screen viewer. Swipe (or arrow keys) to move between posts; swipe down to close. */
export function PhotoViewer({
  posts,
  index,
  onClose,
}: {
  posts: Post[]
  index: number | null
  onClose: () => void
}) {
  return createPortal(
    <AnimatePresence>
      {index !== null && posts[index] && (
        <Viewer key="viewer" posts={posts} start={index} onClose={onClose} />
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Viewer({ posts, start, onClose }: { posts: Post[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const [dir, setDir] = useState(0)

  const go = useCallback(
    (d: number) => {
      setI((cur) => {
        const next = cur + d
        if (next < 0 || next >= posts.length) return cur
        setDir(d)
        return next
      })
    },
    [posts.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [go, onClose])

  const post = posts[Math.min(i, posts.length - 1)]

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      role="dialog"
      aria-modal
      aria-label="Photo viewer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="flex items-center gap-3 px-4 pb-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        <Avatar profile={post.author} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{displayName(post.author)}</p>
          <p className="text-[12px] text-muted">
            {dayFmt.format(parseDay(post.post_date))} · {timeAgo(post.created_at)}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"
        >
          <X size={22} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.img
            key={post.id}
            src={post.image_url}
            alt={post.caption ?? `Photo by ${displayName(post.author)}`}
            className="max-h-full w-full max-w-md touch-none select-none object-contain"
            draggable={false}
            custom={dir}
            initial={{ x: dir >= 0 ? '60%' : '-60%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir >= 0 ? '-60%' : '60%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag
            dragSnapToOrigin
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (info.offset.y > 140) onClose()
              else if (info.offset.x < -70 || info.velocity.x < -500) go(1)
              else if (info.offset.x > 70 || info.velocity.x > 500) go(-1)
            }}
          />
        </AnimatePresence>
        {i > 0 && (
          <button
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="absolute left-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 sm:flex"
          >
            <ChevronLeft />
          </button>
        )}
        {i < posts.length - 1 && (
          <button
            aria-label="Next photo"
            onClick={() => go(1)}
            className="absolute right-2 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 sm:flex"
          >
            <ChevronRight />
          </button>
        )}
      </div>

      <div className="px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}>
        {post.caption && <p className="mb-3 text-[15px] leading-snug">{post.caption}</p>}
        {posts.length > 1 && (
          <p className="text-center text-[12px] text-muted">
            {i + 1} / {posts.length}
          </p>
        )}
      </div>
    </motion.div>
  )
}
