import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import type { LiveMatch, MatchesResponse } from '../api/matches.ts'

type StadiumStatus = 'live' | 'upcoming' | 'finished' | 'idle'
type Filter = 'todos' | 'en vivo' | 'próximos' | 'finalizados'

type StadiumMatch = {
  status: StadiumStatus
  competition: string
  kickoff: string
  score: string
  minute: string
  rival: string
  description: string
}

type Stadium = {
  id: string
  name: string
  neighborhood: string
  club: string
  position: [number, number]
  espnTeamId: string
  // Shown when the club has no real match today
  placeholder?: StadiumMatch
}

type StadiumView = Stadium & { match: StadiumMatch }

const stadiums: Stadium[] = [
  {
    id: 'bombonera',
    name: 'La Bombonera',
    neighborhood: 'La Boca',
    club: 'Boca Juniors',
    position: [-58.3649163, -34.6355171],
    espnTeamId: '5',
    placeholder: {
      status: 'live',
      competition: 'Partido de ejemplo',
      kickoff: 'Hoy 20:30',
      score: '2 - 1',
      minute: '67’',
      rival: 'Rival',
      description: 'Resultado de ejemplo: Boca no juega de local hoy.'
    }
  },
  {
    id: 'monumental',
    name: 'El Monumental',
    neighborhood: 'Belgrano',
    club: 'River Plate',
    position: [-58.4497385, -34.5452932],
    espnTeamId: '16'
  },
  {
    id: 'gasometro',
    name: 'Estadio de San Lorenzo',
    neighborhood: 'Flores',
    club: 'San Lorenzo',
    position: [-58.4401364, -34.6520908],
    espnTeamId: '18'
  },
  {
    id: 'amalfitani',
    name: 'Amalfitani',
    neighborhood: 'Liniers',
    club: 'Vélez Sarsfield',
    position: [-58.5206788, -34.6353382],
    espnTeamId: '21'
  },
  {
    id: 'duco',
    name: 'Estadio Ducó',
    neighborhood: 'Parque Patricios',
    club: 'Huracán',
    position: [-58.3965055, -34.6434694],
    espnTeamId: '10'
  },
  {
    id: 'maradona',
    name: 'Estadio Diego Armando Maradona',
    neighborhood: 'La Paternal',
    club: 'Argentinos Juniors',
    position: [-58.4726194, -34.6061215],
    espnTeamId: '3'
  }
]

const noMatch: StadiumMatch = {
  status: 'idle',
  competition: 'Liga Profesional',
  kickoff: 'Sin partido',
  score: 'Sin partido',
  minute: 'Libre',
  rival: '—',
  description: 'Estadio sin actividad de juego en este momento.'
}

const REFRESH_MS = 60_000

const kickoffFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

function toStadiumMatch(match: LiveMatch, stadium: Stadium): StadiumMatch {
  const score =
    match.status === 'upcoming' ? 'Por definir' : `${match.homeScore} - ${match.awayScore}`
  const description =
    match.status === 'live'
      ? `${match.homeTeam} recibe a ${match.awayTeam} en ${stadium.name}.`
      : match.status === 'finished'
        ? `Terminó ${match.homeTeam} ${score} ${match.awayTeam}.`
        : `${match.homeTeam} recibe a ${match.awayTeam} más tarde.`

  return {
    status: match.status,
    competition: match.competition,
    kickoff: `Hoy ${kickoffFormat.format(new Date(match.kickoff))}`,
    score,
    minute: match.minute,
    rival: match.awayTeam,
    description
  }
}

const filters: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'todos' },
  { key: 'en vivo', label: 'en vivo' },
  { key: 'próximos', label: 'próximos hoy' },
  { key: 'finalizados', label: 'finalizados hoy' }
]

const statusLabels: Record<StadiumStatus, string> = {
  live: 'en vivo',
  upcoming: 'próximo',
  finished: 'finalizado',
  idle: 'sin partido'
}

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
  const [detailOpen, setDetailOpen] = useState(true)
  const [markersReady, setMarkersReady] = useState(false)
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [matchesError, setMatchesError] = useState(false)

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true)
    try {
      const response = await fetch('/api/matches')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as MatchesResponse
      setLiveMatches(data.matches)
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
        const match = liveMatches.find((liveMatch) => liveMatch.homeTeamId === stadium.espnTeamId)
        return {
          ...stadium,
          match: match ? toStadiumMatch(match, stadium) : (stadium.placeholder ?? noMatch)
        }
      }),
    [liveMatches]
  )

  const liveCount = stadiumViews.filter((stadium) => stadium.match.status === 'live').length

  const visibleStadiums = useMemo(() => {
    if (activeFilter === 'todos') return stadiumViews
    const status: StadiumStatus =
      activeFilter === 'en vivo' ? 'live' : activeFilter === 'próximos' ? 'upcoming' : 'finished'
    return stadiumViews.filter((stadium) => stadium.match.status === status)
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
      center: stadiums[0].position,
      zoom: 14.4,
      pitch: 58,
      bearing: -12,
      maxPitch: 70
    })

    mapRef.current = map

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true
      }),
      'top-right'
    )

    map.on('style.load', () => {
      applyLpfMapPalette(map)

      if (map.getLayer('building-3d')) {
        map.setLayerZoomRange('building-3d', 12, 24)
        map.setPaintProperty('building-3d', 'fill-extrusion-base', [
          'coalesce',
          ['get', 'render_min_height'],
          0
        ])
        map.setPaintProperty('building-3d', 'fill-extrusion-height', [
          '*',
          ['coalesce', ['get', 'render_height'], 5],
          5
        ])
      }

      stadiums.forEach((stadium) => {
        const markerElement = document.createElement('button')
        markerElement.type = 'button'
        markerElement.className = 'map-marker idle'
        markerElement.setAttribute('aria-label', stadium.name)
        markerElement.title = `${stadium.club} · ${stadium.name}`
        markerElement.innerHTML = '<span class="marker-dot" />'
        markerElement.addEventListener('click', () => {
          setSelectedId(stadium.id)
          setDetailOpen(true)
          map.flyTo({
            center: stadium.position,
            zoom: 15.5,
            pitch: 66,
            bearing: -12,
            speed: 0.8,
            curve: 1.35
          })
        })

        const marker = new maplibregl.Marker({
          element: markerElement,
          anchor: 'center'
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
    })
  }, [markersReady, stadiumViews, visibleStadiums, selectedId])

  const selectedStadium =
    visibleStadiums.find((stadium) => stadium.id === selectedId) ?? visibleStadiums[0] ?? stadiumViews[0]
  const selectedMatch = selectedStadium.match

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand-block">
          <div className="brand-mark">LPF</div>
          <div className="brand-copy">
            <span className="eyebrow">Mapa de partidos</span>
            <h1>FulboMap CABA</h1>
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

      <main className="map-stage">
        <div className="map-surface">
          <div ref={mapContainerRef} className="map-canvas" />

          {detailOpen && (
            <div className="info-card">
              <div className="card-topline">
                <span className={`status-tag ${selectedMatch.status}`}>
                  {statusLabels[selectedMatch.status]}
                </span>
                <span className="minute-chip">{selectedMatch.minute}</span>
              </div>

              <div className="card-header">
                <div>
                  <p className="card-league">{selectedMatch.competition}</p>
                  <h2>{selectedStadium.name}</h2>
                </div>
                <button
                  type="button"
                  className="close-button"
                  aria-label="Cerrar detalle"
                  onClick={() => setDetailOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="score-box">
                <div>
                  <span>Local</span>
                  <strong>{selectedStadium.club}</strong>
                </div>
                <strong className="score-value">{selectedMatch.score}</strong>
                <div>
                  <span>Rival</span>
                  <strong>{selectedMatch.rival}</strong>
                </div>
              </div>

              <div className="info-grid">
                <div>
                  <label>Horario</label>
                  <strong>{selectedMatch.kickoff}</strong>
                </div>
                <div>
                  <label>Barrio</label>
                  <strong>{selectedStadium.neighborhood}</strong>
                </div>
              </div>

              <p className="description">{selectedMatch.description}</p>
            </div>
          )}

          <div className="map-legend">
            <span><i className="legend-live" /> en vivo</span>
            <span><i className="legend-upcoming" /> próximo</span>
            <span><i className="legend-finished" /> finalizado</span>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
