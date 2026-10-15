// Matches for the map, read from ESPN's public (undocumented) API:
// - scoreboards around today give live and recently finished matches (with scorers);
// - each CABA club's fixture list gives upcoming matches, however far ahead.
// Swapping the data source only requires changing this file.

export type MatchStatus = 'live' | 'upcoming' | 'finished'

export type Goal = {
  side: 'home' | 'away'
  player: string
  minute: string
  penalty: boolean
  ownGoal: boolean
}

export type LiveMatch = {
  id: string
  // ESPN venue id; '' when the venue isn't one we know
  venueId: string
  homeTeamId: string
  awayTeamId: string
  homeTeam: string
  awayTeam: string
  homeAbbr: string
  awayAbbr: string
  status: MatchStatus
  homeScore: string
  awayScore: string
  minute: string
  kickoff: string
  competition: string
  goals: Goal[]
}

export type MatchesResponse = {
  matches: LiveMatch[]
  updatedAt: string
}

type EspnCompetitor = {
  homeAway: 'home' | 'away'
  score?: string | { displayValue?: string }
  team: { id: string; abbreviation?: string; displayName: string; shortDisplayName: string }
}

type EspnDetail = {
  scoringPlay?: boolean
  penaltyKick?: boolean
  ownGoal?: boolean
  clock?: { displayValue: string }
  team?: { id: string }
  athletesInvolved?: { shortName?: string; displayName?: string }[]
}

type EspnEvent = {
  id: string
  date: string
  status?: {
    displayClock: string
    type: { name: string; state: 'pre' | 'in' | 'post' }
  }
  competitions?: {
    competitors?: EspnCompetitor[]
    venue?: { id?: string; fullName?: string }
    details?: EspnDetail[]
    status?: EspnEvent['status']
  }[]
}

type EspnEventList = {
  events?: EspnEvent[]
}

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const LEAGUES: Record<string, string> = {
  'arg.1': 'Liga Profesional',
  'arg.2': 'Primera Nacional',
  'arg.3': 'Primera B',
  'arg.copa': 'Copa Argentina',
  'conmebol.libertadores': 'Copa Libertadores',
  'conmebol.sudamericana': 'Copa Sudamericana'
}

// CABA clubs whose fixtures we follow: ESPN team id and the league they play in.
// Top-flight clubs can also be in CONMEBOL cups; everyone plays the Copa Argentina.
const CLUBS = [
  { teamId: '5', league: 'arg.1' }, // Boca Juniors
  { teamId: '16', league: 'arg.1' }, // River Plate
  { teamId: '18', league: 'arg.1' }, // San Lorenzo
  { teamId: '21', league: 'arg.1' }, // Vélez Sarsfield
  { teamId: '10', league: 'arg.1' }, // Huracán
  { teamId: '3', league: 'arg.1' }, // Argentinos Juniors
  { teamId: '17702', league: 'arg.1' }, // Deportivo Riestra
  { teamId: '10060', league: 'arg.1' }, // Barracas Central
  { teamId: '9786', league: 'arg.2' }, // All Boys
  { teamId: '10146', league: 'arg.2' }, // Atlanta
  { teamId: '10151', league: 'arg.2' }, // Defensores de Belgrano
  { teamId: '9743', league: 'arg.2' }, // Ferro Carril Oeste
  { teamId: '236', league: 'arg.2' }, // Nueva Chicago
  { teamId: '14074', league: 'arg.3' }, // Comunicaciones
  { teamId: '10054', league: 'arg.3' } // Excursionistas
]

// Fixture lists name the venue but omit its id, so map our stadiums' ESPN names to ids.
const VENUE_IDS: Record<string, string> = {
  'Alberto José Armando (La Bombonera)': '5348',
  'Estadio Más Monumental': '10786',
  'Estadio Pedro Bidegain': '10791',
  'José Amalfitani': '10761',
  'Estadio Tomás Adolfo Ducó': '10783',
  'Diego Armando Maradona': '10785',
  'Guillermo Laza': '10787',
  'Estadio Claudio Chiqui Tapia': '10793',
  'Estadio Islas Malvinas': '10985',
  'Don León Kolbovsky': '5670',
  'Juan Pasquale': '10977',
  'Estadio Arquitecto Ricardo Etcheverri': '10981',
  'República de Mataderos': '10980',
  'Alfredo Ramos': '3643',
  'Estadio de Excursionistas': '6110'
}

const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const DAY_MS = 24 * 60 * 60 * 1000
const FIXTURES_TTL_MS = 10 * 60 * 1000

function argentinaDay(date: Date) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date).replaceAll('-', '')
}

// ESPN's short names are sometimes clipped ("Excursionist"), so only use them for long names.
function teamName(competitor: EspnCompetitor) {
  const full = competitor.team.displayName.trim()
  return full.length <= 16 ? full : competitor.team.shortDisplayName.trim()
}

function scoreOf(competitor: EspnCompetitor) {
  const { score } = competitor
  if (typeof score === 'object') return score?.displayValue ?? '0'
  return score ?? '0'
}

function toMatch(event: EspnEvent, competition: string): LiveMatch | null {
  const competitionData = event.competitions?.[0]
  const competitors = competitionData?.competitors ?? []
  const home = competitors.find((competitor) => competitor.homeAway === 'home')
  const away = competitors.find((competitor) => competitor.homeAway === 'away')
  const eventStatus = event.status ?? competitionData?.status
  if (!home || !away || !eventStatus) return null

  const venue = competitionData?.venue
  const { state, name } = eventStatus.type
  const status: MatchStatus = state === 'in' ? 'live' : state === 'post' ? 'finished' : 'upcoming'
  const minute =
    status === 'finished'
      ? 'FT'
      : status === 'upcoming'
        ? 'Próximo'
        : name === 'STATUS_HALFTIME'
          ? 'ET'
          : eventStatus.displayClock

  return {
    id: event.id,
    venueId: venue?.id ?? VENUE_IDS[venue?.fullName ?? ''] ?? '',
    homeTeamId: home.team.id,
    awayTeamId: away.team.id,
    homeTeam: teamName(home),
    awayTeam: teamName(away),
    homeAbbr: home.team.abbreviation ?? teamName(home).slice(0, 3).toUpperCase(),
    awayAbbr: away.team.abbreviation ?? teamName(away).slice(0, 3).toUpperCase(),
    status,
    homeScore: scoreOf(home),
    awayScore: scoreOf(away),
    minute,
    kickoff: event.date,
    competition,
    goals: (competitionData?.details ?? [])
      .filter((detail) => detail.scoringPlay)
      .map((detail) => ({
        side: detail.team?.id === away.team.id ? 'away' : 'home',
        player: detail.athletesInvolved?.[0]?.shortName ?? detail.athletesInvolved?.[0]?.displayName ?? '',
        minute: detail.clock?.displayValue ?? '',
        penalty: Boolean(detail.penaltyKick),
        ownGoal: Boolean(detail.ownGoal)
      }))
  }
}

async function fetchEvents(path: string, league: string) {
  const response = await fetch(`${ESPN_URL}/${league}/${path}`)
  if (!response.ok) throw new Error(`ESPN ${response.status} for ${league}/${path}`)
  const list = (await response.json()) as EspnEventList
  return (list.events ?? []).map((event) => toMatch(event, LEAGUES[league]))
}

// Runs every request, keeping what succeeded: one competition failing shouldn't hide the others.
async function settle(requests: Promise<(LiveMatch | null)[]>[]) {
  const results = await Promise.allSettled(requests)
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length === results.length) throw failures[0].reason
  failures.forEach((failure) => console.warn(failure.reason))
  return results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value.filter((match) => match !== null) : []
  )
}

// Live scores and scorers for yesterday, today and tomorrow (ESPN's day boundaries differ from ours)
function fetchScoreboards(now: Date) {
  const days = [-1, 0, 1].map((offset) => argentinaDay(new Date(now.getTime() + offset * DAY_MS)))
  return settle(
    Object.keys(LEAGUES).flatMap((league) =>
      days.map((day) => fetchEvents(`scoreboard?dates=${day}`, league))
    )
  )
}

// Upcoming fixtures change rarely; keep them for a few minutes per server instance
let fixturesCache: { at: number; matches: LiveMatch[] } | null = null

async function fetchFixtures() {
  if (fixturesCache && Date.now() - fixturesCache.at < FIXTURES_TTL_MS) return fixturesCache.matches

  const matches = await settle(
    CLUBS.flatMap(({ teamId, league }) => {
      const leagues =
        league === 'arg.1'
          ? [league, 'arg.copa', 'conmebol.libertadores', 'conmebol.sudamericana']
          : [league, 'arg.copa']
      return leagues.map((slug) => fetchEvents(`teams/${teamId}/schedule?fixture=true`, slug))
    })
  )
  fixturesCache = { at: Date.now(), matches }
  return matches
}

export async function fetchMatches(now = new Date()): Promise<LiveMatch[]> {
  const [fixtures, scoreboards] = await Promise.all([fetchFixtures(), fetchScoreboards(now)])

  // Scoreboard entries win: they carry live status, venue ids and scorers
  const matches = new Map<string, LiveMatch>()
  for (const match of [...fixtures, ...scoreboards]) matches.set(match.id, match)

  // Finished matches stay on their ground on matchday and the day after
  const yesterday = argentinaDay(new Date(now.getTime() - DAY_MS))
  return [...matches.values()].filter(
    (match) => match.status !== 'finished' || argentinaDay(new Date(match.kickoff)) >= yesterday
  )
}

export async function GET() {
  try {
    const body: MatchesResponse = {
      matches: await fetchMatches(),
      updatedAt: new Date().toISOString()
    }
    return Response.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' }
    })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'No se pudieron obtener los partidos' }, { status: 502 })
  }
}
