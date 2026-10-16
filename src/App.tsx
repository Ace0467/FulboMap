import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
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
  // ESPN event id; absent for the placeholder and "no match"
  id?: string
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
  // Set when the club plays at another ground (e.g. away at Banfield)
  elsewhere?: string
  minute: string
  // Defaults to the stadium's club; differs for cup matches at a neutral venue
  home?: string
  rival: string
  goals: Goal[]
  // Only shown when the stadium has no match
  description?: string
  // Channels for upcoming and live matches, when known
  tv?: string
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

type StadiumView = Stadium & { match: StadiumMatch }

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
    // Green inner outline, a green line at 3/4 of the height (from the bottom) and the crest's chevron
    kit: 'radial-gradient(circle closest-side, transparent 72%, #1a8a3a 75%), linear-gradient(180deg, transparent 0 31%, #1a8a3a 31% 40%, transparent 40%), conic-gradient(from 140deg at 50% 50%, #1a8a3a 0 80deg, #ffffff 80deg)'
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
  },
  // Conurbano and La Plata
  {
    id: 'lanus',
    name: 'La Fortaleza',
    neighborhood: 'Lanús',
    club: 'Lanús',
    position: [-58.3838, -34.7176],
    espnVenueId: '10792',
    espnTeamId: '12',
    kit: '#7a1f3d'
  },
  {
    id: 'zerillo',
    name: 'El Bosque',
    neighborhood: 'La Plata',
    club: 'Gimnasia La Plata',
    position: [-57.9324153, -34.9109655],
    espnVenueId: '1731',
    espnTeamId: '9',
    kit: 'linear-gradient(180deg, #ffffff 0 36%, #1b2f6b 36% 64%, #ffffff 64%)'
  },
  {
    id: 'hirschi',
    name: 'Estadio UNO',
    neighborhood: 'La Plata',
    club: 'Estudiantes de La Plata',
    position: [-57.9388416, -34.9119093],
    espnVenueId: '8296',
    espnTeamId: '8',
    kit: 'linear-gradient(90deg, #d6111e 0% 20%, #ffffff 20% 40%, #d6111e 40% 60%, #ffffff 60% 80%, #d6111e 80% 100%)'
  },
  {
    id: 'sola',
    name: 'Florencio Sola',
    neighborhood: 'Banfield, Lomas de Zamora',
    club: 'Banfield',
    position: [-58.3876, -34.7508],
    espnVenueId: '10789',
    espnTeamId: '235',
    kit: 'linear-gradient(90deg, #138a3c 0% 20%, #ffffff 20% 40%, #138a3c 40% 60%, #ffffff 60% 80%, #138a3c 80% 100%)'
  },
  {
    id: 'tomaghello',
    name: 'Norberto Tomaghello',
    neighborhood: 'Gobernador Costa, Florencio Varela',
    club: 'Defensa y Justicia',
    position: [-58.2865, -34.8218],
    espnVenueId: '5554',
    espnTeamId: '8950',
    kit: 'linear-gradient(135deg, #1a8a3a 0 36%, #f5d300 36% 64%, #1a8a3a 64%)'
  },
  {
    id: 'dellagiovanna',
    name: 'José Dellagiovanna',
    neighborhood: 'Victoria, San Fernando',
    club: 'Tigre',
    position: [-58.5422664, -34.4493072],
    espnVenueId: '5354',
    espnTeamId: '7767',
    kit: 'linear-gradient(180deg, #1c3f94 0 36%, #d6111e 36% 64%, #1c3f94 64%)'
  },
  {
    id: 'vicente-lopez',
    name: 'Ciudad de Vicente López',
    neighborhood: 'Florida, Vicente López',
    club: 'Platense',
    position: [-58.4817, -34.5403],
    espnVenueId: '3250',
    espnTeamId: '7764',
    kit: 'linear-gradient(180deg, #ffffff 0 36%, #5a3a22 36% 64%, #ffffff 64%)'
  },
  {
    id: 'cilindro',
    name: 'El Cilindro',
    neighborhood: 'Avellaneda',
    club: 'Racing Club',
    position: [-58.3685, -34.6676],
    espnVenueId: '5349',
    espnTeamId: '15',
    kit: 'linear-gradient(90deg, #6cb4e4 0% 20%, #ffffff 20% 40%, #6cb4e4 40% 60%, #ffffff 60% 80%, #6cb4e4 80% 100%)'
  },
  {
    id: 'libertadores',
    name: 'Libertadores de América',
    neighborhood: 'Avellaneda',
    club: 'Independiente',
    position: [-58.371, -34.6702],
    espnVenueId: '5555',
    espnTeamId: '11',
    // Red with the crest's white sash, top-left to bottom-right
    kit: 'linear-gradient(45deg, #d6111e 0 40%, #ffffff 40% 60%, #d6111e 60%)'
  },
  {
    id: 'fragata',
    name: 'Fragata Presidente Sarmiento',
    neighborhood: 'Isidro Casanova, La Matanza',
    club: 'Almirante Brown',
    position: [-58.5869, -34.6951],
    espnVenueId: '10975',
    espnTeamId: '9740',
    kit: 'linear-gradient(90deg, #111111 0% 25%, #f5c400 25% 50%, #111111 50% 75%, #f5c400 75% 100%)'
  },
  {
    id: 'caseros',
    name: 'Ciudad de Caseros',
    neighborhood: 'Caseros, Tres de Febrero',
    club: 'Estudiantes (Buenos Aires)',
    position: [-58.5563, -34.6059],
    espnVenueId: '10566',
    espnTeamId: '17352',
    kit: 'linear-gradient(90deg, #ffffff 0% 20%, #111111 20% 40%, #ffffff 40% 60%, #111111 60% 80%, #ffffff 80% 100%)'
  },
  {
    id: 'beranger',
    name: 'Alfredo Beranger',
    neighborhood: 'Temperley, Lomas de Zamora',
    club: 'Temperley',
    position: [-58.4, -34.7824],
    espnVenueId: '10978',
    espnTeamId: '10162',
    kit: 'linear-gradient(135deg, #ffffff 0 36%, #7cc5ee 36% 64%, #ffffff 64%)'
  },
  {
    id: 'libertarios',
    name: 'Libertarios Unidos',
    neighborhood: 'Florida Oeste, Vicente López',
    club: 'Colegiales',
    position: [-58.5255, -34.5381],
    espnVenueId: '10972',
    espnTeamId: '10149',
    kit: 'linear-gradient(135deg, #1b2f6b 0 30%, #f5c400 30% 38%, #d6111e 38% 62%, #f5c400 62% 70%, #1b2f6b 70%)'
  },
  {
    id: 'tres-de-febrero',
    name: 'Tres de Febrero',
    neighborhood: 'Villa Raffo, Tres de Febrero',
    club: 'Almagro',
    position: [-58.5349, -34.6141],
    espnVenueId: '10976',
    espnTeamId: '2',
    kit: 'linear-gradient(90deg, #1b2f6b 0 20%, #ffffff 20% 40%, #111111 40% 60%, #ffffff 60% 80%, #1b2f6b 80%)'
  },
  {
    id: 'centenario',
    name: 'Centenario',
    neighborhood: 'Quilmes',
    club: 'Quilmes',
    position: [-58.252, -34.7418],
    espnVenueId: '5351',
    espnTeamId: '2741',
    kit: 'linear-gradient(135deg, #ffffff 0 38%, #13214d 38% 62%, #ffffff 62%)'
  },
  {
    id: 'midland',
    name: 'Ferrocarril Midland',
    neighborhood: 'Libertad, Merlo',
    club: 'Midland',
    position: [-58.6871427, -34.6895719],
    espnVenueId: '6112',
    espnTeamId: '10109',
    kit: 'linear-gradient(155deg, #ffffff 0 41%, #1d4fa0 41% 59%, #ffffff 59%)'
  },
  {
    id: 'la-quema',
    name: 'La Quema',
    neighborhood: 'Boulogne, San Isidro',
    club: 'Acassuso',
    position: [-58.5837, -34.4818],
    espnVenueId: '10696',
    espnTeamId: '10145',
    // A white Y inside a ring on blue (the upside-down peace sign without its top stroke)
    kit: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%231b2f6b'/%3E%3Cg fill='none' stroke='%23fff' stroke-width='1.8' stroke-linecap='round'%3E%3Ccircle cx='10' cy='10' r='7.2'/%3E%3Cpath d='M10 10v7.2M10 10l-5.1-5.1M10 10l5.1-5.1'/%3E%3C/g%3E%3C/svg%3E\") center / cover no-repeat"
  },
  {
    id: 'urbano',
    name: 'Nuevo Francisco Urbano',
    neighborhood: 'Morón',
    club: 'Deportivo Morón',
    position: [-58.6318, -34.662],
    espnVenueId: '10568',
    espnTeamId: '10154',
    kit: 'linear-gradient(180deg, #ffffff 0 36%, #d6111e 36% 64%, #ffffff 64%)'
  },
  {
    id: 'malvinas',
    name: 'Malvinas Argentinas',
    neighborhood: 'Los Polvorines, Malvinas Argentinas',
    club: 'San Miguel',
    position: [-58.7064, -34.5135],
    espnVenueId: '6100',
    espnTeamId: '10058',
    kit: 'linear-gradient(90deg, #138a3c 0% 20%, #ffffff 20% 40%, #138a3c 40% 60%, #ffffff 60% 80%, #138a3c 80% 100%)'
  },
  {
    id: '20-de-octubre',
    name: '20 de Octubre',
    neighborhood: 'Tristán Suárez, Ezeiza',
    club: 'Tristán Suárez',
    position: [-58.5633, -34.8907],
    espnVenueId: '10567',
    espnTeamId: '10163',
    kit: 'linear-gradient(90deg, #1b2f6b 0% 20%, #ffffff 20% 40%, #1b2f6b 40% 60%, #ffffff 60% 80%, #1b2f6b 80% 100%)'
  },
  {
    id: 'chacarita',
    name: 'Chacarita Juniors',
    neighborhood: 'Villa Maipú, San Martín',
    club: 'Chacarita Juniors',
    position: [-58.5280731, -34.5673051],
    espnVenueId: '10974',
    espnTeamId: '6',
    kit: 'linear-gradient(90deg, #d6111e 0% 20%, #111111 20% 40%, #ffffff 40% 60%, #111111 60% 80%, #d6111e 80% 100%)'
  },
  {
    id: 'baletto',
    name: 'Osvaldo Baletto',
    neighborhood: 'Isla Maciel, Avellaneda',
    club: 'San Telmo',
    position: [-58.3529, -34.6439],
    espnVenueId: '6109',
    espnTeamId: '10157',
    kit: 'linear-gradient(90deg, #1b2f6b 0% 20%, #6cb4e4 20% 40%, #1b2f6b 40% 60%, #6cb4e4 60% 80%, #1b2f6b 80% 100%)'
  },
  {
    id: 'gallardon',
    name: 'Eduardo Gallardón',
    neighborhood: 'Lomas de Zamora',
    club: 'Los Andes',
    position: [-58.42, -34.7552],
    espnVenueId: '3322',
    espnTeamId: '13',
    kit: 'linear-gradient(90deg, #d6111e 0% 14%, #ffffff 14% 29%, #d6111e 29% 43%, #ffffff 43% 57%, #d6111e 57% 71%, #ffffff 71% 86%, #d6111e 86% 100%)'
  },
  {
    id: 'grondona',
    name: 'El Viaducto',
    neighborhood: 'Sarandí, Avellaneda',
    club: 'Arsenal Sarandi',
    position: [-58.3406, -34.6784],
    espnVenueId: '5355',
    espnTeamId: '2635',
    kit: 'linear-gradient(135deg, #6cb4e4 0 36%, #d6111e 36% 64%, #6cb4e4 64%)'
  },
  {
    id: 'laferrere',
    name: 'Ciudad de Laferrere',
    neighborhood: 'Gregorio de Laferrere, La Matanza',
    club: 'Deportivo Laferrere',
    position: [-58.5925, -34.7526],
    espnVenueId: '6099',
    espnTeamId: '17695',
    kit: 'linear-gradient(90deg, #138a3c 0% 20%, #ffffff 20% 40%, #138a3c 40% 60%, #ffffff 60% 80%, #138a3c 80% 100%)'
  },
  {
    id: 'ituzaingo',
    name: 'Estadio de Ituzaingó',
    neighborhood: 'Ituzaingó',
    club: 'Ituzaingó',
    position: [-58.6637, -34.6658],
    espnVenueId: '6123',
    espnTeamId: '10105',
    kit: 'linear-gradient(135deg, #138a3c 0 42%, #ffffff 42% 58%, #138a3c 58%)'
  },
  {
    id: 'comelli',
    name: 'Pablo Comelli',
    neighborhood: 'Remedios de Escalada, Lanús',
    club: 'Talleres de Remedios',
    position: [-58.4040146, -34.7216382],
    espnVenueId: '6108',
    espnTeamId: '10161',
    kit: 'linear-gradient(90deg, #ffffff 0% 20%, #d6111e 20% 40%, #ffffff 40% 60%, #d6111e 60% 80%, #ffffff 80% 100%)'
  },
  {
    id: 'villa-lynch',
    name: 'Monumental de Villa Lynch',
    neighborhood: 'Villa Lynch, San Martín',
    club: 'UAI Urquiza',
    position: [-58.5254, -34.5959],
    espnVenueId: '3596',
    espnTeamId: '17705',
    kit: 'linear-gradient(180deg, #6b3e26 0 36%, #ffffff 36% 64%, #6b3e26 64%)'
  },
  {
    id: 'jose-manuel-moreno',
    name: 'José Manuel Moreno',
    neighborhood: 'Merlo',
    club: 'Deportivo Merlo',
    position: [-58.733, -34.6804],
    espnVenueId: '10990',
    espnTeamId: '17704',
    kit: 'linear-gradient(115deg, #ffffff 0 40%, #1b2f6b 40% 60%, #ffffff 60%)'
  },
  {
    id: 'hugo-moyano',
    name: 'Hugo Moyano',
    neighborhood: '9 de Abril, Esteban Echeverría',
    club: 'Camioneros',
    position: [-58.491, -34.7531],
    espnVenueId: '10238',
    espnTeamId: '18662',
    kit: 'radial-gradient(circle closest-side, transparent 72%, #ffffff 75%), #138a3c'
  },
  {
    id: 'inmigrantes',
    name: 'Estadio de los Inmigrantes',
    neighborhood: 'Dock Sud, Avellaneda',
    club: 'Dock Sud',
    position: [-58.3444, -34.6577],
    espnVenueId: '10989',
    espnTeamId: '10103',
    kit: 'linear-gradient(90deg, #1d4fa0 0% 20%, #f5c400 20% 40%, #1d4fa0 40% 60%, #f5c400 60% 80%, #1d4fa0 80% 100%)'
  },
  {
    id: 'juan-antonio-arias',
    name: 'Juan Antonio Arias',
    neighborhood: 'Villegas, La Matanza',
    club: 'Liniers',
    position: [-58.5516, -34.7034],
    espnVenueId: '11160',
    espnTeamId: '10107',
    kit: 'conic-gradient(#6cb4e4 0 25%, #ffffff 25% 50%, #6cb4e4 50% 75%, #ffffff 75%)'
  },
  {
    id: 'boga',
    name: 'Francisco Boga',
    neighborhood: 'Burzaco, Almirante Brown',
    club: 'San Martín (Burzaco)',
    position: [-58.4015308, -34.8199867],
    espnVenueId: '10988',
    espnTeamId: '17692',
    kit: 'linear-gradient(135deg, #1b2f6b 0 42%, #ffffff 42% 58%, #1b2f6b 58%)'
  },
  {
    id: 'arandilla',
    name: 'Lorenzo Arandilla',
    neighborhood: 'Adrogué, Almirante Brown',
    club: 'Brown de Adrogué',
    position: [-58.3798016, -34.8064121],
    espnVenueId: '10859',
    espnTeamId: '10147',
    // Red, black and sky-blue triangles hanging from the top, as on the crest
    kit: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23111'/%3E%3Cpath fill='%23e41b1b' d='M0 0h20L10 19z'/%3E%3Cpath fill='%23111' d='M3.5 0h13L10 13.5z'/%3E%3Cpath fill='%235bc8f5' d='M5 1h10L10 9.5z'/%3E%3C/svg%3E\") center / cover no-repeat"
  },
  {
    id: 'brieva',
    name: 'Juan Carlos Brieva',
    neighborhood: 'Merlo',
    club: 'Argentino de Merlo',
    position: [-58.731, -34.6461],
    espnVenueId: '10697',
    espnTeamId: '17700',
    kit: 'linear-gradient(90deg, #6cb4e4 0% 20%, #ffffff 20% 40%, #6cb4e4 40% 60%, #ffffff 60% 80%, #6cb4e4 80% 100%)'
  },
  {
    id: 'argentino-quilmes',
    name: 'Estadio de Argentino de Quilmes',
    neighborhood: 'Quilmes',
    club: 'Argentino de Quilmes',
    position: [-58.249, -34.7154],
    espnVenueId: '10987',
    espnTeamId: '17693',
    kit: 'linear-gradient(135deg, #6cb4e4 0 42%, #ffffff 42% 58%, #6cb4e4 58%)'
  },
  {
    id: 'republica-de-italia',
    name: 'República de Italia',
    neighborhood: 'Ciudad Evita, La Matanza',
    club: 'Sportivo Italiano',
    position: [-58.5172, -34.738],
    espnVenueId: '5698',
    espnTeamId: '17703',
    // The Italian flag
    kit: 'linear-gradient(90deg, #009246 0 33.4%, #ffffff 33.4% 66.6%, #ce2b37 66.6%)'
  },
  // Rest of Argentina
  {
    id: 'minella',
    name: 'José María Minella',
    neighborhood: 'Mar del Plata',
    club: 'Aldosivi',
    position: [-57.58241, -38.0179],
    espnVenueId: '10781',
    espnTeamId: '9739',
    kit: 'linear-gradient(90deg, #138a3c 0% 20%, #f5c400 20% 40%, #138a3c 40% 60%, #f5c400 60% 80%, #138a3c 80% 100%)'
  },
  {
    id: 'jose-fierro',
    name: 'Monumental José Fierro',
    neighborhood: 'San Miguel de Tucumán, Tucumán',
    club: 'Atlético Tucumán',
    position: [-65.19954, -26.81289],
    espnVenueId: '5558',
    espnTeamId: '9785',
    kit: 'linear-gradient(90deg, #6cb4e4 0% 20%, #ffffff 20% 40%, #6cb4e4 40% 60%, #ffffff 60% 80%, #6cb4e4 80% 100%)'
  },
  {
    id: 'gigante-de-alberdi',
    name: 'El Gigante de Alberdi',
    neighborhood: 'Córdoba',
    club: 'Belgrano (Córdoba)',
    position: [-64.20629, -31.40354],
    espnVenueId: '2736',
    espnTeamId: '4',
    kit: '#5cb8ec'
  },
  {
    id: 'alfredo-terrera',
    name: 'Alfredo Terrera',
    neighborhood: 'Santiago del Estero',
    club: 'Central Córdoba (Santiago del Estero)',
    position: [-64.26438, -27.79384],
    espnVenueId: '6075',
    espnTeamId: '11989',
    kit: 'linear-gradient(90deg, #111111 0% 20%, #ffffff 20% 40%, #111111 40% 60%, #ffffff 60% 80%, #111111 80% 100%)'
  },
  {
    id: 'candini',
    name: 'Antonio Candini',
    neighborhood: 'Río Cuarto, Córdoba',
    club: 'Estudiantes de Río Cuarto',
    position: [-64.34768, -33.11485],
    espnVenueId: '8203',
    espnTeamId: '19685',
    // Sky blue with a white disc outlined in black
    kit: 'radial-gradient(circle closest-side, #ffffff 0 40%, #111111 41% 46%, #6cb4e4 47%)'
  },
  {
    id: 'legrotaglie',
    name: 'Víctor Legrotaglie',
    neighborhood: 'Mendoza',
    club: 'Gimnasia (Mendoza)',
    position: [-68.86424, -32.88425],
    espnVenueId: '10925',
    espnTeamId: '11972',
    kit: 'linear-gradient(90deg, #ffffff 0% 20%, #111111 20% 40%, #ffffff 40% 60%, #111111 60% 80%, #ffffff 80% 100%)'
  },
  {
    id: 'gargantini',
    name: 'Bautista Gargantini',
    neighborhood: 'Mendoza',
    club: 'Independiente Rivadavia',
    position: [-68.86307, -32.89077],
    espnVenueId: '3253',
    espnTeamId: '9744',
    kit: '#2b2a86'
  },
  {
    id: 'alta-cordoba',
    name: 'Monumental de Alta Córdoba',
    neighborhood: 'Córdoba',
    club: 'Instituto (Córdoba)',
    position: [-64.18041, -31.3837],
    espnVenueId: '5557',
    espnTeamId: '2975',
    kit: 'linear-gradient(90deg, #d6111e 0% 20%, #ffffff 20% 40%, #d6111e 40% 60%, #ffffff 60% 80%, #d6111e 80% 100%)'
  },
  {
    id: 'marcelo-bielsa',
    name: 'Coloso Marcelo Bielsa',
    neighborhood: 'Rosario, Santa Fe',
    club: 'Newell\x27s Old Boys',
    position: [-60.66141, -32.95607],
    espnVenueId: '10794',
    espnTeamId: '14',
    kit: 'linear-gradient(90deg, #d6111e 0 50%, #111111 50%)'
  },
  {
    id: 'gigante-de-arroyito',
    name: 'Gigante de Arroyito',
    neighborhood: 'Rosario, Santa Fe',
    club: 'Rosario Central',
    position: [-60.6745, -32.91402],
    espnVenueId: '10775',
    espnTeamId: '17',
    kit: 'linear-gradient(90deg, #1c3f94 0% 20%, #f5c400 20% 40%, #1c3f94 40% 60%, #f5c400 60% 80%, #1c3f94 80% 100%)'
  },
  {
    id: 'eva-peron-junin',
    name: 'Eva Perón',
    neighborhood: 'Junín',
    club: 'Sarmiento (Junín)',
    position: [-60.92931, -34.58526],
    espnVenueId: '10784',
    espnTeamId: '10158',
    kit: '#1a8a3a'
  },
  {
    id: 'kempes',
    name: 'Mario Alberto Kempes',
    neighborhood: 'Córdoba',
    club: 'Talleres (Córdoba)',
    position: [-64.24615, -31.36885],
    espnVenueId: '10782',
    espnTeamId: '19',
    kit: 'linear-gradient(90deg, #1b2f6b 0% 20%, #ffffff 20% 40%, #1b2f6b 40% 60%, #ffffff 60% 80%, #1b2f6b 80% 100%)'
  },
  {
    id: '15-de-abril',
    name: '15 de Abril',
    neighborhood: 'Santa Fe',
    club: 'Unión (Santa Fe)',
    position: [-60.71568, -31.63195],
    espnVenueId: '10790',
    espnTeamId: '20',
    kit: 'linear-gradient(90deg, #d6111e 0% 20%, #ffffff 20% 40%, #d6111e 40% 60%, #ffffff 60% 80%, #d6111e 80% 100%)'
  },
  {
    id: 'rosenzuaig',
    name: 'Ofelia Rosenzuaig',
    neighborhood: 'Carlos Casares',
    club: 'Agropecuario',
    position: [-61.37866, -35.6321],
    espnVenueId: '7454',
    espnTeamId: '13913',
    kit: 'linear-gradient(90deg, #138a3c 0% 20%, #d6111e 20% 40%, #138a3c 40% 60%, #d6111e 60% 80%, #138a3c 80% 100%)'
  },
  {
    id: 'nuevo-monumental-rafaela',
    name: 'Nuevo Monumental',
    neighborhood: 'Rafaela, Santa Fe',
    club: 'Atletico Rafaela',
    position: [-61.4814, -31.25077],
    espnVenueId: '10982',
    espnTeamId: '9747',
    kit: 'linear-gradient(90deg, #6cb4e4 0% 20%, #ffffff 20% 40%, #6cb4e4 40% 60%, #ffffff 60% 80%, #6cb4e4 80% 100%)'
  },
  {
    id: 'martearena',
    name: 'Padre Ernesto Martearena',
    neighborhood: 'Salta',
    club: 'Central Norte',
    position: [-65.41912, -24.8209],
    espnVenueId: '5717',
    espnTeamId: '11993',
    kit: 'linear-gradient(135deg, #ffffff 0 50%, #111111 50%)'
  },
  {
    id: 'juan-alberto-garcia',
    name: 'Juan Alberto García',
    neighborhood: 'Resistencia, Chaco',
    club: 'Chaco For Ever',
    position: [-58.96712, -27.46987],
    espnVenueId: '10973',
    espnTeamId: '11963',
    kit: 'linear-gradient(90deg, #111111 0% 20%, #ffffff 20% 40%, #111111 40% 60%, #ffffff 60% 80%, #111111 80% 100%)'
  },
  {
    id: 'eva-peron-bolivar',
    name: 'Municipal Eva Perón',
    neighborhood: 'Bolívar',
    club: 'Ciudad de Bolívar',
    position: [-61.12187, -36.22356],
    espnVenueId: '9246',
    espnTeamId: '21799',
    kit: '#1f4fd1'
  },
  {
    id: 'brigadier-lopez',
    name: 'Brigadier López',
    neighborhood: 'Santa Fe',
    club: 'Colón (Santa Fe)',
    position: [-60.72525, -31.66322],
    espnVenueId: '10983',
    espnTeamId: '7',
    kit: 'linear-gradient(90deg, #111111 0 50%, #d6111e 50%)'
  },
  {
    id: 'coliseo-del-golfo',
    name: 'Coliseo del Golfo',
    neighborhood: 'Puerto Madryn, Chubut',
    club: 'Deportivo Madryn',
    position: [-65.042243, -42.746881],
    espnVenueId: '4739',
    espnTeamId: '18260',
    kit: 'linear-gradient(90deg, #111111 0% 20%, #f5c400 20% 40%, #111111 40% 60%, #f5c400 60% 80%, #111111 80% 100%)'
  },
  {
    id: 'sperdutti',
    name: 'Omar Higinio Sperdutti',
    neighborhood: 'Maipú, Mendoza',
    club: 'Deportivo Maipú',
    position: [-68.79341, -32.98321],
    espnVenueId: '8432',
    espnTeamId: '11978',
    // Black, white and red diagonal stripes (the white one a bit narrower)
    kit: 'linear-gradient(135deg, #111111 0 38%, #ffffff 38% 62%, #d6111e 62%)'
  },
  {
    id: '23-de-agosto',
    name: '23 de Agosto',
    neighborhood: 'San Salvador de Jujuy, Jujuy',
    club: 'Gimnasia y Esgrima (Jujuy)',
    position: [-65.29093, -24.19855],
    espnVenueId: '10565',
    espnTeamId: '5263',
    kit: 'linear-gradient(180deg, #ffffff 0 36%, #6cb4e4 36% 64%, #ffffff 64%)'
  },
  {
    id: 'gigante-del-norte',
    name: 'El Gigante del Norte',
    neighborhood: 'Salta',
    club: 'Gimnasia y Tiro (Salta)',
    position: [-65.40419, -24.78336],
    espnVenueId: '9878',
    espnTeamId: '10743',
    kit: 'linear-gradient(90deg, #6cb4e4 0% 20%, #ffffff 20% 40%, #6cb4e4 40% 60%, #ffffff 60% 80%, #6cb4e4 80% 100%)'
  },
  {
    id: 'gambarte',
    name: 'Feliciano Gambarte',
    neighborhood: 'Godoy Cruz, Mendoza',
    club: 'Godoy Cruz Antonio Tomba',
    position: [-68.83915, -32.92033],
    espnVenueId: '8699',
    espnTeamId: '6756',
    kit: 'linear-gradient(90deg, #1d4fa0 0% 20%, #ffffff 20% 40%, #1d4fa0 40% 60%, #ffffff 60% 80%, #1d4fa0 80% 100%)'
  },
  {
    id: 'arturo-miranda',
    name: 'Arturo Miranda',
    neighborhood: 'Santiago del Estero',
    club: 'Güemes',
    position: [-64.27636, -27.792797],
    espnVenueId: '8656',
    espnTeamId: '18284',
    kit: 'linear-gradient(180deg, #1d4fa0 0 36%, #d6111e 36% 64%, #1d4fa0 64%)'
  },
  {
    id: 'castiglione',
    name: 'Estadio Castiglione',
    neighborhood: 'Santiago del Estero',
    club: 'Mitre (Santiago del Estero)',
    position: [-64.248926, -27.792962],
    espnVenueId: '10984',
    espnTeamId: '11990',
    kit: 'linear-gradient(90deg, #f5c400 0% 20%, #111111 20% 40%, #f5c400 40% 60%, #111111 60% 80%, #f5c400 80% 100%)'
  },
  {
    id: 'grella',
    name: 'Presbítero Bartolomé Grella',
    neighborhood: 'Paraná, Entre Ríos',
    club: 'Patronato',
    position: [-60.50765, -31.74302],
    espnVenueId: '10979',
    espnTeamId: '10374',
    kit: 'linear-gradient(90deg, #d6111e 0% 20%, #111111 20% 40%, #d6111e 40% 60%, #111111 60% 80%, #d6111e 80% 100%)'
  },
  {
    id: 'miguel-sancho',
    name: 'Miguel Sancho',
    neighborhood: 'Córdoba',
    club: 'Racing (Córdoba)',
    position: [-64.14338, -31.38931],
    espnVenueId: '9464',
    espnTeamId: '19145',
    kit: 'linear-gradient(90deg, #6cb4e4 0% 20%, #ffffff 20% 40%, #6cb4e4 40% 60%, #ffffff 60% 80%, #6cb4e4 80% 100%)'
  },
  {
    id: 'hilario-sanchez',
    name: 'Hilario Sánchez',
    neighborhood: 'San Juan',
    club: 'San Martín (San Juan)',
    position: [-68.5302, -31.51989],
    espnVenueId: '10795',
    espnTeamId: '7845',
    kit: 'linear-gradient(90deg, #138a3c 0% 20%, #111111 20% 40%, #138a3c 40% 60%, #111111 60% 80%, #138a3c 80% 100%)'
  },
  {
    id: 'la-ciudadela',
    name: 'La Ciudadela',
    neighborhood: 'San Miguel de Tucumán, Tucumán',
    club: 'San Martín (Tucumán)',
    position: [-65.22979, -26.8362],
    espnVenueId: '6852',
    espnTeamId: '17814',
    kit: 'linear-gradient(90deg, #d6111e 0% 20%, #ffffff 20% 40%, #d6111e 40% 60%, #ffffff 60% 80%, #d6111e 80% 100%)'
  },
  {
    id: 'villa-fox',
    name: 'Gigante de Villa Fox',
    neighborhood: 'Zárate',
    club: 'Defensores Unidos',
    position: [-59.0166, -34.10448],
    espnVenueId: '6104',
    espnTeamId: '17697',
    kit: '#7cc5ee'
  },
  {
    id: 'armenia',
    name: 'Estadio Armenia',
    neighborhood: 'Ingeniero Maschwitz, Escobar',
    club: 'Deportivo Armenio',
    position: [-58.73028, -34.3762],
    espnVenueId: '6138',
    espnTeamId: '10152',
    kit: 'linear-gradient(180deg, #d90012 0 33.4%, #0033a0 33.4% 66.6%, #f2a800 66.6%)'
  },
  {
    id: 'carlos-v',
    name: 'Carlos V',
    neighborhood: 'Jáuregui, Luján',
    club: 'Flandria',
    position: [-59.18175, -34.58715],
    espnVenueId: '10894',
    espnTeamId: '10156',
    kit: 'linear-gradient(180deg, #f5c400 0 40%, #111111 40% 60%, #f5c400 60%)'
  },
  {
    id: 'barraza',
    name: 'Carlos Barraza',
    neighborhood: 'Pilar',
    club: 'Real Pilar',
    position: [-58.91955, -34.46896],
    espnVenueId: '6131',
    espnTeamId: '18844',
    // White with a black vertical stripe a third wide
    kit: 'linear-gradient(90deg, #ffffff 0 33.3%, #111111 33.3% 66.7%, #ffffff 66.7%)'
  },
  {
    id: 'villa-dalmine',
    name: 'Estadio Villa Dálmine',
    neighborhood: 'Campana',
    club: 'Villa Dálmine',
    position: [-58.977886, -34.161593],
    espnVenueId: '6077',
    espnTeamId: '10064',
    // As on the crest: violet left half, white right half with violet horizontal stripes
    kit: 'linear-gradient(90deg, #5a2a82 0 50%, transparent 50%), repeating-linear-gradient(180deg, #ffffff 0 12.5%, #5a2a82 12.5% 25%)'
  },
  {
    id: 'salice',
    name: 'Genacio Sálice',
    neighborhood: 'Berisso',
    club: 'Villa San Carlos',
    position: [-57.86188, -34.87319],
    espnVenueId: '5562',
    espnTeamId: '10052',
    kit: 'linear-gradient(180deg, #6cb4e4 0 40%, #ffffff 40% 60%, #6cb4e4 60%)'
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
const DAY_MS = 24 * 60 * 60 * 1000

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

// A ground considers the matches played on it plus its club's matches anywhere (home or away).
// It shows a live one, else the latest finished on matchday or the day after
// (a match on the 14th shows until the 15th ends), else the next one.
function pickMatch(stadium: Stadium, matches: LiveMatch[], now: number) {
  const relevant = matches.filter(
    (match) =>
      match.venueId === stadium.espnVenueId ||
      match.homeTeamId === stadium.espnTeamId ||
      match.awayTeamId === stadium.espnTeamId
  )
  const live = relevant.find((match) => match.status === 'live')
  if (live) return live

  const yesterday = ymdFormat.format(now - DAY_MS)
  const recent = relevant
    .filter(
      (match) =>
        match.status === 'finished' && ymdFormat.format(new Date(match.kickoff)) >= yesterday
    )
    .sort(byKickoff)
    .at(-1)
  if (recent) return recent

  return relevant.filter((match) => match.status === 'upcoming').sort(byKickoff)[0]
}

function toStadiumMatch(match: LiveMatch, stadium: Stadium, now: number): StadiumMatch {
  const kickoff = new Date(match.kickoff)
  const time = kickoffFormat.format(kickoff)
  const day = dayLabel(kickoff, now)
  const upcoming = match.status === 'upcoming'
  const playedHere = match.venueId === stadium.espnVenueId

  return {
    day,
    // On its own ground the marker wears the home side's shirt; away matches keep the club's
    kit: playedHere ? kitByTeam.get(match.homeTeamId) : undefined,
    elsewhere: playedHere ? undefined : match.venueName || 'otra cancha',
    status: match.status,
    competition: match.competition,
    homeScore: upcoming ? undefined : match.homeScore,
    awayScore: upcoming ? undefined : match.awayScore,
    kickoffTime: upcoming ? time : undefined,
    minute: match.minute,
    home: match.homeTeam,
    rival: match.awayTeam,
    id: match.id,
    goals: match.goals,
    tv: match.status === 'finished' ? undefined : match.tv,
    // Only matches with a result get a label on the map; upcoming ones show it on the card
    pin: upcoming
      ? undefined
      : `${match.homeAbbr} ${match.homeScore}-${match.awayScore} ${match.awayAbbr}`
  }
}

// How people actually call some grounds, already with their article; wins over ESPN's name
const venueNicknames: Record<string, string> = {
  'Estadio de Excursionistas': 'el Coliseo del Bajo Belgrano',
  'Estadio Jorge Luis Hirschi': '1 y 57',
  'Alberto José Armando (La Bombonera)': 'La Bombonera',
  'Estadio Más Monumental': 'el Monumental',
  'Presidente Perón (Cilindro de Avellaneda)': 'el Cilindro',
  'Juan Carmelo Zerillo (El Bosque)': 'el Bosque',
  'Ciudad de Lanús': 'La Fortaleza',
  'Julio Humberto Grondona': 'el Viaducto',
  'Estadio Tomás Adolfo Ducó': 'el Ducó'
}

// "el Eva Perón", "el Gigante de Alberdi", "La Bombonera": grounds are masculine ("el estadio")
// unless the name already starts with an article
function withArticle(venue: string) {
  if (venueNicknames[venue]) return venueNicknames[venue]
  if (venue === 'otra cancha') return venue
  // "Estadio de Excursionistas" → "el estadio de Excursionistas";
  // "Estadio Jorge Luis Hirschi" → "el Jorge Luis Hirschi" (the name alone reads naturally)
  if (/^Estadio de /.test(venue)) return `el e${venue.slice(1)}`
  const name = venue.replace(/^Estadio /, '')
  if (/^El /.test(name)) return `el ${name.slice(3)}`
  if (/^(La|Las|Los) /.test(name)) return name
  return `el ${name}`
}

// How many of the club's next matches the expanded phone sheet lists
const NEXT_MATCHES_SHOWN = 6

type NextMatch = { id: string; when: string; rival: string; home: boolean; competition: string }

// The club's next upcoming matches after the one on the card (what the expanded sheet lists)
function nextClubMatches(stadium: Stadium, matches: LiveMatch[], shownId: string | undefined, now: number): NextMatch[] {
  return matches
    .filter(
      (match) =>
        match.status === 'upcoming' &&
        match.id !== shownId &&
        (match.homeTeamId === stadium.espnTeamId || match.awayTeamId === stadium.espnTeamId)
    )
    .sort(byKickoff)
    .slice(0, NEXT_MATCHES_SHOWN)
    .map((match) => {
      const kickoff = new Date(match.kickoff)
      const home = match.homeTeamId === stadium.espnTeamId
      return {
        id: match.id,
        when: `${dayLabel(kickoff, now)} · ${kickoffFormat.format(kickoff)}`,
        rival: home ? match.awayTeam : match.homeTeam,
        home,
        competition: match.competition
      }
    })
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

// "finalizado · ayer"; upcoming matches show their day above the kickoff time instead
function statusLabel(match: StadiumMatch) {
  const label = statusLabels[match.status]
  return match.status === 'finished' && match.day && match.day !== 'hoy'
    ? `${label} · ${match.day}`
    : label
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

// The map opens on Buenos Aires (CABA, conurbano and La Plata); the rest of the country is a pan away
const AMBA = new maplibregl.LngLatBounds([-58.95, -35.0], [-57.8, -34.35])

function stadiumBounds() {
  const bounds = new maplibregl.LngLatBounds()
  stadiums
    .filter((stadium) => AMBA.contains(stadium.position))
    .forEach((stadium) => bounds.extend(stadium.position))
  return bounds
}

const isCompactScreen = () => window.matchMedia('(max-width: 780px)').matches

// Bottom sheet on phones: 'peek' shows the card down to the score box, 'full' shows everything
type SheetMode = 'peek' | 'full'
// Dragging this far below the peek position closes the sheet
const SHEET_CLOSE_DISTANCE = 80
// px/ms; a quicker flick than this decides the direction regardless of where the sheet stops
const SHEET_FLICK_SPEED = 0.5

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
  const [compact, setCompact] = useState(isCompactScreen)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [sheetMode, setSheetMode] = useState<SheetMode>('peek')
  // How far down the sheet sits when peeking, measured from the rendered card
  const [peekOffset, setPeekOffset] = useState(0)
  // Live position while the finger is down; null when not dragging
  const [dragY, setDragY] = useState<number | null>(null)
  const dragStart = useRef<{ y: number; base: number; time: number } | null>(null)
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
        return {
          ...stadium,
          match: match
            ? toStadiumMatch(match, stadium, fetchedAt)
            : (stadium.placeholder ?? noMatch)
        }
      }),
    [liveMatches, fetchedAt]
  )

  // A match can show on two grounds (its venue and the away club's), so count matches, not grounds
  const liveCount = new Set(
    stadiumViews
      .filter((stadium) => stadium.match.status === 'live')
      .map((stadium) => stadium.match.id ?? stadium.id)
  ).size

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
          // On phones a newly picked stadium opens peeking
          setSheetMode('peek')
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
  const nextMatches = useMemo(
    () => nextClubMatches(selectedStadium, liveMatches, selectedMatch.id, fetchedAt),
    [selectedStadium, liveMatches, selectedMatch.id, fetchedAt]
  )

  useEffect(() => {
    const query = window.matchMedia('(max-width: 780px)')
    const update = () => setCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // Peek shows the card down to the score box; everything below it slides off screen
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!compact || !detailOpen || !card) return
    const box = card.querySelector('.score-box') ?? card.querySelector('.description')
    const visible = box
      ? box.getBoundingClientRect().bottom - card.getBoundingClientRect().top + 16
      : card.offsetHeight
    setPeekOffset(Math.max(0, card.offsetHeight - visible))
  }, [compact, detailOpen, selectedId, selectedMatch, nextMatches])

  const sheetY = dragY ?? (sheetMode === 'full' ? 0 : peekOffset)

  const onSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!compact || (event.target as HTMLElement).closest('button')) return
    dragStart.current = { y: event.clientY, base: sheetY, time: performance.now() }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onSheetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    if (!start || !cardRef.current) return
    const y = start.base + event.clientY - start.y
    // Past the top, give a little with resistance so the gesture still feels answered
    const resisted = y < 0 ? Math.max(y * 0.3, -40) : y
    setDragY(Math.min(resisted, cardRef.current.offsetHeight))
  }

  const onSheetPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    dragStart.current = null
    if (!start) return
    const moved = event.clientY - start.y
    const speed = moved / Math.max(performance.now() - start.time, 1)
    const end = start.base + moved
    setDragY(null)

    // A tap toggles between peek and full
    if (Math.abs(moved) < 6) {
      setSheetMode((mode) => (mode === 'full' ? 'peek' : 'full'))
      return
    }
    if (end > peekOffset + SHEET_CLOSE_DISTANCE || (speed > SHEET_FLICK_SPEED && start.base >= peekOffset)) {
      setDetailOpen(false)
      setSheetMode('peek')
    } else if (speed < -SHEET_FLICK_SPEED) setSheetMode('full')
    else if (speed > SHEET_FLICK_SPEED) setSheetMode('peek')
    else setSheetMode(end < peekOffset / 2 ? 'full' : 'peek')
  }

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
            <div
              ref={cardRef}
              className={`info-card${dragY === null ? '' : ' dragging'}`}
              style={compact ? { transform: `translateY(${sheetY}px)` } : undefined}
              onPointerDown={onSheetPointerDown}
              onPointerMove={onSheetPointerMove}
              onPointerUp={onSheetPointerUp}
              onPointerCancel={onSheetPointerUp}
            >
              <div className="sheet-handle" aria-hidden="true" />
              <div className="card-topline">
                <span className="card-league">
                  {selectedMatch.status === 'idle' ? '' : selectedMatch.competition}
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
                  <p className="card-club">
                    <span className="club-kit" style={{ background: selectedStadium.kit }} />
                    {selectedStadium.club}
                  </p>
                  <h2>{selectedStadium.name}</h2>
                  <p className="card-place">{selectedStadium.neighborhood}</p>
                </div>
              </div>

              {/* With a match, the status is a tab joined to the score box */}
              <span
                className={`status-tag ${selectedMatch.status}${selectedMatch.status === 'idle' ? '' : ' tab'}`}
              >
                {statusLabel(selectedMatch)}
              </span>

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
                      {selectedMatch.status === 'upcoming' && (
                        <small className="score-day">{selectedMatch.day}</small>
                      )}
                      {clockLabel(selectedMatch)}
                    </span>
                    <strong className="score-value">{selectedMatch.awayScore}</strong>
                    <strong className="score-team away">{selectedMatch.rival}</strong>
                    {selectedMatch.tv && (
                      <span className="score-tv">
                        <span className="tv-label">TV</span>
                        {/* One unbreakable chunk per channel, so lines wrap between channels */}
                        {selectedMatch.tv.split(' · ').map((channel) => (
                          <span key={channel} className="tv-channel">
                            {channel}
                          </span>
                        ))}
                      </span>
                    )}
                    {selectedMatch.elsewhere && (
                      <span className="score-venue">
                        {selectedMatch.status === 'finished' ? 'Se jugó' : 'Se juega'} en{' '}
                        {withArticle(selectedMatch.elsewhere)}
                      </span>
                    )}
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

              {/* Phones only: what the sheet reveals when dragged up */}
              {compact && nextMatches.length > 0 && (
                <div className="next-matches">
                  <p className="next-title">Próximos partidos</p>
                  <ul>
                    {nextMatches.map((match) => (
                      <li key={match.id}>
                        <span className="next-when">{match.when}</span>
                        <span className="next-rival">
                          {match.rival}
                          <span className="next-side">{match.home ? 'L' : 'V'}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
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
