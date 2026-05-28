'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

/* ============================================================
   TYPES
   ============================================================ */
type Urg = 'hi' | 'md' | 'lo'

interface MarkerData {
  id: string
  urg: Urg
  loc: string
  kron: string
  lat: number
  lng: number
}

interface Props {
  markers: MarkerData[]
  stats: { total: number; hi: number; md: number; lo: number }
}

/* ============================================================
   CITY → COORDINATE LOOKUP
   ============================================================ */
const CITY_COORDS: [string, number, number][] = [
  // DKI Jakarta
  ['jakarta',         -6.2088,  106.8456],
  ['jakarta pusat',   -6.1862,  106.8338],
  ['jakarta barat',   -6.1682,  106.7637],
  ['jakarta timur',   -6.2250,  106.9004],
  ['jakarta selatan', -6.2615,  106.8106],
  ['jakarta utara',   -6.1380,  106.8608],

  // Jawa Barat
  ['bandung',         -6.9175,  107.6191],
  ['bekasi',          -6.2383,  106.9756],
  ['depok',           -6.4025,  106.7942],
  ['bogor',           -6.5971,  106.8060],
  ['cimahi',          -6.8722,  107.5400],
  ['cirebon',         -6.7320,  108.5523],
  ['karawang',        -6.3213,  107.3376],
  ['sukabumi',        -6.9277,  106.9297],
  ['tasikmalaya',     -7.3274,  108.2208],
  ['cianjur',         -6.8217,  107.1419],
  ['tangerang selatan',-6.2897, 106.7106],

  // Banten
  ['tangerang',       -6.1781,  106.6299],
  ['serang',          -6.1202,  106.1503],
  ['cilegon',         -6.0025,  106.0532],

  // Jawa Tengah
  ['semarang',        -6.9932,  110.4203],
  ['solo',            -7.5755,  110.8243],
  ['surakarta',       -7.5755,  110.8243],
  ['magelang',        -7.4797,  110.2177],
  ['tegal',           -6.8694,  109.1402],
  ['pekalongan',      -6.8889,  109.6753],
  ['kudus',           -6.8048,  110.8395],
  ['purwokerto',      -7.4286,  109.2418],
  ['cilacap',         -7.7300,  109.0150],

  // DI Yogyakarta
  ['yogyakarta',      -7.7972,  110.3688],
  ['jogja',           -7.7972,  110.3688],
  ['sleman',          -7.7168,  110.3569],
  ['bantul',          -7.8884,  110.3309],

  // Jawa Timur
  ['surabaya',        -7.2575,  112.7521],
  ['malang',          -7.9666,  112.6326],
  ['sidoarjo',        -7.4458,  112.7181],
  ['gresik',          -7.1565,  112.6563],
  ['mojokerto',       -7.4753,  112.4336],
  ['kediri',          -7.8165,  112.0115],
  ['banyuwangi',      -8.2192,  114.3691],
  ['jember',          -8.1724,  113.6878],
  ['pasuruan',        -7.6456,  112.9066],
  ['probolinggo',     -7.7521,  113.2154],
  ['madiun',          -7.6298,  111.5239],

  // Bali
  ['denpasar',        -8.6705,  115.2126],
  ['bali',            -8.3405,  115.0920],
  ['badung',          -8.6478,  115.1418],
  ['gianyar',         -8.5350,  115.3236],
  ['tabanan',         -8.5415,  115.1241],
  ['buleleng',        -8.1132,  115.0882],

  // Sumatera Utara
  ['medan',            3.5952,   98.6722],
  ['binjai',           3.6036,   98.4854],
  ['pematang siantar', 2.9595,   99.0688],

  // Sumatera Selatan
  ['palembang',       -2.9761,  104.7754],

  // Sumatera Barat
  ['padang',          -0.9492,  100.3543],

  // Riau
  ['pekanbaru',        0.5335,  101.4502],

  // Kepulauan Riau
  ['batam',            1.1254,  104.0057],

  // Lampung
  ['bandar lampung',  -5.3971,  105.2668],
  ['lampung',         -5.4295,  105.2610],
  ['metro',           -5.1140,  105.3070],

  // Kalimantan Barat
  ['pontianak',       -0.0263,  109.3425],
  ['singkawang',       0.9025,  108.9864],

  // Kalimantan Timur
  ['samarinda',       -0.5022,  117.1536],
  ['balikpapan',      -1.2379,  116.8529],
  ['bontang',          0.1338,  117.4735],

  // Kalimantan Selatan
  ['banjarmasin',     -3.3194,  114.5908],

  // Sulawesi Selatan
  ['makassar',        -5.1477,  119.4327],
  ['parepare',        -4.0135,  119.6293],
  ['palopo',          -2.9925,  120.1965],

  // Sulawesi Utara
  ['manado',           1.4748,  124.8421],

  // Sulawesi Tengah
  ['palu',            -0.9003,  119.8779],

  // Maluku
  ['ambon',           -3.6954,  128.1814],
  ['ternate',          0.7786,  127.3728],

  // Papua
  ['jayapura',        -2.5337,  140.7181],
  ['manokwari',       -0.8615,  134.0622],
  ['sorong',          -0.8760,  131.2550],
  ['timika',          -4.5303,  136.8836],

  // NTT
  ['kupang',          -10.1772, 123.6070],
  ['flores',          -8.6564,  121.0794],
  ['labuan bajo',     -8.4958,  119.8820],

  // NTB
  ['mataram',         -8.5833,  116.1167],

  // Aceh
  ['banda aceh',       5.5577,   95.3222],

  // Kepulauan Bangka Belitung
  ['pangkalpinang',   -2.1316,  106.1169],
]

function geolocate(lokasi: string): [number, number] | null {
  if (!lokasi || lokasi === '-') return null
  const loc = lokasi.toLowerCase()
  for (const [name, lat, lng] of CITY_COORDS) {
    if (loc.includes(name)) return [lat, lng]
  }
  return null
}

/* ============================================================
   STATS CONTROL — top-left overlay
   ============================================================ */
function StatsControl({ stats }: { stats: Props['stats'] }) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 1000,
      background: 'rgba(15,15,15,0.88)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 4, padding: '12px 16px', minWidth: 160,
      backdropFilter: 'blur(6px)',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
        TOTAL INSIDEN
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
        {stats.total}
      </div>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
        <span style={{ color: '#ef4444' }}>{stats.hi} TINGGI</span>
        {' · '}
        <span style={{ color: '#f59e0b' }}>{stats.md} SEDANG</span>
        {' · '}
        <span style={{ color: '#22c55e' }}>{stats.lo} RENDAH</span>
      </div>
    </div>
  )
}

/* ============================================================
   LEGEND CONTROL — bottom-right overlay
   ============================================================ */
function LegendControl({ stats }: { stats: Props['stats'] }) {
  const items = [
    { color: '#ef4444', label: 'Tinggi', count: stats.hi },
    { color: '#f59e0b', label: 'Sedang', count: stats.md },
    { color: '#22c55e', label: 'Rendah', count: stats.lo },
  ]
  return (
    <div style={{
      position: 'absolute', bottom: 30, right: 12, zIndex: 1000,
      background: 'rgba(15,15,15,0.88)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 4, padding: '12px 16px', minWidth: 140,
      backdropFilter: 'blur(6px)',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
        URGENSI
      </div>
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: it.color, border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.04em' }}>{it.label}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{it.count}</span>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   FIT BOUNDS — auto-zoom to markers
   ============================================================ */
function FitBounds({ markers }: { markers: MarkerData[] }) {
  const map = useMap()
  useEffect(() => {
    if (markers.length === 0) {
      map.setView([-2.5, 118], 5)
      return
    }
    // Just keep default Indonesia view — markers are scattered across the archipelago
    map.setView([-2.5, 118], 5)
  }, [markers, map])
  return null
}

/* ============================================================
   URGENCY → MARKER STYLE
   ============================================================ */
const URG_COLOR: Record<Urg, string> = {
  hi: '#ef4444',
  md: '#f59e0b',
  lo: '#22c55e',
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function LeafletMap({ markers, stats }: Props) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={[-2.5, 118]}
        zoom={5}
        style={{ width: '100%', height: '100%', background: '#0f0f0f' }}
        zoomControl={false}
        attributionControl={true}
        scrollWheelZoom={true}
      >
        <ZoomControl position="topright" />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        <FitBounds markers={markers} />
        {markers.map(m => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={9}
            pathOptions={{
              fillColor: URG_COLOR[m.urg],
              fillOpacity: 0.85,
              color: '#fff',
              weight: 1.5,
              opacity: 0.9,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.97}>
              <div style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11, lineHeight: 1.5, minWidth: 160,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{m.id}</div>
                <div style={{ color: URG_COLOR[m.urg], fontWeight: 700, letterSpacing: '0.08em' }}>
                  ● {m.urg === 'hi' ? 'TINGGI' : m.urg === 'md' ? 'SEDANG' : 'RENDAH'}
                </div>
                <div style={{ color: '#555', marginTop: 4, fontSize: 10 }}>{m.loc}</div>
                <div style={{ color: '#333', marginTop: 2, fontSize: 10, maxWidth: 200 }}>
                  {m.kron.slice(0, 60)}{m.kron.length > 60 ? '...' : ''}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <StatsControl stats={stats} />
      <LegendControl stats={stats} />
    </div>
  )
}

export type { MarkerData }
