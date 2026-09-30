import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSession, deleteSession } from '../_store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing session id' })
  }

  const session = await getSession(id)

  if (!session) {
    return res.json({ status: 'expired' })
  }

  if (!session.user) {
    return res.json({ status: 'pending' })
  }

  const { user } = session
  await deleteSession(id)
  return res.json({ status: 'complete', user })
}
