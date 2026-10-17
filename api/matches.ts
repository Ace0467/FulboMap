// Matches for the map, read from ESPN's public (undocumented) API: month scoreboards for each
// competition give live, recent and upcoming matches with venues and scorers.
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
  venueName: string
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
  // TV channels (Liga Profesional only, from Promiedos), e.g. "ESPN Premium · HBO Max"
  tv?: string
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

// Some events (Copa Argentina, for one) name the venue but omit its id, so map our stadiums' ESPN names to ids.
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
  'Estadio de Excursionistas': '6110',
  'Ciudad de Lanús': '10792',
  'Juan Carmelo Zerillo (El Bosque)': '1731',
  'Estadio Jorge Luis Hirschi': '8296',
  'Florencio Solá': '10789',
  'Norberto Tomaghello': '5554',
  'Monumental de Victoria (José Dellagiovanna)': '5354',
  'Ciudad de Vicente López': '3250',
  'Presidente Perón (Cilindro de Avellaneda)': '5349',
  'Estadio Libertadores de América': '5555',
  'Fragata Presidente Sarmiento': '10975',
  'Estadio Ciudad de Caseros': '10566',
  'Alfredo Beranger': '10978',
  'Estadio Libertarios Unidos': '10972',
  'Tres de Febrero': '10976',
  'Estadio Centenario Ciudad de Quilmes': '5351',
  'Estadio Ferrocarril Midland': '6112',
  'La Quema': '10696',
  'Estadio Nuevo Francisco Urbano': '10568',
  'Malvinas Argentinas (Los Polvorines)': '6100',
  'Estadio 20 de Octubre': '10567',
  'Chacarita Juniors': '10974',
  'Dr. Osvaldo Baletto': '6109',
  'Eduardo Gallardón': '3322',
  'Julio Humberto Grondona': '5355',
  'Estadio Ciudad De Laferrere': '6099',
  'Estadio de Ituzaingó': '6123',
  'Estadio Pablo Comelli': '6108',
  'Monumental de Villa Lynch': '3596',
  'José Manuel Moreno': '10990',
  'Estadio Hugo Moyano': '10238',
  'De Los Inmigrantes': '10989',
  'Juan Antonio Arias': '11160',
  'Francisco Boga': '10988',
  'Lorenzo Arandilla': '10859',
  'Juan Carlos Brieva': '10697',
  'Estadio de Argentino de Quilmes': '10987',
  'República de Italia': '5698',
  'José María Minella': '10781',
  'Monumental Presidente José Fierro': '5558',
  'El Gigante de Alberdi': '2736',
  'Alfredo Terrera': '6075',
  'Ciudad de Río Cuarto Antonio Candini': '8203',
  'Estadio Víctor Antonio Legrotaglie': '10925',
  'Bautista Gargantini': '3253',
  'Monumental Presidente Perón': '5557',
  'Marcelo Bielsa': '10794',
  'Gigante de Arroyito': '10775',
  'Eva Perón': '10784',
  'Mario Alberto Kempes': '10782',
  '15 de Abril': '10790',
  'Estadio Ofelia Rosenzuaig': '7454',
  'Estadio Nuevo Monumental': '10982',
  'Padre Ernesto Martearena': '5717',
  'Estadio Juan Alberto García': '10973',
  'Estadio Municipal Eva Perón': '9246',
  'Brigadier Gral. Estanislao López': '10983',
  'Coliseo del Golfo': '4739',
  'Estadio Omar Higinio Sperdutti': '8432',
  '23 de Agosto': '10565',
  'Monumental de Vicente López': '9878',
  'Estadio Feliciano Gambarte': '8699',
  'Arturo Miranda': '8656',
  'Estadio Castiglione': '10984',
  'Estadio Presbítero Bartolomé Grella': '10979',
  'Estadio Miguel Sancho': '9464',
  'Estadio Ingeniero Hilario Sánchez': '10795',
  'Estadio La Ciudadela': '6852',
  'Gigante de Villa Fox': '6104',
  'Estadio Armenia': '6138',
  'Carlos V': '10894',
  'Estadio Municipal de Pilar Carlos Barraza': '6131',
  'Estadio Villa Dálmine': '6077',
  'Genacio Sálice': '5562'
}

// Our own short names where ESPN's clash (RIV for River and Independiente Rivadavia) or read oddly
// (AAE for Estudiantes de Río Cuarto), by ESPN team id
const ABBREVIATIONS: Record<string, string> = {
  // Liga Profesional
  '9739': 'ALD', // Aldosivi
  '3': 'ARG', // Argentinos Juniors
  '9785': 'ATU', // Atlético Tucumán
  '5': 'BOC', // Boca Juniors
  '11989': 'CCO', // Central Córdoba (Santiago del Estero)
  '19685': 'ERC', // Estudiantes de Río Cuarto
  '11972': 'GEM', // Gimnasia (Mendoza)
  '9': 'GIM', // Gimnasia La Plata
  '9744': 'IRM', // Independiente Rivadavia
  '10158': 'SAR', // Sarmiento (Junín)
  '19': 'TAL', // Talleres (Córdoba)
  '20': 'UNI', // Unión (Santa Fe)
  // Primera Nacional
  '9786': 'ALL', // All Boys
  '9740': 'BRO', // Almirante Brown
  '6756': 'GOD', // Godoy Cruz Antonio Tomba
  '236': 'CHI', // Nueva Chicago
  '17814': 'SMT', // San Martín (Tucumán)
  '10162': 'TEM', // Temperley
  // Primera B
  '17700': 'AGM', // Argentino de Merlo
  '17693': 'AQU', // Argentino de Quilmes
  '17692': 'SMB', // San Martín (Burzaco)
  '17703': 'ITA', // Sportivo Italiano
  '10161': 'TRE', // Talleres de Remedios
  '10064': 'DAL' // Villa Dálmine
}

const abbreviation = (competitor: EspnCompetitor) =>
  ABBREVIATIONS[competitor.team.id] ??
  competitor.team.abbreviation ??
  teamName(competitor).slice(0, 3).toUpperCase()

const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const DAY_MS = 24 * 60 * 60 * 1000

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
    venueName: venue?.fullName ?? '',
    homeTeamId: home.team.id,
    awayTeamId: away.team.id,
    homeTeam: teamName(home),
    awayTeam: teamName(away),
    homeAbbr: abbreviation(home),
    awayAbbr: abbreviation(away),
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

// A month scoreboard lists every match of a competition that month, with live status, venue ids
// and scorers: one request per competition and month instead of one per club.
// Reads last month only when yesterday falls in it (finished matches stay for a day).
function fetchMonthBoards(now: Date) {
  const month = (date: Date) => argentinaDay(date).slice(0, 6)
  const yesterday = new Date(now.getTime() - DAY_MS)
  const nextMonth = new Date(now.getTime() + 32 * DAY_MS)
  const months = [...new Set([month(yesterday), month(now), month(nextMonth)])]
  return settle(
    Object.keys(LEAGUES).flatMap((league) =>
      months.map((m) => fetchEvents(`scoreboard?limit=500&dates=${m}`, league))
    )
  )
}

// --- TV channels ------------------------------------------------------------------------------
// ESPN has no broadcast data for Argentina. Promiedos lists channels for Liga Profesional matches
// on each match page (its detail API isn't public), so we read the pages of upcoming and live
// matches, a few times a day at most. If Promiedos changes, channels just stop showing.

type PromiedosGame = {
  id: string
  url_name: string
  start_time: string // "16-10-2026 21:30", Argentine time
  status: { enum: number } // 1 scheduled, 2 live, 3 finished
  teams: { url_name: string }[]
}

const PROMIEDOS_LPF_GAMES = 'https://api.promiedos.com.ar/league/games/hc/latest'
const PROMIEDOS_GAME_PAGE = 'https://www.promiedos.com.ar/game'
const TV_TTL_MS = 6 * 60 * 60 * 1000
const STOPWORDS = new Set(['de', 'la', 'el', 'del', 'club', 'atletico', 'ca', 'fc', 'juniors'])

let tvCache: { at: number; games: { kickoff: string; home: string[]; away: string[]; tv: string }[] } | null = null

const kickoffFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

// "16-10-2026 21:30" for an ESPN kickoff, to compare with Promiedos' start_time
function promiedosTime(iso: string) {
  const parts = Object.fromEntries(kickoffFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`
}

// Name words without accents or filler, so "Talleres" matches "talleres-cordoba"
function nameTokens(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
}

// Words match when one starts with the other, so ESPN's "Def. y Jus." finds "defensa-y-justicia"
const overlaps = (a: string[], b: string[]) =>
  a.some((word) => b.some((other) => word.startsWith(other) || other.startsWith(word)))

// "TNT Sports Premium, HBO MAX (Suscripción Pack fútbol)" → "TNT Sports Premium · HBO Max"
function cleanChannels(raw: string) {
  return raw
    .split(',')
    .map((channel) => channel.replace(/\(.*?\)/g, '').trim().replace(/^HBO MAX$/i, 'HBO Max'))
    .filter(Boolean)
    .join(' · ')
}

async function fetchTvChannels() {
  if (tvCache && Date.now() - tvCache.at < TV_TTL_MS) return tvCache.games

  const list = (await (await fetch(PROMIEDOS_LPF_GAMES)).json()) as { games?: PromiedosGame[] }
  const pending = (list.games ?? []).filter((game) => game.status.enum !== 3)
  const games = []
  // A few pages at a time, to stay gentle with the site
  for (let i = 0; i < pending.length; i += 4) {
    const batch = await Promise.allSettled(
      pending.slice(i, i + 4).map(async (game) => {
        const page = await (await fetch(`${PROMIEDOS_GAME_PAGE}/${game.url_name}/${game.id}`)).text()
        const tv = page.match(/"name":"Arg TV","value":"([^"]*)"/)?.[1]
        if (!tv) return null
        return {
          kickoff: game.start_time,
          home: nameTokens(game.teams[0]?.url_name ?? ''),
          away: nameTokens(game.teams[1]?.url_name ?? ''),
          tv: cleanChannels(tv)
        }
      })
    )
    for (const result of batch) if (result.status === 'fulfilled' && result.value) games.push(result.value)
  }
  tvCache = { at: Date.now(), games }
  return games
}

async function addTvChannels(matches: LiveMatch[]) {
  const wanted = matches.filter(
    (match) => match.competition === 'Liga Profesional' && match.status !== 'finished'
  )
  if (!wanted.length) return
  try {
    const games = await fetchTvChannels()
    for (const match of wanted) {
      const kickoff = promiedosTime(match.kickoff)
      const game = games.find(
        (candidate) =>
          candidate.kickoff === kickoff &&
          overlaps(candidate.home, nameTokens(match.homeTeam)) &&
          overlaps(candidate.away, nameTokens(match.awayTeam))
      )
      if (game) match.tv = game.tv
    }
  } catch (error) {
    console.warn('TV channels unavailable', error)
  }
}

export async function fetchMatches(now = new Date()): Promise<LiveMatch[]> {
  // Months overlap at their edges, so de-duplicate by event id
  const matches = new Map<string, LiveMatch>()
  for (const match of await fetchMonthBoards(now)) matches.set(match.id, match)

  // Finished matches stay on their ground on matchday and the day after
  const yesterday = argentinaDay(new Date(now.getTime() - DAY_MS))
  const shown = [...matches.values()].filter(
    (match) => match.status !== 'finished' || argentinaDay(new Date(match.kickoff)) >= yesterday
  )
  await addTvChannels(shown)
  return shown
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
