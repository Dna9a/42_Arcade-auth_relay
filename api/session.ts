import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessions } from './_store'

const CLIENT_ID = process.env.FORTYTWO_CLIENT_ID!
const REDIRECT_URI = process.env.REDIRECT_URI!
const SESSION_TTL_MS = 5 * 60 * 1000

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sessionId = crypto.randomUUID()
  const state = crypto.randomUUID()

  sessions.set(sessionId, { state, user: null, createdAt: Date.now() })
  setTimeout(() => sessions.delete(sessionId), SESSION_TTL_MS)

  const loginUrl =
    `https://api.intra.42.fr/oauth/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=public` +
    `&state=${sessionId}:${state}`

  return res.json({ sessionId, loginUrl })
}
