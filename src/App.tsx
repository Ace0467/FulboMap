import { useMemo, useState } from 'react'
import './App.css'

type StadiumStatus = 'live' | 'upcoming' | 'finished' | 'idle'
type Filter = 'todos' | 'en vivo' | 'próximos' | 'finalizados'

type Stadium = {
  id: string
  name: string
  neighborhood: string
  club: string
  x: number
  y: number
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
    x: 48,
    y: 60,
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
    x: 69,
    y: 31,
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
    x: 58,
    y: 71,
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
    x: 39,
    y: 45,
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
    x: 53,
    y: 49,
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
    x: 43,
    y: 38,
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

function App() {
  const [activeFilter, setActiveFilter] = useState<Filter>('todos')
  const [selectedId, setSelectedId] = useState('bombonera')

  const visibleStadiums = useMemo(() => {
    if (activeFilter === 'todos') return stadiums
    if (activeFilter === 'en vivo') return stadiums.filter((stadium) => stadium.status === 'live')
    if (activeFilter === 'próximos') return stadiums.filter((stadium) => stadium.status === 'upcoming')
    return stadiums.filter((stadium) => stadium.status === 'finished')
  }, [activeFilter])

  const selectedStadium =
    visibleStadiums.find((stadium) => stadium.id === selectedId) ?? visibleStadiums[0] ?? stadiums[0]

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">LPF</div>
          <div>
            <p className="eyebrow">Mapa de partidos</p>
            <h1>FulboMap CABA</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="summary-pill">
            <span className="dot live" />
            2 en vivo
          </div>
          <button type="button" className="ghost-button">
            actualizar
          </button>
        </div>
      </header>

      <main className="dashboard">
        <aside className="sidebar">
          <div className="panel-header">
            <span>estadios</span>
            <span>{visibleStadiums.length}</span>
          </div>

          <div className="filter-row">
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

          <div className="stadium-list">
            {visibleStadiums.map((stadium) => (
              <button
                key={stadium.id}
                type="button"
                className={selectedStadium.id === stadium.id ? 'stadium-item selected' : 'stadium-item'}
                onClick={() => setSelectedId(stadium.id)}
              >
                <div className="stadium-meta">
                  <span className={`pulse pulse-${stadium.status}`} />
                  <strong>{stadium.club}</strong>
                </div>
                <span>{stadium.name}</span>
                <small>{stadium.score}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="map-panel">
          <div className="map-surface">
            <div className="district district-a" />
            <div className="district district-b" />
            <div className="district district-c" />
            <div className="district district-d" />

            {stadiums.map((stadium) => {
              const markerClasses = ['stadium-marker', `is-${stadium.status}`]

              if (selectedStadium.id === stadium.id) {
                markerClasses.push('selected')
              }

              return (
                <button
                  key={stadium.id}
                  type="button"
                  className={markerClasses.join(' ')}
                  style={{ left: `${stadium.x}%`, top: `${stadium.y}%` }}
                  onClick={() => setSelectedId(stadium.id)}
                  aria-label={stadium.name}
                >
                  <span className="marker-core" />
                </button>
              )
            })}

            <div className="map-legend">
              <span><i className="legend-live" /> en vivo</span>
              <span><i className="legend-upcoming" /> próximo</span>
              <span><i className="legend-finished" /> finalizado</span>
            </div>
          </div>
        </section>

        <aside className="detail-panel">
          <div className="detail-header">
            <span className={`status-tag ${selectedStadium.status}`}>
              {statusLabels[selectedStadium.status]}
            </span>
            <span className="minute-chip">{selectedStadium.minute}</span>
          </div>

          <h2>{selectedStadium.name}</h2>
          <p className="club-name">{selectedStadium.club}</p>
          <p className="competition">{selectedStadium.competition}</p>

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

          <div className="detail-grid">
            <div>
              <label>Estado</label>
              <strong>{statusLabels[selectedStadium.status]}</strong>
            </div>
            <div>
              <label>Horario</label>
              <strong>{selectedStadium.kickoff}</strong>
            </div>
            <div>
              <label>Barrio</label>
              <strong>{selectedStadium.neighborhood}</strong>
            </div>
            <div>
              <label>Competencia</label>
              <strong>{selectedStadium.competition}</strong>
            </div>
          </div>

          <p className="description">{selectedStadium.description}</p>
        </aside>
      </main>
    </div>
  )
}

export default App
