/**
 * Demo backend: everything lives in this browser's IndexedDB. Used when no
 * Supabase env vars are set, so the app runs with zero setup. A few demo
 * friends (with generated photos) are seeded so the feed and Library have
 * something to show.
 */
import { createStore, del, get, set } from 'idb-keyval'
import { addDays, localDate } from '../dates'
import {
  AlreadyPostedError,
  type Backend,
  type Friendships,
  type Post,
  type Profile,
} from './types'

interface UserRec {
  id: string
  email: string
  password: string
  username: string
  display_name: string | null
  avatar_key: string | null
  bot?: { hue: number }
}
interface FriendRec {
  requester: string
  addressee: string
  status: 'pending' | 'accepted'
}
interface PostRec {
  id: string
  user_id: string
  image_key: string
  caption: string | null
  post_date: string
  created_at: string
}
interface Db {
  version: 1
  users: UserRec[]
  friendships: FriendRec[]
  posts: PostRec[]
}

const store = createStore('shashin-demo', 'kv')
const SESSION_KEY = 'shashin.demo.session'
const DB_KEY = 'db'

const BOTS: {
  username: string
  name: string
  hue: number
  days: number
  skip: number[]
  captions: string[]
}[] = [
  {
    username: 'aiko',
    name: 'Aiko',
    hue: 18,
    days: 20,
    skip: [4, 11],
    captions: [
      'morning light on the balcony',
      'matcha + rain',
      'found this alley',
      'golden hour again',
      'tiny cafe, big window',
    ],
  },
  {
    username: 'kenji',
    name: 'Kenji',
    hue: 200,
    days: 13,
    skip: [2, 7, 8],
    captions: ['night train', 'neon puddles', 'late shift view', 'bike ride by the river'],
  },
  {
    username: 'mei',
    name: 'Mei',
    hue: 320,
    days: 6,
    skip: [],
    captions: ['plants are thriving', 'sunday market'],
  },
  {
    username: 'ravi',
    name: 'Ravi',
    hue: 140,
    days: 9,
    skip: [3],
    captions: ['chai o clock', 'monsoon green', 'rooftop sunset'],
  },
]

function uuid(): string {
  return crypto.randomUUID()
}

function safeSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

/** Draw a soft, film-like placeholder photo for demo friends. */
async function drawDemoPhoto(hue: number, seed: number, label: string): Promise<Blob> {
  const w = 600
  const h = 800
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const rand = mulberry32(seed)
  const h2 = (hue + 30 + rand() * 60) % 360
  const grad = g.createLinearGradient(0, 0, w * rand(), h)
  grad.addColorStop(0, `hsl(${hue} 55% ${25 + rand() * 20}%)`)
  grad.addColorStop(1, `hsl(${h2} 60% ${45 + rand() * 20}%)`)
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  // Sun / bokeh
  for (let i = 0; i < 7; i++) {
    const r = 30 + rand() * 160
    const rg = g.createRadialGradient(rand() * w, rand() * h, 0, rand() * w, rand() * h, r * 2)
    rg.addColorStop(0, `hsla(${(h2 + 20) % 360} 90% 80% / ${0.15 + rand() * 0.35})`)
    rg.addColorStop(1, 'hsla(0 0% 100% / 0)')
    g.fillStyle = rg
    g.fillRect(0, 0, w, h)
  }
  // Horizon silhouette
  g.fillStyle = `hsla(${hue} 40% 8% / 0.75)`
  g.beginPath()
  g.moveTo(0, h)
  let y = h * (0.62 + rand() * 0.15)
  g.lineTo(0, y)
  for (let x = 0; x <= w; x += 40) {
    y += (rand() - 0.5) * 60
    g.lineTo(x, y)
  }
  g.lineTo(w, h)
  g.fill()
  // Grain
  const img = g.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 22
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.font = '600 22px ui-monospace, monospace'
  g.fillText(label, 24, h - 28)
  return new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/jpeg', 0.82))
}

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class LocalBackend implements Backend {
  readonly mode = 'demo' as const
  private authListeners = new Set<(id: string | null) => void>()
  private postListeners = new Set<() => void>()
  private urlCache = new Map<string, string>()
  private queue: Promise<unknown> = Promise.resolve()
  private dbCache: Db | null = null

  // ---------------------------------------------------------------- storage

  private async load(): Promise<Db> {
    if (this.dbCache) return this.dbCache
    let db = await get<Db>(DB_KEY, store)
    if (!db) {
      db = this.seed()
      await set(DB_KEY, db, store)
    }
    this.dbCache = db
    return db
  }

  /** Serialise read-modify-write so concurrent calls never lose updates. */
  private mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.load()
      const result = await fn(db)
      await set(DB_KEY, db, store)
      return result
    })
    this.queue = run.catch(() => undefined)
    return run
  }

  private seed(): Db {
    const db: Db = { version: 1, users: [], friendships: [], posts: [] }
    const today = localDate()
    BOTS.forEach((b, bi) => {
      const id = uuid()
      db.users.push({
        id,
        email: `${b.username}@demo.shashin`,
        password: '',
        username: b.username,
        display_name: b.name,
        avatar_key: `gen:${b.hue}:${bi * 1000}:${b.username}`,
        bot: { hue: b.hue },
      })
      for (let d = 0; d < b.days; d++) {
        if (b.skip.includes(d)) continue
        const day = addDays(today, -d)
        const created =
          d === 0
            ? new Date(Date.now() - (1 + bi * 2.5) * 3_600_000)
            : new Date(`${day}T${String(9 + ((d * 5 + bi * 3) % 12)).padStart(2, '0')}:20:00`)
        db.posts.push({
          id: uuid(),
          user_id: id,
          image_key: `gen:${b.hue}:${bi * 1000 + d + 1}:${day}`,
          caption: b.captions[(d + bi) % b.captions.length],
          post_date: day,
          created_at: created.toISOString(),
        })
      }
    })
    return db
  }

  private async url(key: string): Promise<string> {
    const hit = this.urlCache.get(key)
    if (hit) return hit
    let blob: Blob | undefined
    if (key.startsWith('gen:')) {
      const [, hue, seed, label] = key.split(':')
      blob = await drawDemoPhoto(Number(hue), Number(seed), label)
    } else {
      blob = await get<Blob>(key, store)
    }
    if (!blob) return ''
    const u = URL.createObjectURL(blob)
    this.urlCache.set(key, u)
    return u
  }

  private async toProfile(u: UserRec): Promise<Profile> {
    return {
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_key ? await this.url(u.avatar_key) : null,
    }
  }

  private async toPosts(db: Db, rows: PostRec[]): Promise<Post[]> {
    const users = new Map(db.users.map((u) => [u.id, u]))
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        user_id: r.user_id,
        caption: r.caption,
        post_date: r.post_date,
        created_at: r.created_at,
        image_path: r.image_key,
        image_url: await this.url(r.image_key),
        author: await this.toProfile(users.get(r.user_id)!),
      })),
    )
  }

  private async me(): Promise<string> {
    const id = safeSession()
    if (!id) throw new Error('Not signed in')
    return id
  }

  private areFriends(db: Db, a: string, b: string) {
    return db.friendships.some(
      (f) =>
        f.status === 'accepted' &&
        ((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a)),
    )
  }

  private emitPosts() {
    this.postListeners.forEach((cb) => cb())
  }

  private setSession(id: string | null) {
    try {
      if (id) localStorage.setItem(SESSION_KEY, id)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* private mode: session lasts for this tab only */
    }
    this.authListeners.forEach((cb) => cb(id))
  }

  // ---------------------------------------------------------------- auth

  async getSessionUserId() {
    const id = safeSession()
    if (!id) return null
    const db = await this.load()
    return db.users.some((u) => u.id === id) ? id : null
  }

  onAuthChange(cb: (id: string | null) => void) {
    this.authListeners.add(cb)
    return () => {
      this.authListeners.delete(cb)
    }
  }

  async signIn(email: string, password: string) {
    const db = await this.load()
    const u = db.users.find((x) => !x.bot && x.email === email.trim().toLowerCase())
    if (!u || u.password !== password) throw new Error('Invalid email or password')
    this.setSession(u.id)
  }

  async signUp(email: string, password: string, username: string) {
    const name = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(name))
      throw new Error('Username must be 3-20 characters: a-z, 0-9, _')
    if (password.length < 6) throw new Error('Password should be at least 6 characters')
    const id = await this.mutate((db) => {
      const mail = email.trim().toLowerCase()
      if (db.users.some((u) => u.email === mail))
        throw new Error('An account with this email already exists')
      if (db.users.some((u) => u.username === name)) throw new Error('That username is taken')
      const id = uuid()
      db.users.push({
        id,
        email: mail,
        password,
        username: name,
        display_name: null,
        avatar_key: null,
      })
      // Demo social graph: two friends, one incoming request.
      const bot = (n: string) => db.users.find((u) => u.username === n)!.id
      db.friendships.push(
        { requester: bot('aiko'), addressee: id, status: 'accepted' },
        { requester: id, addressee: bot('kenji'), status: 'accepted' },
        { requester: bot('mei'), addressee: id, status: 'pending' },
      )
      return id
    })
    this.setSession(id)
    return { needsConfirmation: false }
  }

  async signOut() {
    this.setSession(null)
  }

  // ---------------------------------------------------------------- profiles

  async usernameAvailable(username: string) {
    const db = await this.load()
    const name = username.toLowerCase()
    return /^[a-z0-9_]{3,20}$/.test(name) && !db.users.some((u) => u.username === name)
  }

  async getProfile(id: string) {
    const db = await this.load()
    const u = db.users.find((x) => x.id === id)
    return u ? this.toProfile(u) : null
  }

  async getProfileByUsername(username: string) {
    const db = await this.load()
    const u = db.users.find((x) => x.username === username.toLowerCase())
    return u ? this.toProfile(u) : null
  }

  async updateProfile(patch: { display_name: string | null }) {
    const me = await this.me()
    await this.mutate((db) => {
      const u = db.users.find((x) => x.id === me)!
      u.display_name = patch.display_name?.trim() || null
    })
  }

  async uploadAvatar(file: Blob) {
    const me = await this.me()
    const key = `blob:avatar:${me}:${Date.now()}`
    await set(key, file, store)
    const old = await this.mutate((db) => {
      const u = db.users.find((x) => x.id === me)!
      const prev = u.avatar_key
      u.avatar_key = key
      return prev
    })
    if (old && old.startsWith('blob:')) await del(old, store)
  }

  async searchProfiles(query: string) {
    const me = await this.me()
    const q = query.trim().toLowerCase()
    if (!q) return []
    const db = await this.load()
    const hits = db.users
      .filter((u) => u.id !== me && u.username.includes(q))
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 15)
    return Promise.all(hits.map((u) => this.toProfile(u)))
  }

  // ---------------------------------------------------------------- friends

  async listFriendships(): Promise<Friendships> {
    const me = await this.me()
    const db = await this.load()
    const users = new Map(db.users.map((u) => [u.id, u]))
    const out: Friendships = { incoming: [], outgoing: [], friends: [] }
    for (const f of db.friendships) {
      if (f.requester !== me && f.addressee !== me) continue
      const other = users.get(f.requester === me ? f.addressee : f.requester)
      if (!other) continue
      const p = await this.toProfile(other)
      if (f.status === 'accepted') out.friends.push(p)
      else if (f.addressee === me) out.incoming.push(p)
      else out.outgoing.push(p)
    }
    for (const list of [out.incoming, out.outgoing, out.friends]) {
      list.sort((a, b) => a.username.localeCompare(b.username))
    }
    return out
  }

  async sendFriendRequest(otherId: string) {
    const me = await this.me()
    const isBot = await this.mutate((db) => {
      const existing = db.friendships.find(
        (f) =>
          (f.requester === me && f.addressee === otherId) ||
          (f.requester === otherId && f.addressee === me),
      )
      if (existing) {
        if (existing.addressee === me) existing.status = 'accepted'
        return false
      }
      db.friendships.push({ requester: me, addressee: otherId, status: 'pending' })
      return !!db.users.find((u) => u.id === otherId)?.bot
    })
    // Demo friends accept your request after a moment.
    if (isBot) {
      setTimeout(() => {
        void this.mutate((db) => {
          const f = db.friendships.find((x) => x.requester === me && x.addressee === otherId)
          if (f) f.status = 'accepted'
        }).then(() => {
          this.emitPosts()
          window.dispatchEvent(new Event('shashin:friends-changed'))
        })
      }, 2500)
    }
    this.emitPosts()
  }

  async acceptFriendRequest(otherId: string) {
    const me = await this.me()
    await this.mutate((db) => {
      const f = db.friendships.find((x) => x.requester === otherId && x.addressee === me)
      if (f) f.status = 'accepted'
    })
    this.emitPosts()
  }

  async removeFriendship(otherId: string) {
    const me = await this.me()
    await this.mutate((db) => {
      db.friendships = db.friendships.filter(
        (f) =>
          !(
            (f.requester === me && f.addressee === otherId) ||
            (f.requester === otherId && f.addressee === me)
          ),
      )
    })
    this.emitPosts()
  }

  // ---------------------------------------------------------------- posts

  async myPostForDate(day: string) {
    const me = await this.me()
    const db = await this.load()
    const p = db.posts.find((x) => x.user_id === me && x.post_date === day)
    return p ? (await this.toPosts(db, [p]))[0] : null
  }

  async createPost({
    image,
    caption,
    postDate,
  }: {
    image: Blob
    caption: string
    postDate: string
  }) {
    const me = await this.me()
    const key = `blob:photo:${me}:${postDate}-${Date.now()}`
    await set(key, image, store)
    try {
      await this.mutate((db) => {
        if (db.posts.some((p) => p.user_id === me && p.post_date === postDate)) {
          throw new AlreadyPostedError()
        }
        db.posts.push({
          id: uuid(),
          user_id: me,
          image_key: key,
          caption: caption.trim().slice(0, 200) || null,
          post_date: postDate,
          created_at: new Date().toISOString(),
        })
      })
    } catch (e) {
      await del(key, store)
      throw e
    }
    this.emitPosts()
  }

  async deletePost(post: Post) {
    const me = await this.me()
    await this.mutate((db) => {
      db.posts = db.posts.filter((p) => !(p.id === post.id && p.user_id === me))
    })
    if (post.image_path.startsWith('blob:')) await del(post.image_path, store)
    this.emitPosts()
  }

  async todayFeed() {
    const me = await this.me()
    const db = await this.load()
    const since = Date.now() - 24 * 3_600_000
    const rows = db.posts
      .filter(
        (p) =>
          Date.parse(p.created_at) >= since &&
          (p.user_id === me || this.areFriends(db, me, p.user_id)),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return this.toPosts(db, rows)
  }

  private canSee(db: Db, me: string, userId: string) {
    return userId === me || this.areFriends(db, me, userId)
  }

  async postsForUser(userId: string, from: string, to: string) {
    const me = await this.me()
    const db = await this.load()
    if (!this.canSee(db, me, userId)) return []
    const rows = db.posts
      .filter((p) => p.user_id === userId && p.post_date >= from && p.post_date <= to)
      .sort((a, b) => b.post_date.localeCompare(a.post_date))
    return this.toPosts(db, rows)
  }

  async postDatesForUser(userId: string) {
    const me = await this.me()
    const db = await this.load()
    if (!this.canSee(db, me, userId)) return []
    return db.posts
      .filter((p) => p.user_id === userId)
      .map((p) => p.post_date)
      .sort()
      .reverse()
  }

  subscribePosts(cb: () => void) {
    this.postListeners.add(cb)
    return () => {
      this.postListeners.delete(cb)
    }
  }

  /** Wipe all demo data (used by "Reset demo" in the profile sheet). */
  async reset() {
    await del(DB_KEY, store)
    this.dbCache = null
    this.urlCache.forEach((u) => URL.revokeObjectURL(u))
    this.urlCache.clear()
    this.setSession(null)
  }
}
