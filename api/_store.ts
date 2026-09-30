import { kv } from '@vercel/kv'

export interface AuthUser {
  id: number
  login: string
  avatar: string
}

export interface Session {
  state: string
  user: AuthUser | null
  createdAt: number
}

const TTL_SECONDS = 5 * 60

export async function getSession(id: string): Promise<Session | null> {
  return kv.get<Session>(`session:${id}`)
}

export async function setSession(id: string, session: Session): Promise<void> {
  await kv.set(`session:${id}`, session, { ex: TTL_SECONDS })
}

export async function deleteSession(id: string): Promise<void> {
  await kv.del(`session:${id}`)
}
