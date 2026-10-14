import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

type StadiumStatus = 'live' | 'upcoming' | 'finished' | 'idle'
type Filter = 'todos' | 'en vivo' | 'próximos' | 'finalizados'

type Stadium = {
  id: string
  name: string
  neighborhood: string
  club: string
  position: [number, number]
  status: StadiumStatus
  competition: string
  kickoff: string
  score: string
  minute: string
  description: string
}

const stadiums: Stadium[] = [
  {
    id: 'bombonera',
    name: 'La Bombonera',
    neighborhood: 'La Boca',
    club: 'Boca Juniors',
    position: [-58.3649, -34.6355],
    status: 'live',
    competition: 'Liga Profesional',
    kickoff: 'Hoy 20:30',
    score: '2 - 1',
    minute: '67’',
    description: 'Boca lidera en un clásico intenso en el sur del mapa.'
  },
  {
    id: 'monumental',
    name: 'El Monumental',
    neighborhood: 'Belgrano',
    club: 'River Plate',
    position: [-58.4496, -34.5453],
    status: 'upcoming',
    competition: 'Liga Profesional',
    kickoff: 'Hoy 21:00',
    score: 'Por definir',
    minute: 'Próximo',
    description: 'River juega de local ante un rival directo.'
  },
  {
    id: 'gasometro',
    name: 'Estadio de San Lorenzo',
    neighborhood: 'Boedo',
    club: 'San Lorenzo',
    position: [-58.4633, -34.6695],
    status: 'finished',
    competition: 'Primera Nacional',
    kickoff: 'Hoy 18:00',
    score: '1 - 0',
    minute: 'FT',
    description: 'Cierre con triunfo para el Ciclón en casa.'
  },
  {
    id: 'amalfitani',
    name: 'Amalfitani',
    neighborhood: 'Villa Luro',
    club: 'Vélez Sarsfield',
    position: [-58.5189, -34.6357],
    status: 'idle',
    competition: 'Liga Profesional',
    kickoff: 'Sin partido',
    score: 'Sin partido',
    minute: 'Libre',
    description: 'Estadio sin actividad de juego en este momento.'
  },
  {
    id: 'duco',
    name: 'Estadio Ducó',
    neighborhood: 'Caballito',
    club: 'Huracán',
    position: [-58.4671, -34.641],
    status: 'upcoming',
    competition: 'Regional Amateur',
    kickoff: 'Hoy 19:00',
    score: 'Por definir',
    minute: 'Próximo',
    description: 'Huracán recibe a un rival del interior en un duelo clave.'
  },
  {
    id: 'maradona',
    name: 'Estadio Diego Armando Maradona',
    neighborhood: 'Villa Crespo',
    club: 'Argentinos Juniors',
    position: [-58.434, -34.603],
    status: 'live',
    competition: 'Primera División',
    kickoff: 'Hoy 20:00',
    score: '1 - 1',
    minute: '78’',
    description: 'Partido parejo con intensidad alta y chances claras.'
  }
]

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

  const visibleStadiums = useMemo(() => {
    if (activeFilter === 'todos') return stadiums
    if (activeFilter === 'en vivo') return stadiums.filter((stadium) => stadium.status === 'live')
    if (activeFilter === 'próximos') return stadiums.filter((stadium) => stadium.status === 'upcoming')
    return stadiums.filter((stadium) => stadium.status === 'finished')
  }, [activeFilter])

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
        markerElement.className = `map-marker ${stadium.status}`
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
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRefs.current.clear()
    }
  }, [])

  useEffect(() => {
    const visibleIds = new Set(visibleStadiums.map((stadium) => stadium.id))

    markerRefs.current.forEach((marker, stadiumId) => {
      const markerElement = marker.getElement()
      const isVisible = visibleIds.has(stadiumId)
      const isSelected = stadiumId === selectedId

      markerElement.style.display = isVisible ? 'flex' : 'none'
      markerElement.classList.toggle('selected', isSelected)
    })
  }, [visibleStadiums, selectedId])

  const selectedStadium =
    visibleStadiums.find((stadium) => stadium.id === selectedId) ?? visibleStadiums[0] ?? stadiums[0]

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
            2 en vivo
          </div>
          <button type="button" className="ghost-button">
            actualizar
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
                <span className={`status-tag ${selectedStadium.status}`}>
                  {statusLabels[selectedStadium.status]}
                </span>
                <span className="minute-chip">{selectedStadium.minute}</span>
              </div>

              <div className="card-header">
                <div>
                  <p className="card-league">{selectedStadium.competition}</p>
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
                <strong className="score-value">{selectedStadium.score}</strong>
                <div>
                  <span>Rival</span>
                  <strong>FC rival</strong>
                </div>
              </div>

              <div className="info-grid">
                <div>
                  <label>Horario</label>
                  <strong>{selectedStadium.kickoff}</strong>
                </div>
                <div>
                  <label>Barrio</label>
                  <strong>{selectedStadium.neighborhood}</strong>
                </div>
              </div>

              <p className="description">{selectedStadium.description}</p>
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
