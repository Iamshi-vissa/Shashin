import { motion } from 'motion/react'
import { Camera, Check, ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ClickSpark } from '@/components/bits/ClickSpark'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { AlreadyPostedError, backend } from '@/lib/backend'
import { localDate } from '@/lib/dates'
import { compressImage, cropImage } from '@/lib/image'
import { friendlyError, useMyPostToday, usePostsInvalidation } from '@/lib/queries'

const MAX_CAPTION = 200

export function PostScreen() {
  const mine = useMyPostToday()
  const invalidate = usePostsInvalidation()
  const navigate = useNavigate()

  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Please pick a photo')
    setSrc(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), [])

  const share = async () => {
    if (!src || !area) return
    setBusy(true)
    try {
      const cropped = await cropImage(src, area)
      const image = await compressImage(cropped)
      await backend.createPost({ image, caption, postDate: localDate() })
      setDone(true)
      invalidate()
      setTimeout(() => navigate('/'), 1100)
    } catch (e) {
      if (e instanceof AlreadyPostedError) {
        toast.error('You already posted today')
        invalidate()
      } else toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const deleteAndRedo = async () => {
    if (!mine.data) return
    setDeleting(true)
    try {
      await backend.deletePost(mine.data)
      invalidate()
      setConfirmDelete(false)
      setSrc(null)
      setCaption('')
      toast.success('Deleted. Take a new one!')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setDeleting(false)
    }
  }

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFile}
      />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />
    </>
  )

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <motion.div
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-accent-ink"
        >
          <Check size={48} strokeWidth={3} />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl font-semibold"
        >
          Shared with your friends
        </motion.p>
      </div>
    )
  }

  if (mine.isPending) {
    return (
      <Screen title="Post">
        <Skeleton className="aspect-[3/4] w-full rounded-3xl" />
      </Screen>
    )
  }

  // Already posted today
  if (mine.data && !src) {
    return (
      <Screen title="Today's photo" subtitle="You've posted for today. See you tomorrow!">
        <div className="grain relative overflow-hidden rounded-3xl border border-line">
          <img
            src={mine.data.image_url}
            alt={mine.data.caption ?? 'Your photo today'}
            className="aspect-[3/4] w-full object-cover"
          />
        </div>
        {mine.data.caption && <p className="mt-3 px-1 text-[15px]">{mine.data.caption}</p>}
        <Button variant="danger" className="mt-6 w-full" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={18} /> Delete and redo
        </Button>
        <ConfirmDialog
          open={confirmDelete}
          title="Delete today's photo?"
          body="Your friends won't see it anymore. You can post a new one right after."
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={deleteAndRedo}
          onClose={() => setConfirmDelete(false)}
        />
      </Screen>
    )
  }

  // Pick a photo
  if (!src) {
    return (
      <Screen title="Post" subtitle="One photo for today">
        {inputs}
        <div className="grain relative mb-6 flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-dashed border-line bg-card">
          <span className="font-jp text-6xl text-accent/80">写</span>
          <p className="text-[14px] text-muted">What did today look like?</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => cameraRef.current?.click()}>
            <Camera size={20} /> Take photo
          </Button>
          <Button size="lg" variant="secondary" onClick={() => galleryRef.current?.click()}>
            <ImagePlus size={20} /> Gallery
          </Button>
        </div>
      </Screen>
    )
  }

  // Crop + caption
  return (
    <Screen
      title="Post"
      action={
        <button
          onClick={() => setSrc(null)}
          className="flex h-10 items-center gap-1 text-[14px] text-muted"
        >
          <RotateCcw size={16} /> Retake
        </button>
      }
    >
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[calc(50dvh*0.75)] overflow-hidden rounded-3xl border border-line bg-black">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={3 / 4}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid={false}
          objectFit="cover"
          style={{ cropAreaStyle: { border: '2px solid rgba(255,216,77,0.8)', borderRadius: 20 } }}
        />
      </div>
      <label className="mt-3 flex items-center gap-3 text-[12px] text-muted">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-[#FFD84D]"
          aria-label="Zoom"
        />
      </label>
      <label className="mt-4 block">
        <span className="sr-only">Caption</span>
        <textarea
          value={caption}
          maxLength={MAX_CAPTION}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption…"
          rows={1}
          className="w-full resize-none rounded-2xl border border-line bg-card px-4 py-3 text-[16px] outline-none placeholder:text-muted/60 focus:border-accent"
        />
        <span
          className={`block text-right text-[12px] ${caption.length >= MAX_CAPTION ? 'text-danger' : 'text-muted'}`}
        >
          {caption.length}/{MAX_CAPTION}
        </span>
      </label>
      <ClickSpark className="mt-3">
        <Button size="lg" className="w-full" loading={busy} onClick={share}>
          Share
        </Button>
      </ClickSpark>
    </Screen>
  )
}
