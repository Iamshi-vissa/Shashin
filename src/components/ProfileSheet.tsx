import { useQueryClient } from '@tanstack/react-query'
import { Camera, LogOut, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { backend } from '@/lib/backend'
import { LocalBackend } from '@/lib/backend/local'
import { squareAvatar } from '@/lib/image'
import { friendlyError } from '@/lib/queries'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Sheet } from './ui/Sheet'

export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId, profile } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setName(profile?.display_name ?? '')
  }, [open, profile?.display_name])

  if (!profile) return null

  const refresh = () => qc.invalidateQueries({ queryKey: ['profile', userId] })

  const save = async () => {
    setSaving(true)
    try {
      await backend.updateProfile({ display_name: name.trim() || null })
      await refresh()
      toast.success('Saved')
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      await backend.uploadAvatar(await squareAvatar(file))
      await refresh()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your profile">
      <div className="mb-5 flex items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative rounded-full"
          aria-label="Change profile photo"
          disabled={uploading}
        >
          <Avatar profile={profile} size={72} />
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-accent text-accent-ink">
            <Camera size={15} />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
        <div>
          <p className="text-lg font-semibold">@{profile.username}</p>
          <p className="text-[13px] text-muted">
            {uploading ? 'Uploading…' : 'Tap the photo to change it'}
          </p>
        </div>
      </div>
      <Input
        label="Display name"
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        placeholder={profile.username}
      />
      <Button className="mt-4 w-full" loading={saving} onClick={save}>
        Save
      </Button>
      <Button variant="secondary" className="mt-3 w-full" onClick={() => void backend.signOut()}>
        <LogOut size={18} /> Sign out
      </Button>
      {backend instanceof LocalBackend && (
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-[13px] text-muted"
          onClick={async () => {
            if (!confirm('Erase all demo accounts and photos on this device?')) return
            await (backend as LocalBackend).reset()
            qc.clear()
          }}
        >
          <RotateCcw size={14} /> Reset demo data
        </button>
      )}
    </Sheet>
  )
}
