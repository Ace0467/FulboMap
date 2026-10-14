import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
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
    neighborhood: 'Villa Devoto',
    club: 'Boca Juniors',
    position: [-34.6355, -58.3649],
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
    position: [-34.5453, -58.4496],
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
    position: [-34.6695, -58.4633],
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
    position: [-34.6357, -58.5189],
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
    position: [-34.641, -58.4671],
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
    position: [-34.603, -58.434],
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

const markerColors: Record<StadiumStatus, string> = {
  live: '#58f0b5',
  upcoming: '#7cc7ff',
  finished: '#95a9bd',
  idle: '#3f6d94'
}

function App() {
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
          <MapContainer
            center={[-34.615, -58.43]}
            zoom={11}
            minZoom={10}
            maxZoom={15}
            scrollWheelZoom
            zoomControl
            attributionControl={false}
            className="leaflet-map"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {stadiums.map((stadium) => {
              const isVisible = visibleStadiums.some((item) => item.id === stadium.id)
              if (!isVisible) return null

              const isSelected = stadium.id === selectedStadium.id

              return (
                <CircleMarker
                  key={stadium.id}
                  center={stadium.position}
                  radius={isSelected ? 10 : 7}
                  pathOptions={{
                    color: markerColors[stadium.status],
                    fillColor: markerColors[stadium.status],
                    fillOpacity: 1,
                    weight: isSelected ? 3 : 2
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedId(stadium.id)
                      setDetailOpen(true)
                    }
                  }}
                />
              )
            })}
          </MapContainer>

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
