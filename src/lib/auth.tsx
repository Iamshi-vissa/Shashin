import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { backend, type Profile } from './backend'

interface AuthState {
  /** undefined while the stored session is being restored. */
  userId: string | null | undefined
  profile: Profile | null | undefined
}

const AuthContext = createContext<AuthState>({ userId: undefined, profile: undefined })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const qc = useQueryClient()

  useEffect(() => {
    let alive = true
    void backend.getSessionUserId().then((id) => alive && setUserId(id))
    const off = backend.onAuthChange((id) => {
      setUserId((prev) => {
        if (prev !== id) qc.clear()
        return id
      })
    })
    return () => {
      alive = false
      off()
    }
  }, [qc])

  const profile = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => backend.getProfile(userId!),
    enabled: !!userId,
  })

  return (
    <AuthContext.Provider value={{ userId, profile: userId ? profile.data : null }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

/** For screens inside the protected area, where a user is guaranteed. */
export function useMe(): string {
  const { userId } = useContext(AuthContext)
  if (!userId) throw new Error('useMe() used outside a signed-in route')
  return userId
}
