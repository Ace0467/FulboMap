// Today's Liga Profesional matches, read from ESPN's public (undocumented) scoreboard.
// Swapping the data source only requires changing this file.

export type MatchStatus = 'live' | 'upcoming' | 'finished'

export type LiveMatch = {
  id: string
  homeTeamId: string
  homeTeam: string
  awayTeam: string
  status: MatchStatus
  homeScore: string
  awayScore: string
  minute: string
  kickoff: string
  competition: string
  venue: string
}

export type MatchesResponse = {
  matches: LiveMatch[]
  updatedAt: string
}

type EspnCompetitor = {
  homeAway: 'home' | 'away'
  score?: string
  team: { id: string; shortDisplayName: string }
}

type EspnEvent = {
  id: string
  date: string
  status: {
    displayClock: string
    type: { name: string; state: 'pre' | 'in' | 'post' }
  }
  competitions: { competitors: EspnCompetitor[]; venue?: { fullName: string } }[]
}

type EspnScoreboard = {
  events?: EspnEvent[]
}

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/scoreboard'
const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const DAY_MS = 24 * 60 * 60 * 1000

function argentinaDate(date: Date) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date)
}

function toMatch(event: EspnEvent): LiveMatch | null {
  const competitors = event.competitions[0]?.competitors ?? []
  const home = competitors.find((competitor) => competitor.homeAway === 'home')
  const away = competitors.find((competitor) => competitor.homeAway === 'away')
  if (!home || !away) return null

  const { state, name } = event.status.type
  const status: MatchStatus = state === 'in' ? 'live' : state === 'post' ? 'finished' : 'upcoming'
  const minute =
    status === 'finished'
      ? 'FT'
      : status === 'upcoming'
        ? 'Próximo'
        : name === 'STATUS_HALFTIME'
          ? 'ET'
          : event.status.displayClock

  return {
    id: event.id,
    homeTeamId: home.team.id,
    homeTeam: home.team.shortDisplayName.trim(),
    awayTeam: away.team.shortDisplayName.trim(),
    status,
    homeScore: home.score ?? '0',
    awayScore: away.score ?? '0',
    minute,
    kickoff: event.date,
    competition: 'Liga Profesional',
    venue: event.competitions[0]?.venue?.fullName ?? ''
  }
}

export async function fetchTodayMatches(now = new Date()): Promise<LiveMatch[]> {
  const today = argentinaDate(now)
  // ESPN groups events by its own day boundaries, so read the neighbouring days too
  // and keep only what falls on today in Argentina.
  const days = [-1, 0, 1].map((offset) =>
    argentinaDate(new Date(now.getTime() + offset * DAY_MS)).replaceAll('-', '')
  )

  const boards = await Promise.all(
    days.map(async (day) => {
      const response = await fetch(`${SCOREBOARD_URL}?dates=${day}`)
      if (!response.ok) throw new Error(`ESPN ${response.status} for ${day}`)
      return (await response.json()) as EspnScoreboard
    })
  )

  const matches = new Map<string, LiveMatch>()
  for (const board of boards) {
    for (const event of board.events ?? []) {
      if (argentinaDate(new Date(event.date)) !== today) continue
      const match = toMatch(event)
      if (match) matches.set(match.id, match)
    }
  }

  return [...matches.values()]
}

export async function GET() {
  try {
    const body: MatchesResponse = {
      matches: await fetchTodayMatches(),
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
