import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSession, setSession } from './_store.js'

const CLIENT_ID = process.env.FORTYTWO_CLIENT_ID!
const CLIENT_SECRET = process.env.FORTYTWO_CLIENT_SECRET!
const REDIRECT_URI = process.env.REDIRECT_URI!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query
  if (typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).json({ error: 'Missing code or state' })
  }

  const sep = state.indexOf(':')
  if (sep === -1) return res.status(400).json({ error: 'Malformed state' })

  const sessionId = state.slice(0, sep)
  const csrfToken = state.slice(sep + 1)
  const session = await getSession(sessionId)

  if (!session || session.state !== csrfToken) {
    return res.status(400).json({ error: 'Invalid or expired session' })
  }

  const tokenRes = await fetch('https://api.intra.42.fr/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error('[callback] token exchange failed:', tokenRes.status, body)
    return res.status(502).json({ error: 'Token exchange failed' })
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string }

  const meRes = await fetch('https://api.intra.42.fr/v2/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!meRes.ok) {
    console.error('[callback] /v2/me failed:', meRes.status)
    return res.status(502).json({ error: 'Failed to fetch user profile' })
  }

  const me = (await meRes.json()) as {
    id: number
    login: string
    image: { link: string; versions: { medium: string } } | null
  }

  const avatar = me.image?.versions?.medium ?? ''

  session.user = {
    id: me.id,
    login: me.login,
    avatar,
  }
  await setSession(sessionId, session)

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safeLogin = esc(me.login)
  const safeAvatar = esc(avatar)
  const hasAvatar = avatar !== '' && /^https:\/\/[a-z0-9.-]*\.?42\.fr\//.test(avatar)

  const avatarHtml = hasAvatar
    ? `<img src="${safeAvatar}" alt="${safeLogin}" width="96" height="96" referrerpolicy="no-referrer" class="avatar">`
    : `<div class="avatar placeholder">${safeLogin.charAt(0).toUpperCase()}</div>`

  res.setHeader('Content-Type', 'text/html')
  return res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Logged in</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff;text-align:center}
.card{max-width:360px;padding:2rem}.avatar{width:96px;height:96px;border-radius:50%;border:3px solid #7ab454;margin:0 auto 1rem;object-fit:cover;display:block}.placeholder{background:#222;color:#7ab454;font-size:2.5rem;font-weight:700;line-height:96px;text-align:center}h1{font-size:1.5rem;margin:0 0 .5rem}p{color:#aaa}</style>
</head><body><div class="card">${avatarHtml}<h1>Welcome, ${safeLogin}</h1><p>You can close this tab and return to the arcade cabinet.</p></div></body></html>`)
}
