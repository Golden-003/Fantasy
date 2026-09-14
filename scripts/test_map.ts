import { readFileSync } from 'fs'
const data = JSON.parse(readFileSync('scripts/sofa_data.json', 'utf8'))
const CLUB: Record<string, string> = {
  arsenal: 'Arsenal', 'manchester-city': 'Man City', 'leeds-united': 'Leeds',
  'tottenham-hotspur': 'Spurs', 'nottingham-forest': "Nott'm Forest",
}
const clubOf = (slug: string | null | undefined) => (slug ? CLUB[slug] ?? slug : 'Inconnu')
const teams: any[] = data.teams
console.log('nb teams:', teams.length)
console.log('sample team:', JSON.stringify(teams[0]))
const standings = new Map(teams.map((t) => [clubOf(t.slug), t.position]))
console.log('map size:', standings.size)
console.log('get Arsenal:', standings.get('Arsenal'))
console.log('get Man City:', standings.get('Man City'))
console.log('get Leeds:', standings.get('Leeds'))
console.log('type de position:', typeof teams[0].position)
