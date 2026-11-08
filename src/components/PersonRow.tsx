import { useQueryClient } from '@tanstack/react-query'
import { Check, Clock, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { backend, type Friendships, type Profile, type Relation } from '@/lib/backend'
import { friendlyError, keys, usePostsInvalidation } from '@/lib/queries'
import { Avatar, displayName } from './ui/Avatar'
import { Button } from './ui/Button'

export function relationOf(f: Friendships | undefined, id: string, me: string): Relation {
  if (id === me) return 'self'
  if (!f) return 'none'
  if (f.friends.some((p) => p.id === id)) return 'friends'
  if (f.incoming.some((p) => p.id === id)) return 'incoming'
  if (f.outgoing.some((p) => p.id === id)) return 'outgoing'
  return 'none'
}

/** Add / Requested / Accept / Friends button for one person. */
export function RelationButton({
  profile,
  relation,
  onRemove,
}: {
  profile: Profile
  relation: Relation
  onRemove?: () => void
}) {
  const qc = useQueryClient()
  const invalidatePosts = usePostsInvalidation()
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: keys.friendships })
      invalidatePosts()
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  switch (relation) {
    case 'self':
      return <span className="text-[13px] text-muted">You</span>
    case 'none':
      return (
        <Button
          size="sm"
          loading={busy}
          onClick={() => run(() => backend.sendFriendRequest(profile.id), 'Request sent')}
        >
          <UserPlus size={16} /> Add
        </Button>
      )
    case 'incoming':
      return (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Decline ${displayName(profile)}`}
            disabled={busy}
            onClick={() => run(() => backend.removeFriendship(profile.id))}
          >
            <X size={16} />
          </Button>
          <Button
            size="sm"
            loading={busy}
            onClick={() =>
              run(
                () => backend.acceptFriendRequest(profile.id),
                `You and ${displayName(profile)} are friends`,
              )
            }
          >
            <Check size={16} /> Accept
          </Button>
        </div>
      )
    case 'outgoing':
      return (
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          onClick={() => run(() => backend.removeFriendship(profile.id), 'Request cancelled')}
        >
          <Clock size={16} /> Requested
        </Button>
      )
    case 'friends':
      return (
        <Button size="sm" variant="ghost" onClick={onRemove} className="text-muted">
          <Check size={16} /> Friends
        </Button>
      )
  }
}

export function PersonRow({ profile, children }: { profile: Profile; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
      <Avatar profile={profile} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{displayName(profile)}</p>
        <p className="truncate text-[13px] text-muted">@{profile.username}</p>
      </div>
      {children}
    </div>
  )
}
