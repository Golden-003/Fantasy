import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * TEST + SYNC SOFASCORE côté serveur Vercel.
 * Vérifie si les fonctions Vercel peuvent accéder au SSR sofascore.com.
 * ?phase=probe → test simple (status page tournoi)
 */
const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
}

async function fetchNextData(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: UA, cache: 'no-store' })
    if (!r.ok) return { _http: r.status }
    const html = await r.text()
    const m = html.match(/__NEXT_DATA__[^>]*>(.*?)<\/script>/s)
    if (!m) return { _http: 200, _noData: true }
    return JSON.parse(m[1])
  } catch (e: any) {
    return { _error: e?.message ?? 'fetch error' }
  }
}

export async function GET(req: Request) {
  const phase = new URL(req.url).searchParams.get('phase') ?? 'probe'
  const t0 = Date.now()

  if (phase === 'probe') {
    const d = await fetchNextData('https://www.sofascore.com/tournament/football/england/premier-league/17')
    const pp = d && !d._error ? d?.props?.pageProps : null
    const season = pp?.info?.season
    return NextResponse.json({
      ok: !!season,
      http: d?._http ?? null,
      error: d?._error ?? null,
      noData: d?._noData ?? false,
      season: season ? `${season.name} (id=${season.id})` : null,
      teams: pp?.standings?.[0]?.rows?.length ?? 0,
      ms: Date.now() - t0,
    })
  }

  return NextResponse.json({ ok: false, error: 'phase inconnue' }, { status: 400 })
}
