import { AnimatePresence, motion } from 'motion/react'
import { Check, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { Aurora } from '@/components/bits/Aurora'
import { BlurText } from '@/components/bits/BlurText'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/lib/auth'
import { backend } from '@/lib/backend'
import { friendlyError } from '@/lib/queries'

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

type Availability = 'idle' | 'invalid' | 'checking' | 'free' | 'taken'

export function SignIn() {
  const { userId } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [avail, setAvail] = useState<Availability>('idle')
  const [busy, setBusy] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  useEffect(() => {
    if (mode !== 'up' || !username) return setAvail('idle')
    if (!USERNAME_RE.test(username)) return setAvail('invalid')
    setAvail('checking')
    let alive = true
    const t = setTimeout(() => {
      backend
        .usernameAvailable(username)
        .then((ok) => alive && setAvail(ok ? 'free' : 'taken'))
        .catch(() => alive && setAvail('idle'))
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [username, mode])

  if (userId) {
    const to = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={to} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'up' && avail !== 'free') {
      toast.error(avail === 'taken' ? 'That username is taken' : 'Pick a valid username first')
      return
    }
    setBusy(true)
    try {
      if (mode === 'in') {
        await backend.signIn(email.trim(), password)
      } else {
        const { needsConfirmation } = await backend.signUp(email.trim(), password, username)
        if (needsConfirmation) setCheckEmail(true)
      }
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const hint: Record<Availability, React.ReactNode> = {
    idle: <span className="text-muted">3–20 characters: a–z, 0–9 and _</span>,
    invalid: <span className="text-danger">Use 3–20 lowercase letters, numbers or _</span>,
    checking: (
      <span className="inline-flex items-center gap-1 text-muted">
        <Loader2 size={12} className="animate-spin" /> Checking…
      </span>
    ),
    free: (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <Check size={12} /> @{username} is available
      </span>
    ),
    taken: (
      <span className="inline-flex items-center gap-1 text-danger">
        <X size={12} /> @{username} is taken
      </span>
    ),
  }

  return (
    <div
      className="relative isolate flex min-h-dvh flex-col px-6"
      style={{
        paddingTop: 'calc(var(--safe-top) + 12vh)',
        paddingBottom: 'calc(var(--safe-bottom) + 24px)',
      }}
    >
      <Aurora />
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <BlurText
            text="Shashin"
            className="block text-[56px] font-extrabold tracking-tight text-ink"
          />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-1 font-jp text-xl tracking-[0.4em] text-accent"
          >
            写真
          </motion.p>
          <p className="mt-4 text-[15px] text-muted">One photo a day. Only for your friends.</p>
        </div>

        {checkEmail ? (
          <div className="rounded-3xl border border-line bg-card/80 p-6 text-center backdrop-blur">
            <h2 className="mb-2 text-lg font-semibold">Check your email</h2>
            <p className="mb-5 text-[15px] text-muted">
              We sent a confirmation link to <span className="text-ink">{email}</span>. Open it,
              then come back and sign in.
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setCheckEmail(false)
                setMode('in')
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="space-y-4 rounded-3xl border border-line bg-card/70 p-5 backdrop-blur-xl"
          >
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <AnimatePresence initial={false}>
              {mode === 'up' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <Input
                    label="Username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={20}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="your_name"
                    error={avail === 'invalid' || avail === 'taken'}
                    hint={hint[avail]}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <Input
              label="Password"
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === 'in' ? 'Sign in' : 'Create account'}
            </Button>
            <button
              type="button"
              onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
              className="w-full py-2 text-center text-[14px] text-muted"
            >
              {mode === 'in' ? (
                <>
                  New here? <span className="font-semibold text-accent">Create account</span>
                </>
              ) : (
                <>
                  Have an account? <span className="font-semibold text-accent">Sign in</span>
                </>
              )}
            </button>
          </form>
        )}

        {backend.mode === 'demo' && (
          <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">
            Demo mode: your account and photos stay on this device. Create an account to meet a few
            demo friends.
          </p>
        )}
      </div>
    </div>
  )
}
