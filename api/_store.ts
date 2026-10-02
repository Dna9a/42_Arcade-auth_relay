import { createClient } from '@supabase/supabase-js'

export interface AuthUser {
  id: number
  login: string
  avatar: string
  gender: string
}

export interface Session {
  state: string
  user: AuthUser | null
  createdAt: number
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TTL_MINUTES = 5

export async function getSession(id: string): Promise<Session | null> {
  const { data } = await supabase
    .from('sessions')
    .select('data, expires_at')
    .eq('id', id)
    .single()

  if (!data) return null

  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('sessions').delete().eq('id', id)
    return null
  }

  return data.data as Session
}

export async function setSession(id: string, session: Session): Promise<void> {
  const expires_at = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString()

  await supabase
    .from('sessions')
    .upsert({ id, data: session, expires_at }, { onConflict: 'id' })

  // Opportunistically clean up expired rows
  supabase
    .from('sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .then(() => {})
}

export async function deleteSession(id: string): Promise<Session | null> {
  // Race-safe: delete + return in one call so two polls can't both get the user
  const { data } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id)
    .select('data')
    .single()

  if (!data) return null
  return data.data as Session
}
