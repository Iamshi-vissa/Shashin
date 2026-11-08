import { Camera, GalleryVerticalEnd, Sun, Users } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Dock } from '@/components/bits/Dock'
import { OfflineBanner } from '@/components/OfflineBanner'
import { useAuth } from '@/lib/auth'
import { useFriendships, useLiveUpdates } from '@/lib/queries'
import { SignIn } from '@/screens/SignIn'
import { Today } from '@/screens/Today'

const PostScreen = lazy(() =>
  import('@/screens/PostScreen').then((m) => ({ default: m.PostScreen })),
)
const Library = lazy(() => import('@/screens/Library').then((m) => ({ default: m.Library })))
const Friends = lazy(() => import('@/screens/Friends').then((m) => ({ default: m.Friends })))
const AddByUsername = lazy(() =>
  import('@/screens/AddByUsername').then((m) => ({ default: m.AddByUsername })),
)

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="animate-pulse font-jp text-5xl text-accent">写</span>
    </div>
  )
}

function RequireAuth() {
  const { userId } = useAuth()
  const location = useLocation()
  if (userId === undefined) return <Splash />
  if (!userId) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  return <AppShell />
}

function AppShell() {
  useLiveUpdates()
  const friendships = useFriendships()
  const requests = friendships.data?.incoming.length ?? 0
  return (
    <>
      <Suspense fallback={<Splash />}>
        <Outlet />
      </Suspense>
      <Dock
        items={[
          { to: '/', label: 'Today', icon: Sun },
          { to: '/post', label: 'Post', icon: Camera, primary: true },
          { to: '/library', label: 'Library', icon: GalleryVerticalEnd },
          { to: '/friends', label: 'Friends', icon: Users, badge: requests },
        ]}
      />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Today />} />
          <Route path="post" element={<PostScreen />} />
          <Route path="library" element={<Library />} />
          <Route path="friends" element={<Friends />} />
          <Route path="add/:username" element={<AddByUsername />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
