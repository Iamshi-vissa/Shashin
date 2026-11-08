import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  AlreadyPostedError,
  type Backend,
  type Friendships,
  type Post,
  type Profile,
} from './types'

interface ProfileRow {
  id: string
  username: string
  display_name: string | null
  avatar_path: string | null
}
interface PostRow {
  id: string
  user_id: string
  image_path: string
  caption: string | null
  post_date: string
  created_at: string
  author: ProfileRow
}
interface FriendshipRow {
  requester: string
  addressee: string
  status: 'pending' | 'accepted'
}

const PROFILE_COLS = 'id, username, display_name, avatar_path'
const POST_COLS = `id, user_id, image_path, caption, post_date, created_at, author:profiles!posts_user_id_fkey(${PROFILE_COLS})`
const SIGNED_URL_TTL = 60 * 60 // 1 hour

/** Escape LIKE wildcards so "a_b" searches for a literal underscore. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const
  readonly client: SupabaseClient
  private urlCache = new Map<string, { url: string; expires: number }>()

  constructor(url: string, key: string) {
    this.client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }

  private async uid(): Promise<string> {
    const id = await this.getSessionUserId()
    if (!id) throw new Error('Not signed in')
    return id
  }

  /** Batch-sign storage paths, reusing cached URLs that are still fresh. */
  private async sign(bucket: string, paths: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    const now = Date.now()
    const missing: string[] = []
    for (const p of new Set(paths)) {
      const hit = this.urlCache.get(`${bucket}/${p}`)
      if (hit && hit.expires > now) out.set(p, hit.url)
      else missing.push(p)
    }
    if (missing.length) {
      const { data, error } = await this.client.storage
        .from(bucket)
        .createSignedUrls(missing, SIGNED_URL_TTL)
      if (error) throw error
      for (const item of data ?? []) {
        if (!item.path || !item.signedUrl) continue
        out.set(item.path, item.signedUrl)
        this.urlCache.set(`${bucket}/${item.path}`, {
          url: item.signedUrl,
          expires: now + (SIGNED_URL_TTL - 300) * 1000,
        })
      }
    }
    return out
  }

  private async toProfiles(rows: ProfileRow[]): Promise<Profile[]> {
    const paths = rows.map((r) => r.avatar_path).filter((p): p is string => !!p)
    const urls = paths.length ? await this.sign('avatars', paths) : new Map<string, string>()
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_path ? (urls.get(r.avatar_path) ?? null) : null,
    }))
  }

  private async toPosts(rows: PostRow[]): Promise<Post[]> {
    if (!rows.length) return []
    const [urls, authors] = await Promise.all([
      this.sign(
        'photos',
        rows.map((r) => r.image_path),
      ),
      this.toProfiles(rows.map((r) => r.author)),
    ])
    return rows.map((r, i) => ({
      id: r.id,
      user_id: r.user_id,
      caption: r.caption,
      post_date: r.post_date,
      created_at: r.created_at,
      image_path: r.image_path,
      image_url: urls.get(r.image_path) ?? '',
      author: authors[i],
    }))
  }

  // ---------------------------------------------------------------- auth

  async getSessionUserId() {
    const { data } = await this.client.auth.getSession()
    return data.session?.user.id ?? null
  }

  onAuthChange(cb: (userId: string | null) => void) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) =>
      cb(session?.user.id ?? null),
    )
    return () => data.subscription.unsubscribe()
  }

  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async signUp(email: string, password: string, username: string) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.toLowerCase() },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) throw error
    return { needsConfirmation: !data.session }
  }

  async signOut() {
    const { error } = await this.client.auth.signOut()
    if (error) throw error
    this.urlCache.clear()
  }

  // ---------------------------------------------------------------- profiles

  async usernameAvailable(username: string) {
    const { data, error } = await this.client.rpc('username_available', { name: username })
    if (error) throw error
    return Boolean(data)
  }

  async getProfile(id: string) {
    const { data, error } = await this.client
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', id)
      .maybeSingle<ProfileRow>()
    if (error) throw error
    return data ? (await this.toProfiles([data]))[0] : null
  }

  async getProfileByUsername(username: string) {
    const { data, error } = await this.client
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('username', username.toLowerCase())
      .maybeSingle<ProfileRow>()
    if (error) throw error
    return data ? (await this.toProfiles([data]))[0] : null
  }

  async updateProfile(patch: { display_name: string | null }) {
    const id = await this.uid()
    const { error } = await this.client.from('profiles').update(patch).eq('id', id)
    if (error) throw error
  }

  async uploadAvatar(file: Blob) {
    const id = await this.uid()
    const { data: current } = await this.client
      .from('profiles')
      .select('avatar_path')
      .eq('id', id)
      .single<{ avatar_path: string | null }>()
    const path = `${id}/avatar-${Date.now()}.jpg`
    const up = await this.client.storage
      .from('avatars')
      .upload(path, file, { contentType: 'image/jpeg' })
    if (up.error) throw up.error
    const { error } = await this.client.from('profiles').update({ avatar_path: path }).eq('id', id)
    if (error) {
      await this.client.storage.from('avatars').remove([path])
      throw error
    }
    if (current?.avatar_path)
      await this.client.storage.from('avatars').remove([current.avatar_path])
  }

  async searchProfiles(query: string) {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const me = await this.uid()
    const { data, error } = await this.client
      .from('profiles')
      .select(PROFILE_COLS)
      .ilike('username', `%${escapeLike(q)}%`)
      .neq('id', me)
      .order('username')
      .limit(15)
      .returns<ProfileRow[]>()
    if (error) throw error
    return this.toProfiles(data ?? [])
  }

  // ---------------------------------------------------------------- friends

  async listFriendships(): Promise<Friendships> {
    const me = await this.uid()
    const { data, error } = await this.client
      .from('friendships')
      .select('requester, addressee, status')
      .returns<FriendshipRow[]>()
    if (error) throw error
    const rows = data ?? []
    const otherIds = rows.map((r) => (r.requester === me ? r.addressee : r.requester))
    if (!otherIds.length) return { incoming: [], outgoing: [], friends: [] }
    const { data: profs, error: pErr } = await this.client
      .from('profiles')
      .select(PROFILE_COLS)
      .in('id', otherIds)
      .returns<ProfileRow[]>()
    if (pErr) throw pErr
    const byId = new Map((await this.toProfiles(profs ?? [])).map((p) => [p.id, p]))
    const result: Friendships = { incoming: [], outgoing: [], friends: [] }
    for (const r of rows) {
      const other = byId.get(r.requester === me ? r.addressee : r.requester)
      if (!other) continue
      if (r.status === 'accepted') result.friends.push(other)
      else if (r.addressee === me) result.incoming.push(other)
      else result.outgoing.push(other)
    }
    for (const list of [result.incoming, result.outgoing, result.friends]) {
      list.sort((a, b) => a.username.localeCompare(b.username))
    }
    return result
  }

  async sendFriendRequest(otherId: string) {
    const me = await this.uid()
    const { error } = await this.client
      .from('friendships')
      .insert({ requester: me, addressee: otherId, status: 'pending' })
    if (error?.code === '23505') {
      // A row for this pair already exists; if they asked me, accept it.
      await this.acceptFriendRequest(otherId)
      return
    }
    if (error) throw error
  }

  async acceptFriendRequest(otherId: string) {
    const me = await this.uid()
    const { error } = await this.client
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester', otherId)
      .eq('addressee', me)
    if (error) throw error
  }

  async removeFriendship(otherId: string) {
    const me = await this.uid()
    const { error } = await this.client
      .from('friendships')
      .delete()
      .or(
        `and(requester.eq.${me},addressee.eq.${otherId}),and(requester.eq.${otherId},addressee.eq.${me})`,
      )
    if (error) throw error
  }

  // ---------------------------------------------------------------- posts

  async myPostForDate(day: string) {
    const me = await this.uid()
    const { data, error } = await this.client
      .from('posts')
      .select(POST_COLS)
      .eq('user_id', me)
      .eq('post_date', day)
      .maybeSingle<PostRow>()
    if (error) throw error
    return data ? (await this.toPosts([data]))[0] : null
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
    const me = await this.uid()
    const path = `${me}/${postDate}-${Date.now()}.jpg`
    const up = await this.client.storage
      .from('photos')
      .upload(path, image, { contentType: 'image/jpeg' })
    if (up.error) throw up.error
    const { error } = await this.client.from('posts').insert({
      user_id: me,
      image_path: path,
      caption: caption.trim() || null,
      post_date: postDate,
    })
    if (error) {
      await this.client.storage.from('photos').remove([path])
      if (error.code === '23505') throw new AlreadyPostedError()
      throw error
    }
  }

  async deletePost(post: Post) {
    const { error } = await this.client.from('posts').delete().eq('id', post.id)
    if (error) throw error
    await this.client.storage.from('photos').remove([post.image_path])
  }

  async todayFeed() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await this.client
      .from('posts')
      .select(POST_COLS)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<PostRow[]>()
    if (error) throw error
    return this.toPosts(data ?? [])
  }

  async postsForUser(userId: string, from: string, to: string) {
    const { data, error } = await this.client
      .from('posts')
      .select(POST_COLS)
      .eq('user_id', userId)
      .gte('post_date', from)
      .lte('post_date', to)
      .order('post_date', { ascending: false })
      .returns<PostRow[]>()
    if (error) throw error
    return this.toPosts(data ?? [])
  }

  async postDatesForUser(userId: string) {
    const { data, error } = await this.client
      .from('posts')
      .select('post_date')
      .eq('user_id', userId)
      .order('post_date', { ascending: false })
      .returns<{ post_date: string }[]>()
    if (error) throw error
    return (data ?? []).map((r) => r.post_date)
  }

  subscribePosts(cb: () => void) {
    const channel = this.client
      .channel('posts-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => cb())
      .subscribe()
    return () => {
      void this.client.removeChannel(channel)
    }
  }
}
