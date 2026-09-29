import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sessions } from '../_store'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing session id' })
  }

  const session = sessions.get(id)

  if (!session) {
    return res.json({ status: 'expired' })
  }

  if (!session.user) {
    return res.json({ status: 'pending' })
  }

  const { user } = session
  sessions.delete(id)
  return res.json({ status: 'complete', user })
}
