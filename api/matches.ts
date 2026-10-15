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

// Clubs whose fixtures we follow (every Liga Profesional, Primera Nacional and Primera B club): ESPN team id and the league they play in.
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
  { teamId: '10054', league: 'arg.3' }, // Excursionistas
  // Conurbano and La Plata
  { teamId: '12', league: 'arg.1' }, // Lanús
  { teamId: '9', league: 'arg.1' }, // Gimnasia La Plata
  { teamId: '8', league: 'arg.1' }, // Estudiantes de La Plata
  { teamId: '235', league: 'arg.1' }, // Banfield
  { teamId: '8950', league: 'arg.1' }, // Defensa y Justicia
  { teamId: '7767', league: 'arg.1' }, // Tigre
  { teamId: '7764', league: 'arg.1' }, // Platense
  { teamId: '15', league: 'arg.1' }, // Racing Club
  { teamId: '11', league: 'arg.1' }, // Independiente
  { teamId: '9740', league: 'arg.2' }, // Almirante Brown
  { teamId: '17352', league: 'arg.2' }, // Estudiantes (Buenos Aires)
  { teamId: '10162', league: 'arg.2' }, // Temperley
  { teamId: '10149', league: 'arg.2' }, // Colegiales
  { teamId: '2', league: 'arg.2' }, // Almagro
  { teamId: '2741', league: 'arg.2' }, // Quilmes
  { teamId: '10109', league: 'arg.2' }, // Midland
  { teamId: '10145', league: 'arg.2' }, // Acassuso
  { teamId: '10154', league: 'arg.2' }, // Deportivo Morón
  { teamId: '10058', league: 'arg.2' }, // San Miguel
  { teamId: '10163', league: 'arg.2' }, // Tristán Suárez
  { teamId: '6', league: 'arg.2' }, // Chacarita Juniors
  { teamId: '10157', league: 'arg.2' }, // San Telmo
  { teamId: '13', league: 'arg.2' }, // Los Andes
  { teamId: '2635', league: 'arg.3' }, // Arsenal Sarandi
  { teamId: '17695', league: 'arg.3' }, // Deportivo Laferrere
  { teamId: '10105', league: 'arg.3' }, // Ituzaingó
  { teamId: '10161', league: 'arg.3' }, // Talleres de Remedios
  { teamId: '17705', league: 'arg.3' }, // UAI Urquiza
  { teamId: '17704', league: 'arg.3' }, // Deportivo Merlo
  { teamId: '18662', league: 'arg.3' }, // Camioneros
  { teamId: '10103', league: 'arg.3' }, // Dock Sud
  { teamId: '10107', league: 'arg.3' }, // Liniers
  { teamId: '17692', league: 'arg.3' }, // San Martín (Burzaco)
  { teamId: '10147', league: 'arg.3' }, // Brown de Adrogué
  { teamId: '17700', league: 'arg.3' }, // Argentino de Merlo
  { teamId: '17693', league: 'arg.3' }, // Argentino de Quilmes
  { teamId: '17703', league: 'arg.3' }, // Sportivo Italiano
  // Rest of Argentina
  { teamId: '9739', league: 'arg.1' }, // Aldosivi
  { teamId: '9785', league: 'arg.1' }, // Atlético Tucumán
  { teamId: '4', league: 'arg.1' }, // Belgrano (Córdoba)
  { teamId: '11989', league: 'arg.1' }, // Central Córdoba (Santiago del Estero)
  { teamId: '19685', league: 'arg.1' }, // Estudiantes de Río Cuarto
  { teamId: '11972', league: 'arg.1' }, // Gimnasia (Mendoza)
  { teamId: '9744', league: 'arg.1' }, // Independiente Rivadavia
  { teamId: '2975', league: 'arg.1' }, // Instituto (Córdoba)
  { teamId: '14', league: 'arg.1' }, // Newell's Old Boys
  { teamId: '17', league: 'arg.1' }, // Rosario Central
  { teamId: '10158', league: 'arg.1' }, // Sarmiento (Junín)
  { teamId: '19', league: 'arg.1' }, // Talleres (Córdoba)
  { teamId: '20', league: 'arg.1' }, // Unión (Santa Fe)
  { teamId: '13913', league: 'arg.2' }, // Agropecuario
  { teamId: '9747', league: 'arg.2' }, // Atletico Rafaela
  { teamId: '11993', league: 'arg.2' }, // Central Norte
  { teamId: '11963', league: 'arg.2' }, // Chaco For Ever
  { teamId: '21799', league: 'arg.2' }, // Ciudad de Bolívar
  { teamId: '7', league: 'arg.2' }, // Colón (Santa Fe)
  { teamId: '18260', league: 'arg.2' }, // Deportivo Madryn
  { teamId: '11978', league: 'arg.2' }, // Deportivo Maipú
  { teamId: '5263', league: 'arg.2' }, // Gimnasia y Esgrima (Jujuy)
  { teamId: '10743', league: 'arg.2' }, // Gimnasia y Tiro (Salta)
  { teamId: '6756', league: 'arg.2' }, // Godoy Cruz Antonio Tomba
  { teamId: '18284', league: 'arg.2' }, // Güemes
  { teamId: '11990', league: 'arg.2' }, // Mitre (Santiago del Estero)
  { teamId: '10374', league: 'arg.2' }, // Patronato
  { teamId: '19145', league: 'arg.2' }, // Racing (Córdoba)
  { teamId: '7845', league: 'arg.2' }, // San Martín (San Juan)
  { teamId: '17814', league: 'arg.2' }, // San Martín (Tucumán)
  { teamId: '17697', league: 'arg.3' }, // Defensores Unidos
  { teamId: '10152', league: 'arg.3' }, // Deportivo Armenio
  { teamId: '10156', league: 'arg.3' }, // Flandria
  { teamId: '18844', league: 'arg.3' }, // Real Pilar
  { teamId: '10064', league: 'arg.3' }, // Villa Dálmine
  { teamId: '10052', league: 'arg.3' } // Villa San Carlos
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
    venueName: venue?.fullName ?? '',
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
