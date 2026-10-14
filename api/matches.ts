// Today's matches (league and cups), read from ESPN's public (undocumented) scoreboard.
// Swapping the data source only requires changing this file.

export type MatchStatus = 'live' | 'upcoming' | 'finished'

export type LiveMatch = {
  id: string
  venueId: string
  homeTeam: string
  awayTeam: string
  status: MatchStatus
  homeScore: string
  awayScore: string
  minute: string
  kickoff: string
  competition: string
}

export type MatchesResponse = {
  matches: LiveMatch[]
  updatedAt: string
}

type EspnCompetitor = {
  homeAway: 'home' | 'away'
  score?: string
  team: { id: string; displayName: string; shortDisplayName: string }
}

type EspnEvent = {
  id: string
  date: string
  status: {
    displayClock: string
    type: { name: string; state: 'pre' | 'in' | 'post' }
  }
  competitions: { competitors: EspnCompetitor[]; venue?: { id: string } }[]
}

type EspnScoreboard = {
  events?: EspnEvent[]
}

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const LEAGUES = [
  { slug: 'arg.1', label: 'Liga Profesional' },
  { slug: 'arg.2', label: 'Primera Nacional' },
  { slug: 'arg.3', label: 'Primera B' },
  { slug: 'arg.copa', label: 'Copa Argentina' },
  { slug: 'conmebol.libertadores', label: 'Copa Libertadores' },
  { slug: 'conmebol.sudamericana', label: 'Copa Sudamericana' }
]
const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const DAY_MS = 24 * 60 * 60 * 1000

function argentinaDate(date: Date) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date)
}

// ESPN's short names are sometimes clipped ("Excursionist"), so only use them for long names.
function teamName(competitor: EspnCompetitor) {
  const full = competitor.team.displayName.trim()
  return full.length <= 16 ? full : competitor.team.shortDisplayName.trim()
}

function toMatch(event: EspnEvent, competition: string): LiveMatch | null {
  const venueId = event.competitions[0]?.venue?.id
  const competitors = event.competitions[0]?.competitors ?? []
  const home = competitors.find((competitor) => competitor.homeAway === 'home')
  const away = competitors.find((competitor) => competitor.homeAway === 'away')
  if (!venueId || !home || !away) return null

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
    venueId,
    homeTeam: teamName(home),
    awayTeam: teamName(away),
    status,
    homeScore: home.score ?? '0',
    awayScore: away.score ?? '0',
    minute,
    kickoff: event.date,
    competition
  }
}

export async function fetchTodayMatches(now = new Date()): Promise<LiveMatch[]> {
  const today = argentinaDate(now)
  // ESPN groups events by its own day boundaries, so read the neighbouring days too
  // and keep only what falls on today in Argentina.
  const days = [-1, 0, 1].map((offset) =>
    argentinaDate(new Date(now.getTime() + offset * DAY_MS)).replaceAll('-', '')
  )

  const requests = LEAGUES.flatMap((league) =>
    days.map(async (day) => {
      const response = await fetch(`${SCOREBOARD_URL}/${league.slug}/scoreboard?dates=${day}`)
      if (!response.ok) throw new Error(`ESPN ${response.status} for ${league.slug} ${day}`)
      return { league, board: (await response.json()) as EspnScoreboard }
    })
  )
  // One competition failing shouldn't hide the others.
  const results = await Promise.allSettled(requests)
  const failures = results.filter((result) => result.status === 'rejected')
  if (failures.length === results.length) throw failures[0].reason
  failures.forEach((failure) => console.warn(failure.reason))

  const matches = new Map<string, LiveMatch>()
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { league, board } = result.value
    for (const event of board.events ?? []) {
      if (argentinaDate(new Date(event.date)) !== today) continue
      const match = toMatch(event, league.label)
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
