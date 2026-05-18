import { storage, STORAGE_KEYS } from './storage'
import type { RatingInfo } from '../types'

type RatingEntry = [cert: string, minAge: number]

const RATINGS: Record<string, RatingEntry[]> = {
  US: [['G',0],['PG',7],['PG-13',13],['R',17],['NC-17',18]],
  DE: [['FSK 0',0],['FSK 6',6],['FSK 12',12],['FSK 16',16],['FSK 18',18]],
  GB: [['U',0],['PG',7],['12',12],['12A',12],['15',15],['18',18]],
  FR: [['U',0],['10',10],['12',12],['16',16],['18',18]],
  AU: [['G',0],['PG',7],['M',15],['MA 15+',15],['R 18+',18],['X 18+',18]],
  NZ: [['G',0],['PG',7],['M',16],['R13',13],['R15',15],['R16',16],['R18',18]],
  BR: [['L',0],['10',10],['12',12],['14',14],['16',16],['18',18]],
  CA: [['G',0],['PG',7],['14A',14],['18A',18],['R',18]],
  JP: [['G',0],['PG12',12],['R15+',15],['R18+',18]],
}

export function certToMinAge(cert: string, country: string): number {
  const entries = RATINGS[country] ?? RATINGS['US']
  const normalized = cert.trim().toUpperCase()
  const match = entries.find(([c]) => c.toUpperCase() === normalized)
  return match ? match[1] : 0
}

export function isRestricted(minAge: number, limitAge: number): boolean {
  if (limitAge === 0) return false
  return minAge > limitAge
}

export async function fetchMovieRating(
  id: number,
  apiKey: string,
): Promise<RatingInfo> {
  const country = storage.get<string>(STORAGE_KEYS.RATING_COUNTRY, 'US') ?? 'US'
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${id}/release_dates`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
    const data = await res.json() as { results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> }
    const preferred = data.results.find((r) => r.iso_3166_1 === country)
    const us = data.results.find((r) => r.iso_3166_1 === 'US')
    const entry = preferred ?? us
    const cert = entry?.release_dates.find((d) => d.certification)?.certification ?? null
    return { certification: cert, minAge: cert ? certToMinAge(cert, entry?.iso_3166_1 === country ? country : 'US') : 0 }
  } catch {
    return { certification: null, minAge: 0 }
  }
}

export async function fetchTVRating(
  id: number,
  apiKey: string,
): Promise<RatingInfo> {
  const country = storage.get<string>(STORAGE_KEYS.RATING_COUNTRY, 'US') ?? 'US'
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${id}/content_ratings`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    )
    const data = await res.json() as { results: Array<{ iso_3166_1: string; rating: string }> }
    const preferred = data.results.find((r) => r.iso_3166_1 === country)
    const us = data.results.find((r) => r.iso_3166_1 === 'US')
    const entry = preferred ?? us
    const cert = entry?.rating ?? null
    return { certification: cert, minAge: cert ? certToMinAge(cert, entry?.iso_3166_1 === country ? country : 'US') : 0 }
  } catch {
    return { certification: null, minAge: 0 }
  }
}
