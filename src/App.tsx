import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import type { FeatureCollection, Polygon } from 'geojson'
import type { Goal, LiveMatch, MatchesResponse } from '../api/matches.ts'
// Stand rings (OSM stadium outline minus the pitch), generated from OpenStreetMap
import stadiumStandsData from './data/stadium-stands.json'

const stadiumStands = stadiumStandsData as FeatureCollection<Polygon, { id: string; height: number }>

type StadiumStatus = 'live' | 'upcoming' | 'finished' | 'idle'
type Filter = 'todos' | 'en vivo' | 'próximos' | 'finalizados'

type StadiumMatch = {
  status: StadiumStatus
  competition: string
  homeScore?: string
  awayScore?: string
  // "20:30", only while the match hasn't started
  kickoffTime?: string
  // "hoy", "mañana", "jue 16/10"…; shown next to the status for upcoming and finished matches
  day?: string
  // Shirt of the home side when it's one of our clubs (e.g. Boca playing at the Ducó)
  kit?: string
  minute: string
  // Defaults to the stadium's club; differs for cup matches at a neutral venue
  home?: string
  rival: string
  goals: Goal[]
  // Only shown when the stadium has no match
  description?: string
  // Short label shown above the marker, e.g. "BOC 2-1 RIV"
  pin?: string
}

type Stadium = {
  id: string
  name: string
  neighborhood: string
  club: string
  position: [number, number]
  espnVenueId: string
  espnTeamId: string
  // Club shirt as a CSS background, drawn inside the marker dot
  kit: string
  // Shown when the club has no real match today
  placeholder?: StadiumMatch
}

// hidden: no match here and the club's next match is at another ground
type StadiumView = Stadium & { match: StadiumMatch; hidden: boolean }

const stadiums: Stadium[] = [
  {
    id: 'bombonera',
    name: 'La Bombonera',
    neighborhood: 'La Boca',
    club: 'Boca Juniors',
    position: [-58.3649163, -34.6355171],
    espnVenueId: '5348',
    espnTeamId: '5',
    kit: 'linear-gradient(180deg, #0a3a8c 0 34%, #f5b800 34% 66%, #0a3a8c 66%)',
    placeholder: {
      status: 'live',
      competition: 'Partido de ejemplo',
      homeScore: '2',
      awayScore: '1',
      minute: '67’',
      rival: 'River Plate',
      goals: [
        { side: 'home', player: 'M. Merentiel', minute: "23'", penalty: false, ownGoal: false },
        { side: 'away', player: 'S. Driussi', minute: "41'", penalty: false, ownGoal: false },
        { side: 'home', player: 'S. Villa', minute: "58'", penalty: true, ownGoal: false }
      ],
      pin: 'BOC 2-1 RIV'
    }
  },
  {
    id: 'monumental',
    name: 'El Monumental',
    neighborhood: 'Belgrano',
    club: 'River Plate',
    position: [-58.4497385, -34.5452932],
    espnVenueId: '10786',
    espnTeamId: '16',
    kit: 'linear-gradient(135deg, #ffffff 0 36%, #d6111e 36% 64%, #ffffff 64%)'
  },
  {
    id: 'gasometro',
    name: 'Estadio de San Lorenzo',
    neighborhood: 'Flores',
    club: 'San Lorenzo',
    position: [-58.4401364, -34.6520908],
    espnVenueId: '10791',
    espnTeamId: '18',
    kit: 'linear-gradient(90deg, #1b3a8a 0 25%, #c8102e 25% 50%, #1b3a8a 50% 75%, #c8102e 75%)'
  },
  {
    id: 'amalfitani',
    name: 'Amalfitani',
    neighborhood: 'Liniers',
    club: 'Vélez Sarsfield',
    position: [-58.5206788, -34.6353382],
    espnVenueId: '10761',
    espnTeamId: '21',
    kit: 'conic-gradient(at 50% 82%, #ffffff 0 22deg, #1d4fa0 22deg 44deg, #ffffff 44deg 316deg, #1d4fa0 316deg 338deg, #ffffff 338deg)'
  },
  {
    id: 'duco',
    name: 'Estadio Ducó',
    neighborhood: 'Parque Patricios',
    club: 'Huracán',
    position: [-58.3965055, -34.6434694],
    espnVenueId: '10783',
    espnTeamId: '10',
    // Red H on white
    kit: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='%23d91a21' d='M5 4h3v4.5h4V4h3v12h-3v-4.5H8V16H5z'/%3E%3C/svg%3E\") center / 78% no-repeat, #ffffff"
  },
  {
    id: 'maradona',
    name: 'Estadio Diego Armando Maradona',
    neighborhood: 'La Paternal',
    club: 'Argentinos Juniors',
    position: [-58.4726194, -34.6061215],
    espnVenueId: '10785',
    espnTeamId: '3',
    // Red with a white sash, inside a blue inner outline
    kit: 'radial-gradient(circle closest-side, transparent 60%, #1d4fa0 63%), linear-gradient(45deg, #e30613 0 43%, #ffffff 43% 57%, #e30613 57%)'
  },
  {
    id: 'laza',
    name: 'Estadio Guillermo Laza',
    neighborhood: 'Villa Soldati',
    club: 'Deportivo Riestra',
    position: [-58.4435109, -34.6533436],
    espnVenueId: '10787',
    espnTeamId: '17702',
    kit: 'linear-gradient(180deg, #ffffff 0 34%, #111111 34% 66%, #ffffff 66%)'
  },
  {
    id: 'chiqui-tapia',
    name: 'Estadio Claudio Chiqui Tapia',
    neighborhood: 'Barracas',
    club: 'Barracas Central',
    position: [-58.3967965, -34.6475809],
    espnVenueId: '10793',
    espnTeamId: '10060',
    kit: 'linear-gradient(90deg, #d6111e 0 20%, #ffffff 20% 40%, #d6111e 40% 60%, #ffffff 60% 80%, #d6111e 80%)'
  },
  {
    id: 'islas-malvinas',
    name: 'Estadio Islas Malvinas',
    neighborhood: 'Monte Castro',
    club: 'All Boys',
    position: [-58.4977469, -34.6165101],
    espnVenueId: '10985',
    espnTeamId: '9786',
    kit: 'linear-gradient(135deg, #ffffff 0 36%, #111111 36% 64%, #ffffff 64%)'
  },
  {
    id: 'kolbovsky',
    name: 'Estadio Don León Kolbovsky',
    neighborhood: 'Villa Crespo',
    club: 'Atlanta',
    position: [-58.4441846, -34.5909876],
    espnVenueId: '5670',
    espnTeamId: '10146',
    kit: 'linear-gradient(90deg, #1d4fa0 0 25%, #f5c400 25% 50%, #1d4fa0 50% 75%, #f5c400 75%)'
  },
  {
    id: 'pasquale',
    name: 'Estadio Juan Pasquale',
    neighborhood: 'Núñez',
    club: 'Defensores de Belgrano',
    position: [-58.4618769, -34.5412006],
    espnVenueId: '10977',
    espnTeamId: '10151',
    kit: 'linear-gradient(90deg, #d6111e 0 25%, #111111 25% 50%, #d6111e 50% 75%, #111111 75%)'
  },
  {
    id: 'etcheverri',
    name: 'Estadio Arquitecto Ricardo Etcheverri',
    neighborhood: 'Caballito',
    club: 'Ferro Carril Oeste',
    position: [-58.4478378, -34.6187654],
    espnVenueId: '10981',
    espnTeamId: '9743',
    // Green chevron on white with a green inner outline, as on the crest
    kit: 'radial-gradient(circle closest-side, transparent 72%, #1a8a3a 75%), conic-gradient(from 140deg at 50% 42%, #1a8a3a 0 80deg, #ffffff 80deg)'
  },
  {
    id: 'mataderos',
    name: 'Estadio República de Mataderos',
    neighborhood: 'Mataderos',
    club: 'Nueva Chicago',
    position: [-58.4995224, -34.6680105],
    espnVenueId: '10980',
    espnTeamId: '236',
    kit: 'linear-gradient(90deg, #138a3c 0 25%, #111111 25% 50%, #138a3c 50% 75%, #111111 75%)'
  },
  {
    id: 'alfredo-ramos',
    name: 'Estadio Alfredo Ramos',
    neighborhood: 'Agronomía',
    club: 'Comunicaciones',
    position: [-58.4884999, -34.5938106],
    espnVenueId: '3643',
    espnTeamId: '14074',
    kit: 'linear-gradient(90deg, #f5c400 0 50%, #111111 50%)'
  },
  {
    id: 'excursionistas',
    name: 'Estadio de Excursionistas',
    neighborhood: 'Belgrano',
    club: 'Excursionistas',
    position: [-58.4429075, -34.5589889],
    espnVenueId: '6110',
    espnTeamId: '10054',
    kit: 'linear-gradient(90deg, #138a3c 0 25%, #ffffff 25% 50%, #138a3c 50% 75%, #ffffff 75%)'
  }
]

const noMatch: StadiumMatch = {
  status: 'idle',
  competition: 'Liga Profesional',
  minute: '',
  rival: '',
  goals: [],
  description: 'No hay partidos próximos en este estadio.'
}

const REFRESH_MS = 60_000

const kickoffFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

const TIME_ZONE = 'America/Argentina/Buenos_Aires'
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
// ESPN gives no end time; a match is over roughly two hours after kickoff
const MATCH_LENGTH_MS = 2 * HOUR_MS
// A finished match stays on its ground this long after the final whistle
const FINISHED_HOLD_MS = DAY_MS

const ymdFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE })
const weekdayFormat = new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, weekday: 'short' })
const dayMonthFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'numeric'
})

// "hoy", "mañana", "ayer" or "jue 16/10", in Argentine time
function dayLabel(date: Date, now: number) {
  const day = ymdFormat.format(date)
  if (day === ymdFormat.format(now)) return 'hoy'
  if (day === ymdFormat.format(now + DAY_MS)) return 'mañana'
  if (day === ymdFormat.format(now - DAY_MS)) return 'ayer'
  return `${weekdayFormat.format(date).replace('.', '')} ${dayMonthFormat.format(date)}`
}

const kitByTeam = new Map(stadiums.map((stadium) => [stadium.espnTeamId, stadium.kit]))

const byKickoff = (a: LiveMatch, b: LiveMatch) => a.kickoff.localeCompare(b.kickoff)

// What a ground shows: a live match, else the last one for 24 h after it ends, else the next one
function pickMatch(stadium: Stadium, matches: LiveMatch[], now: number) {
  const here = matches.filter((match) => match.venueId === stadium.espnVenueId)
  const live = here.find((match) => match.status === 'live')
  if (live) return live

  const recent = here
    .filter(
      (match) =>
        match.status === 'finished' &&
        now - (new Date(match.kickoff).getTime() + MATCH_LENGTH_MS) < FINISHED_HOLD_MS
    )
    .sort(byKickoff)
    .at(-1)
  if (recent) return recent

  return here.filter((match) => match.status === 'upcoming').sort(byKickoff)[0]
}

// True when the club's next (or current) match is at another ground
function clubPlaysElsewhereNext(stadium: Stadium, matches: LiveMatch[]) {
  const next = matches
    .filter(
      (match) =>
        match.status !== 'finished' &&
        (match.homeTeamId === stadium.espnTeamId || match.awayTeamId === stadium.espnTeamId)
    )
    .sort(byKickoff)[0]
  return next !== undefined && next.venueId !== stadium.espnVenueId
}

function toStadiumMatch(match: LiveMatch, now: number): StadiumMatch {
  const kickoff = new Date(match.kickoff)
  const time = kickoffFormat.format(kickoff)
  const day = dayLabel(kickoff, now)
  const upcoming = match.status === 'upcoming'

  return {
    day,
    kit: kitByTeam.get(match.homeTeamId),
    status: match.status,
    competition: match.competition,
    homeScore: upcoming ? undefined : match.homeScore,
    awayScore: upcoming ? undefined : match.awayScore,
    kickoffTime: upcoming ? time : undefined,
    minute: match.minute,
    home: match.homeTeam,
    rival: match.awayTeam,
    goals: match.goals,
    pin: upcoming
      ? `${match.homeAbbr}-${match.awayAbbr} ${day === 'hoy' ? time : day}`
      : `${match.homeAbbr} ${match.homeScore}-${match.awayScore} ${match.awayAbbr}`
  }
}

// Shown between the two scores: the running minute, the kickoff time, or "Final"
function clockLabel(match: StadiumMatch) {
  if (match.status === 'upcoming') return match.kickoffTime ?? ''
  if (match.status === 'finished') return 'Final'
  return match.minute
}

type ScorerLine = { player: string; minutes: string[] }

// One line per scorer, e.g. "L. Flores 83' 90'+2'"; penalties and own goals are flagged
function scorerLines(goals: Goal[], side: Goal['side']): ScorerLine[] {
  const lines = new Map<string, ScorerLine>()
  for (const goal of goals.filter((item) => item.side === side)) {
    const player = goal.ownGoal ? `${goal.player} (e/c)` : goal.player
    const line = lines.get(player) ?? { player, minutes: [] }
    line.minutes.push(goal.penalty ? `${goal.minute} (p)` : goal.minute)
    lines.set(player, line)
  }
  return [...lines.values()]
}

const filters: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'todos' },
  { key: 'en vivo', label: 'en vivo' },
  { key: 'próximos', label: 'próximos' },
  { key: 'finalizados', label: 'finalizados' }
]

const statusLabels: Record<StadiumStatus, string> = {
  live: 'en vivo',
  upcoming: 'próximo',
  finished: 'finalizado',
  idle: 'sin partido'
}

// "próximo · mañana", "finalizado · ayer"; today needs no day
function statusLabel(match: StadiumMatch) {
  const label = statusLabels[match.status]
  return match.day && match.day !== 'hoy' && match.status !== 'live' ? `${label} · ${match.day}` : label
}

// Layers that add clutter around the stadiums: POIs, transit stops, minor street names, shields
const hiddenLayers = [
  'road_one_way_arrow',
  'road_one_way_arrow_opposite',
  'poi_r20',
  'poi_r7',
  'poi_r1',
  'poi_transit',
  'highway-name-path',
  'highway-name-minor',
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
  'airport'
]

const BUILDING_MAX_HEIGHT = 9

function simplifyMap(map: maplibregl.Map) {
  hiddenLayers.forEach((layerId) => {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none')
  })
}

function addStadiumStands(map: maplibregl.Map) {
  if (map.getSource('stadium-stands')) return
  const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id

  map.addSource('stadium-stands', { type: 'geojson', data: stadiumStands })
  map.addLayer(
    {
      id: 'stadium-stands',
      type: 'fill-extrusion',
      source: 'stadium-stands',
      minzoom: 11,
      paint: {
        'fill-extrusion-color': '#f4fbff',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.95,
        'fill-extrusion-vertical-gradient': true
      }
    },
    firstSymbolLayer
  )
}

function stadiumBounds() {
  const bounds = new maplibregl.LngLatBounds()
  stadiums.forEach((stadium) => bounds.extend(stadium.position))
  return bounds
}

const isCompactScreen = () => window.matchMedia('(max-width: 780px)').matches

function applyLpfMapPalette(map: maplibregl.Map) {
  const setPaint = (layerId: string, property: string, value: string | number | boolean) => {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, property as never, value as never)
    }
  }

  setPaint('background', 'background-color', '#dceefa')
  setPaint('water', 'fill-color', '#76c9eb')
  setPaint('park', 'fill-color', '#b6dfd1')
  setPaint('park', 'fill-opacity', 0.88)
  setPaint('park_outline', 'line-color', '#7fc5b5')
  setPaint('landuse_residential', 'fill-color', '#d2e7f3')
  setPaint('landcover_wood', 'fill-color', '#8acbb8')
  setPaint('landcover_grass', 'fill-color', '#c2e5d8')
  setPaint('landcover_sand', 'fill-color', '#e5edf0')
  setPaint('landuse_pitch', 'fill-color', '#a9d9d0')
  setPaint('landuse_track', 'fill-color', '#a9d9d0')
  setPaint('landuse_cemetery', 'fill-color', '#b9ddcf')
  setPaint('landuse_hospital', 'fill-color', '#d2e5ef')
  setPaint('landuse_school', 'fill-color', '#d2e5ef')
  setPaint('waterway_river', 'line-color', '#56b9e3')
  setPaint('waterway_other', 'line-color', '#78c6e5')
  setPaint('building', 'fill-color', '#a9cfe3')
  setPaint('building', 'fill-outline-color', '#82b6d3')
  setPaint('building-3d', 'fill-extrusion-color', '#49a8dd')
  setPaint('building-3d', 'fill-extrusion-opacity', 1)
  setPaint('building-3d', 'fill-extrusion-vertical-gradient', true)
  setPaint('highway-name-major', 'text-color', '#285c7e')
  setPaint('highway-name-major', 'text-halo-color', '#eaf6fc')
  setPaint('highway-name-minor', 'text-color', '#52748c')
  setPaint('highway-name-minor', 'text-halo-color', '#eaf6fc')
  setPaint('water_name_point_label', 'text-color', '#367fa5')
  setPaint('water_name_point_label', 'text-halo-color', '#dff3fb')
  setPaint('water_name_line_label', 'text-color', '#367fa5')
  setPaint('water_name_line_label', 'text-halo-color', '#dff3fb')

  map.getStyle().layers.forEach((layer) => {
    if (layer.type !== 'line' || !/^(road|bridge|tunnel)_/.test(layer.id)) return

    const color = layer.id.includes('motorway')
      ? '#398bbc'
      : layer.id.includes('trunk_primary') || layer.id.includes('trunk')
        ? '#58aedd'
        : layer.id.includes('secondary_tertiary')
          ? '#80c2e6'
          : layer.id.includes('minor')
            ? '#f8fcff'
            : layer.id.includes('service_track')
              ? '#c2dfef'
              : layer.id.includes('path_pedestrian')
                ? '#91c8e3'
                : layer.id.includes('casing')
                  ? '#78abc6'
                  : '#a6cfe3'

    setPaint(layer.id, 'line-color', color)
  })

  setPaint('road_area_pattern', 'fill-color', '#a9d2e6')
}

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRefs = useRef<Map<string, maplibregl.Marker>>(new Map())
  const [activeFilter, setActiveFilter] = useState<Filter>('todos')
  const [selectedId, setSelectedId] = useState('bombonera')
  const [detailOpen, setDetailOpen] = useState(() => !isCompactScreen())
  const [markersReady, setMarkersReady] = useState(false)
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [matchesError, setMatchesError] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true)
    try {
      const response = await fetch('/api/matches')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as MatchesResponse
      setLiveMatches(data.matches)
      setFetchedAt(Date.now())
      setMatchesError(false)
    } catch (error) {
      console.error(error)
      setMatchesError(true)
    } finally {
      setLoadingMatches(false)
    }
  }, [])

  useEffect(() => {
    void loadMatches()
    const timer = window.setInterval(() => void loadMatches(), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [loadMatches])

  const stadiumViews = useMemo<StadiumView[]>(
    () =>
      stadiums.map((stadium) => {
        const match = pickMatch(stadium, liveMatches, fetchedAt)
        if (match) return { ...stadium, hidden: false, match: toStadiumMatch(match, fetchedAt) }
        if (clubPlaysElsewhereNext(stadium, liveMatches)) {
          return { ...stadium, hidden: true, match: noMatch }
        }
        return { ...stadium, hidden: false, match: stadium.placeholder ?? noMatch }
      }),
    [liveMatches, fetchedAt]
  )

  const liveCount = stadiumViews.filter((stadium) => stadium.match.status === 'live').length

  const visibleStadiums = useMemo(() => {
    const shown = stadiumViews.filter((stadium) => !stadium.hidden)
    if (activeFilter === 'todos') return shown
    const status: StadiumStatus =
      activeFilter === 'en vivo' ? 'live' : activeFilter === 'próximos' ? 'upcoming' : 'finished'
    return shown.filter((stadium) => stadium.match.status === status)
  }, [activeFilter, stadiumViews])

  useEffect(() => {
    if (!visibleStadiums.some((stadium) => stadium.id === selectedId)) {
      const fallbackId = visibleStadiums[0]?.id ?? stadiums[0].id
      setSelectedId(fallbackId)
      setDetailOpen(true)
    }
  }, [selectedId, visibleStadiums])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    maplibregl.setWorkerUrl(mapLibreWorkerUrl)

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      bounds: stadiumBounds(),
      fitBoundsOptions: {
        padding: isCompactScreen()
          ? { top: 190, bottom: 40, left: 24, right: 24 }
          : { top: 170, bottom: 70, left: 70, right: 430 }
      },
      maxPitch: 70,
      attributionControl: false
    })
    // Tilt after framing so every stadium stays in view
    map.jumpTo({ pitch: 45, bearing: -12 })

    mapRef.current = map

    // Collapsed into an (i) button next to the legend, clear of the detail card
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true
      }),
      'top-right'
    )

    // The compact attribution starts expanded until the first interaction; start it collapsed
    map.once('idle', () => {
      map
        .getContainer()
        .querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show')
    })

    map.on('style.load', () => {
      applyLpfMapPalette(map)
      simplifyMap(map)
      addStadiumStands(map)

      if (map.getLayer('building-3d')) {
        map.setLayerZoomRange('building-3d', 12, 24)
        // Keep regular buildings low so the stadium stands rise above them
        map.setPaintProperty('building-3d', 'fill-extrusion-base', [
          'min',
          ['coalesce', ['get', 'render_min_height'], 0],
          BUILDING_MAX_HEIGHT
        ])
        map.setPaintProperty('building-3d', 'fill-extrusion-height', [
          'min',
          ['coalesce', ['get', 'render_height'], 5],
          BUILDING_MAX_HEIGHT
        ])
      }

      stadiums.forEach((stadium) => {
        const markerElement = document.createElement('button')
        markerElement.type = 'button'
        markerElement.className = 'map-marker idle'
        markerElement.setAttribute('aria-label', stadium.name)
        markerElement.title = `${stadium.club} · ${stadium.name}`
        markerElement.innerHTML = '<span class="marker-pin"></span><span class="marker-dot"></span>'
        markerElement.addEventListener('click', () => {
          setSelectedId(stadium.id)
          setDetailOpen(true)
          map.flyTo({
            center: stadium.position,
            zoom: 15.5,
            pitch: 60,
            bearing: -12,
            speed: 0.8,
            curve: 1.35
          })
        })

        const marker = new maplibregl.Marker({
          element: markerElement,
          // The dot sits in a 30px slot at the bottom of the element; shift by half of it to centre it on the stadium
          anchor: 'bottom',
          offset: [0, 15]
        })
          .setLngLat(stadium.position)
          .addTo(map)

        markerRefs.current.set(stadium.id, marker)
      })

      setMarkersReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRefs.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!markersReady) return
    const visibleIds = new Set(visibleStadiums.map((stadium) => stadium.id))

    stadiumViews.forEach((stadium) => {
      const markerElement = markerRefs.current.get(stadium.id)?.getElement()
      if (!markerElement) return

      // classList, not className: MapLibre adds its own positioning classes to the element
      markerElement.classList.remove('live', 'upcoming', 'finished', 'idle')
      markerElement.classList.add(stadium.match.status)
      markerElement.style.display = visibleIds.has(stadium.id) ? 'flex' : 'none'
      markerElement.classList.toggle('selected', stadium.id === selectedId)

      const dot = markerElement.querySelector<HTMLElement>('.marker-dot')
      if (dot) dot.style.background = stadium.match.kit ?? stadium.kit

      const pin = markerElement.querySelector<HTMLElement>('.marker-pin')
      if (pin) {
        pin.textContent = stadium.match.pin ?? ''
        pin.hidden = !stadium.match.pin
      }
    })
  }, [markersReady, stadiumViews, visibleStadiums, selectedId])

  const selectedStadium =
    visibleStadiums.find((stadium) => stadium.id === selectedId) ?? visibleStadiums[0] ?? stadiumViews[0]
  const selectedMatch = selectedStadium.match

  return (
    <div className="app-shell">
      <header className="hud">
        <div className="hud-main">
          <div className="brand-block">
            <div className="brand-copy">
              <span className="eyebrow">Mapa de partidos</span>
              <h1>FulboMap</h1>
            </div>
          </div>

          <div className="filter-bar">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={filter.key === activeFilter ? 'filter active' : 'filter'}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar">
          <div className="summary-pill">
            <span className="dot live" />
            {matchesError ? 'sin conexión' : `${liveCount} en vivo`}
          </div>
          <button
            type="button"
            className="ghost-button"
            disabled={loadingMatches}
            onClick={() => void loadMatches()}
          >
            {loadingMatches ? 'actualizando…' : 'actualizar'}
          </button>
        </div>
      </header>

      <main className="map-stage">
        <div className="map-surface">
          <div ref={mapContainerRef} className="map-canvas" />

          {detailOpen && (
            <div className="info-card">
              <div className="card-topline">
                <span className={`status-tag ${selectedMatch.status}`}>
                  {statusLabel(selectedMatch)}
                </span>
                <button
                  type="button"
                  className="close-button"
                  aria-label="Cerrar detalle"
                  onClick={() => setDetailOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="card-header">
                <div>
                  <p className="card-league">
                    {selectedMatch.status === 'idle' ? selectedStadium.club : selectedMatch.competition}
                  </p>
                  <h2>{selectedStadium.name}</h2>
                  <p className="card-place">{selectedStadium.neighborhood}</p>
                </div>
              </div>

              {selectedMatch.status === 'idle' ? (
                <p className="description">{selectedMatch.description}</p>
              ) : (
                <>
                  {/* Home | goals | clock | goals | away */}
                  <div className="score-box">
                    <strong className="score-team home">
                      {selectedMatch.home ?? selectedStadium.club}
                    </strong>
                    <strong className="score-value">{selectedMatch.homeScore}</strong>
                    <span className={`score-clock ${selectedMatch.status}`}>
                      {clockLabel(selectedMatch)}
                    </span>
                    <strong className="score-value">{selectedMatch.awayScore}</strong>
                    <strong className="score-team away">{selectedMatch.rival}</strong>
                  </div>

                  {selectedMatch.status !== 'upcoming' &&
                    (selectedMatch.goals.length > 0 ? (
                      <div className="goals">
                        {(['home', 'away'] as const).map((side) => (
                          <ul key={side} className={`goal-list ${side}`}>
                            {scorerLines(selectedMatch.goals, side).map((line) => (
                              <li key={line.player}>
                                <span className="goal-player">{line.player}</span>
                                <span className="goal-minutes">{line.minutes.join(' ')}</span>
                              </li>
                            ))}
                          </ul>
                        ))}
                      </div>
                    ) : (
                      <p className="goals-empty">
                        {selectedMatch.status === 'live' ? 'Sin goles todavía' : 'Sin goles'}
                      </p>
                    ))}
                </>
              )}
            </div>
          )}

          <div className="map-legend">
            <span><i className="legend-live" /> en vivo</span>
            <span><i className="legend-upcoming" /> próximo</span>
            <span><i className="legend-finished" /> finalizado</span>
            <span><i className="legend-idle" /> sin partido</span>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
