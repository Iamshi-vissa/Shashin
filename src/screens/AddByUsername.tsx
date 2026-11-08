import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { RelationButton, relationOf } from '@/components/PersonRow'
import { Avatar, displayName } from '@/components/ui/Avatar'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMe } from '@/lib/auth'
import { backend } from '@/lib/backend'
import { useFriendships } from '@/lib/queries'

/** /add/:username — landing page for invite links. */
export function AddByUsername() {
  const { username = '' } = useParams()
  const me = useMe()
  const friendships = useFriendships()
  const person = useQuery({
    queryKey: ['profile-by-username', username],
    queryFn: () => backend.getProfileByUsername(username),
  })

  return (
    <Screen
      title="Invite"
      action={
        <Link to="/friends" className="flex h-10 items-center gap-1 text-[14px] text-muted">
          <ArrowLeft size={16} /> Friends
        </Link>
      }
    >
      {person.isPending && <Skeleton className="h-64 w-full rounded-3xl" />}
      {person.isSuccess && !person.data && (
        <p className="py-16 text-center text-muted">There's no one called @{username}.</p>
      )}
      {person.data && (
        <div className="flex flex-col items-center rounded-3xl border border-line bg-card px-6 py-10 text-center">
          <Avatar profile={person.data} size={96} />
          <p className="mt-4 text-xl font-semibold">{displayName(person.data)}</p>
          <p className="mb-6 text-muted">@{person.data.username}</p>
          <RelationButton
            profile={person.data}
            relation={relationOf(friendships.data, person.data.id, me)}
          />
        </div>
      )}
    </Screen>
  )
}
