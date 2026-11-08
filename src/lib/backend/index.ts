import { LocalBackend } from './local'
import { SupabaseBackend } from './supabase'
import type { Backend } from './types'

export * from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Supabase when configured, otherwise a local demo backend in IndexedDB. */
export const backend: Backend = url && key ? new SupabaseBackend(url, key) : new LocalBackend()
