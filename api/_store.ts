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

export const sessions = new Map<string, Session>()
