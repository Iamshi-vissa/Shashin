export interface Profile {
  id: string
  username: string
  display_name: string | null
  /** Ready-to-display URL (signed or object URL), or null. */
  avatar_url: string | null
}

export interface Post {
  id: string
  user_id: string
  caption: string | null
  /** Poster's local calendar day, YYYY-MM-DD. */
  post_date: string
  created_at: string
  /** Ready-to-display URL (signed or object URL). */
  image_url: string
  /** Storage path (Supabase) or blob key (demo). */
  image_path: string
  author: Profile
}

export interface Friendships {
  /** People who sent me a request. */
  incoming: Profile[]
  /** People I sent a request to. */
  outgoing: Profile[]
  friends: Profile[]
}

export type Relation = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends'

export interface SignUpResult {
  /** True when the project requires email confirmation before sign-in. */
  needsConfirmation: boolean
}

export class AlreadyPostedError extends Error {
  constructor() {
    super('You already posted today')
    this.name = 'AlreadyPostedError'
  }
}

export interface Backend {
  readonly mode: 'supabase' | 'demo'

  // Auth
  getSessionUserId(): Promise<string | null>
  onAuthChange(cb: (userId: string | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, username: string): Promise<SignUpResult>
  signOut(): Promise<void>

  // Profiles
  usernameAvailable(username: string): Promise<boolean>
  getProfile(id: string): Promise<Profile | null>
  getProfileByUsername(username: string): Promise<Profile | null>
  updateProfile(patch: { display_name: string | null }): Promise<void>
  uploadAvatar(file: Blob): Promise<void>
  searchProfiles(query: string): Promise<Profile[]>

  // Friends
  listFriendships(): Promise<Friendships>
  sendFriendRequest(otherId: string): Promise<void>
  acceptFriendRequest(otherId: string): Promise<void>
  /** Remove a friend, cancel my request, or decline theirs. */
  removeFriendship(otherId: string): Promise<void>

  // Posts
  myPostForDate(day: string): Promise<Post | null>
  createPost(input: { image: Blob; caption: string; postDate: string }): Promise<void>
  deletePost(post: Post): Promise<void>
  /** Posts by me and my friends created in the last 24 hours, newest first. */
  todayFeed(): Promise<Post[]>
  /** A user's posts with post_date in [from, to], newest first. */
  postsForUser(userId: string, from: string, to: string): Promise<Post[]>
  /** Every day a user has posted (for streaks and totals). */
  postDatesForUser(userId: string): Promise<string[]>
  /** Called when a post I can see is created or deleted. */
  subscribePosts(cb: () => void): () => void
}
