/** fetch wrapper: JSON in/out, sends the access key if one is saved, throws on HTTP errors. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const key = localStorage.getItem('appKey')
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
  })
  if (res.status === 401) throw new Error('Access key missing or wrong. Set it in Settings.')
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Server error ${res.status}`)
  return res.json()
}

export const post = <T,>(path: string, body: unknown, method = 'POST') =>
  api<T>(path, { method, body: typeof body === 'string' ? body : JSON.stringify(body) })

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
