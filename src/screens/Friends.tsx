import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Search, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FadeContent } from '@/components/bits/FadeContent'
import { PersonRow, RelationButton, relationOf } from '@/components/PersonRow'
import { ProfileSheet } from '@/components/ProfileSheet'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth, useMe } from '@/lib/auth'
import { backend, type Profile } from '@/lib/backend'
import { friendlyError, keys, useFriendships, usePostsInvalidation } from '@/lib/queries'

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function Friends() {
  const me = useMe()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const invalidatePosts = usePostsInvalidation()
  const friendships = useFriendships()
  const [q, setQ] = useState('')
  const query = useDebounced(q.trim().toLowerCase(), 300)
  const [sheet, setSheet] = useState(false)
  const [removing, setRemoving] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)

  const search = useQuery({
    queryKey: ['search', query],
    queryFn: () => backend.searchProfiles(query),
    enabled: query.length > 0,
  })

  const copyInvite = async () => {
    if (!profile) return
    const link = `${window.location.origin}/add/${profile.username}`
    try {
      if (navigator.share) await navigator.share({ title: 'Add me on Shashin', url: link })
      else {
        await navigator.clipboard.writeText(link)
        toast.success('Invite link copied')
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await backend.removeFriendship(removing.id)
      await qc.invalidateQueries({ queryKey: keys.friendships })
      invalidatePosts()
      setRemoving(null)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const f = friendships.data

  return (
    <Screen
      title="Friends"
      action={
        <button
          onClick={() => setSheet(true)}
          aria-label="Profile and settings"
          className="rounded-full"
        >
          {profile ? <Avatar profile={profile} size={40} /> : <Settings className="text-muted" />}
        </button>
      }
    >
      <label className="relative mb-4 block">
        <span className="sr-only">Search by username</span>
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by username"
          autoCapitalize="none"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border border-line bg-card pl-11 pr-4 text-[16px] outline-none placeholder:text-muted/60 focus:border-accent"
        />
      </label>

      {query ? (
        <section aria-label="Search results" className="space-y-2">
          {search.isPending && <Skeleton className="h-[70px] w-full" />}
          {search.isSuccess && search.data.length === 0 && (
            <p className="py-8 text-center text-[14px] text-muted">No one called "{query}" yet</p>
          )}
          {search.data?.map((p, i) => (
            <FadeContent key={p.id} delay={i * 0.03}>
              <PersonRow profile={p}>
                <RelationButton
                  profile={p}
                  relation={relationOf(f, p.id, me)}
                  onRemove={() => setRemoving(p)}
                />
              </PersonRow>
            </FadeContent>
          ))}
        </section>
      ) : (
        <>
          <Button variant="secondary" className="mb-6 w-full" onClick={copyInvite}>
            <Link2 size={18} /> Share my invite link
          </Button>

          {friendships.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-[70px] w-full" />
              <Skeleton className="h-[70px] w-full" />
            </div>
          )}

          {f && f.incoming.length > 0 && (
            <Section title="Requests" count={f.incoming.length}>
              {f.incoming.map((p) => (
                <PersonRow key={p.id} profile={p}>
                  <RelationButton profile={p} relation="incoming" />
                </PersonRow>
              ))}
            </Section>
          )}

          {f && (
            <Section title="Friends" count={f.friends.length}>
              {f.friends.length === 0 && (
                <p className="rounded-2xl border border-dashed border-line p-5 text-center text-[14px] text-muted">
                  Search for a username or share your invite link to add your first friend.
                </p>
              )}
              {f.friends.map((p) => (
                <PersonRow key={p.id} profile={p}>
                  <RelationButton profile={p} relation="friends" onRemove={() => setRemoving(p)} />
                </PersonRow>
              ))}
            </Section>
          )}

          {f && f.outgoing.length > 0 && (
            <Section title="Waiting for them" count={f.outgoing.length}>
              {f.outgoing.map((p) => (
                <PersonRow key={p.id} profile={p}>
                  <RelationButton profile={p} relation="outgoing" />
                </PersonRow>
              ))}
            </Section>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.display_name || removing?.username || ''}?`}
        body="You won't see each other's photos anymore. You can add them again later."
        confirmLabel="Remove"
        loading={busy}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
      <ProfileSheet open={sheet} onClose={() => setSheet(false)} />
    </Screen>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <FadeContent className="mb-7">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-muted">
        {title}
        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] text-ink">{count}</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </FadeContent>
  )
}
