import type { PlaceResult } from '../core/places'

/** 舊版的 Cloudflare Worker 代理（Google Places Text Search），可用環境變數覆寫 */
const PROXY_URL = import.meta.env.VITE_PLACES_PROXY_URL ?? 'https://bold-cloud-4bb3.s3311453038.workers.dev'

export class PlacesSearchError extends Error {}

export async function searchPlaces(textQuery: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  let res: Response
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textQuery }),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new PlacesSearchError('network')
  }
  const data = (await res.json().catch(() => ({}))) as { places?: PlaceResult[]; error?: string }
  if (!res.ok) throw new PlacesSearchError(data.error ?? `HTTP ${res.status}`)
  return data.places ?? []
}
