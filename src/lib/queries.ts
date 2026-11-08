import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { backend } from './backend'
import { localDate } from './dates'

export const keys = {
  feed: ['feed'] as const,
  myPost: (day: string) => ['my-post', day] as const,
  friendships: ['friendships'] as const,
  postDates: (userId: string) => ['post-dates', userId] as const,
  library: (userId: string) => ['library', userId] as const,
}

/** Invalidate everything that depends on posts. */
export function usePostsInvalidation() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: keys.feed })
    void qc.invalidateQueries({ queryKey: ['my-post'] })
    void qc.invalidateQueries({ queryKey: ['post-dates'] })
    void qc.invalidateQueries({ queryKey: ['library'] })
  }
}

/** Keep feed/library fresh when posts or friendships change elsewhere (Realtime / demo). */
export function useLiveUpdates() {
  const qc = useQueryClient()
  const invalidatePosts = usePostsInvalidation()
  useEffect(() => {
    const off = backend.subscribePosts(() => {
      invalidatePosts()
      void qc.invalidateQueries({ queryKey: keys.friendships })
    })
    const onFriends = () => {
      void qc.invalidateQueries({ queryKey: keys.friendships })
      invalidatePosts()
    }
    window.addEventListener('shashin:friends-changed', onFriends)
    return () => {
      off()
      window.removeEventListener('shashin:friends-changed', onFriends)
    }
  }, [qc])
}

export function useFriendships() {
  return useQuery({ queryKey: keys.friendships, queryFn: () => backend.listFriendships() })
}

export function useMyPostToday() {
  const day = localDate()
  return useQuery({ queryKey: keys.myPost(day), queryFn: () => backend.myPostForDate(day) })
}

export function usePostDates(userId: string) {
  return useQuery({
    queryKey: keys.postDates(userId),
    queryFn: () => backend.postDatesForUser(userId),
  })
}

export function friendlyError(e: unknown): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e && 'message' in e
        ? String(e.message)
        : String(e)
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password'
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first, then sign in'
  if (/already registered/i.test(msg)) return 'An account with this email already exists'
  if (/failed to fetch|network/i.test(msg)) return "Can't reach the server. Check your connection."
  if (/database error saving new user/i.test(msg)) return 'That username is invalid or taken'
  return msg || 'Something went wrong'
}
