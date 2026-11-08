import clsx from 'clsx'
import type { Profile } from '@/lib/backend'

export function displayName(p: Pick<Profile, 'display_name' | 'username'>) {
  return p.display_name || p.username
}

export function Avatar({
  profile,
  size = 40,
  className,
}: {
  profile: Profile
  size?: number
  className?: string
}) {
  const name = displayName(profile)
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-card-2 font-semibold text-accent',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  )
}
