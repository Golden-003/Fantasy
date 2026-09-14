import { NextResponse } from 'next/server'
import { getAnalysis } from '@/lib/coach/analysis'

export const dynamic = 'force-dynamic'

export async function GET() {
  // 1 tentative + 1 retry (réseau Neon parfois instable depuis serverless)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const analysis = await getAnalysis()
      return NextResponse.json(analysis)
    } catch (e) {
      console.error(`analysis error (tentative ${attempt + 1})`, e)
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200))
    }
  }
  return NextResponse.json({ error: 'Analyse indisponible' }, { status: 500 })
}
