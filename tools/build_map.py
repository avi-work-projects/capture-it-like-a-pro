# Genera js/map-geo.js: contornos reales (simplificados+suavizados) del mapa de
# eventos, proyectados al viewBox 0..100 del SVG de la app. Dos escenas:
#   - region: Comunidad de Madrid + 5 provincias vecinas (contexto)
#   - city:   municipio de Madrid "a pelo" (vista ciudad)
# Fuente: georef-spain-provincia / georef-spain-municipio (opendatasoft, IGN).
# Uso:  python tools/build_map.py   (descarga los GeoJSON si no están en caché)
# Para OTRA provincia: ver .claude/skills/mapa-provincia/SKILL.md
import json, math, os, unicodedata, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'js', 'map-geo.js')
API = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/%s/exports/geojson'

def fetch(dataset, where, path):
    if os.path.exists(path): return
    url = (API % dataset) + '?' + urllib.parse.urlencode({'where': where, 'select': '*'})
    urllib.request.urlretrieve(url, path)

SRC    = os.path.join(HERE, 'provs.geojson')   # 5 provincias (sin tilde en el where)
SRC_AV = os.path.join(HERE, 'avila.geojson')   # Ávila por código (la tilde rompe el where)
SRC_MUN= os.path.join(HERE, 'mun_madrid.geojson')
SRC_BAR= os.path.join(HERE, 'barrios_madrid.geojson')  # 128 barrios (click_that_hood)
fetch('georef-spain-provincia', "prov_name in ('Madrid','Toledo','Guadalajara','Cuenca','Segovia')", SRC)
fetch('georef-spain-provincia', "prov_code='05'", SRC_AV)
fetch('georef-spain-municipio', "mun_code='28079'", SRC_MUN)
if not os.path.exists(SRC_BAR):
    urllib.request.urlretrieve('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/madrid.geojson', SRC_BAR)

gj = json.load(open(SRC, encoding='utf-8'))
gj['features'] += json.load(open(SRC_AV, encoding='utf-8'))['features']
mun = json.load(open(SRC_MUN, encoding='utf-8'))
assert len(mun['features']) == 1, 'esperaba 1 municipio, hay %d' % len(mun['features'])

def rings(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates'][0]]
    return [p[0] for p in geom['coordinates']]  # MultiPolygon: anillo exterior de cada parte

def biggest(geom):
    def area(r):
        s = 0
        for i in range(len(r) - 1):
            s += r[i][0] * r[i+1][1] - r[i+1][0] * r[i][1]
        return abs(s)
    return max(rings(geom), key=area)

provs = {}
for f in gj['features']:
    name = f['properties']['prov_name']
    if isinstance(name, list): name = name[0]
    provs[unicodedata.normalize('NFC', name)] = biggest(f['geometry'])

mad = provs['Madrid']
mun_ring = biggest(mun['features'][0]['geometry'])

# ── proyección equirrectangular centrada en la figura, ajustada al viewBox ──
def make_proj(ring, span_units=76.0):
    lons = [p[0] for p in ring]; lats = [p[1] for p in ring]
    lat_mid = (min(lats) + max(lats)) / 2
    coslat = math.cos(math.radians(lat_mid))
    w = (max(lons) - min(lons)) * coslat
    h = max(lats) - min(lats)
    return { 'lon0': (min(lons) + max(lons)) / 2, 'lat0': lat_mid,
             'coslat': coslat, 'k': span_units / max(w, h) }

def proj_pt(pr, lon, lat):
    return (50 + (lon - pr['lon0']) * pr['coslat'] * pr['k'],
            50 - (lat - pr['lat0']) * pr['k'])

# ── Douglas-Peucker en unidades de viewBox ──
def dp(pts, tol):
    if len(pts) < 3: return pts
    ax, ay = pts[0]; bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    L2 = dx*dx + dy*dy
    imax, dmax = 0, -1
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        if L2 == 0:
            d = math.hypot(px - ax, py - ay)
        else:
            t = ((px - ax) * dx + (py - ay) * dy) / L2
            t = max(0, min(1, t))
            d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
        if d > dmax: imax, dmax = i, d
    if dmax <= tol: return [pts[0], pts[-1]]
    left = dp(pts[:imax+1], tol); right = dp(pts[imax:], tol)
    return left[:-1] + right

# ── suavizado Chaikin (anillo cerrado): sin él, el trazo DP queda anguloso,
#    con picos de mitra tipo "rayo" que cantan al ampliar ──
def chaikin(pts, iters):
    ring = pts[:-1]
    for _ in range(iters):
        out = []
        n = len(ring)
        for i in range(n):
            px, py = ring[i]; qx, qy = ring[(i + 1) % n]
            out.append((0.75 * px + 0.25 * qx, 0.75 * py + 0.25 * qy))
            out.append((0.25 * px + 0.75 * qx, 0.25 * py + 0.75 * qy))
        ring = out
    return ring + [ring[0]]

def to_path(pr, ring, tol, smooth=2):
    pts = [proj_pt(pr, lon, lat) for lon, lat in ring]
    if pts[0] != pts[-1]: pts.append(pts[0])
    pts = dp(pts, tol)
    if smooth: pts = chaikin(pts, smooth)
    d = 'M' + ' '.join('%.1f,%.1f' % (x, y) for x, y in pts[:-1]) + 'Z'
    return d, len(pts)

import sys
sys.setrecursionlimit(100000)

REG = make_proj(mad)          # escena Comunidad
CITY = make_proj(mun_ring)    # escena municipio

mad_d, n = to_path(REG, mad, 0.45, smooth=2); print('Madrid (region)', n, 'pts')
neigh = {}
for name in ['Segovia', 'Guadalajara', 'Cuenca', 'Toledo', 'Ávila']:
    neigh[name], n = to_path(REG, provs[name], 0.7, smooth=1)
    print(name, n, 'pts')
mun_d, n = to_path(CITY, mun_ring, 0.4, smooth=2); print('Municipio (city)', n, 'pts')

# ── barrios (textura interna de la vista ciudad): todos en UN solo path ──
bar = json.load(open(SRC_BAR, encoding='utf-8'))
bar_parts, bar_pts = [], 0
for f in bar['features']:
    for ring in rings(f['geometry']):
        d, np_ = to_path(CITY, ring, 0.25, smooth=1)
        if np_ >= 4:              # descartar restos degenerados
            bar_parts.append(d); bar_pts += np_
bar_d = ' '.join(bar_parts)
print('Barrios (city)', len(bar_parts), 'poligonos,', bar_pts, 'pts')

# ── escena CENTRO: solo barrios dentro de la M-30 y su periferia inmediata.
#    Aproximación: centroide del barrio a ≤ RADIO km de la Puerta del Sol
#    (la M-30 queda a ~3.5-5.5 km del centro según el tramo). ──
SOL = (-3.7038, 40.4168)
RADIO_KM = 3.4   # acotado al CENTRO de verdad (almendra central; antes 5.5)
def centroid(ring):
    n = len(ring) - 1 if ring[0] == ring[-1] else len(ring)
    return (sum(p[0] for p in ring[:n]) / n, sum(p[1] for p in ring[:n]) / n)
def dist_km(a, b):
    kx = 111.32 * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 111.32)

centro_rings = []
for f in bar['features']:
    r = biggest(f['geometry'])
    if dist_km(centroid(r), SOL) <= RADIO_KM:
        centro_rings.append(r)
all_pts = [p for r in centro_rings for p in r]
CENTER = make_proj(all_pts)
cen_parts, cen_pts = [], 0
for r in centro_rings:
    # SIN Chaikin: suavizar cada barrio por separado redondea las teselas y
    # las fronteras compartidas dejan de encajar (huecos/solapes = efecto raro)
    d, np_ = to_path(CENTER, r, 0.12, smooth=0)
    if np_ >= 4:
        cen_parts.append(d); cen_pts += np_
cen_d = ' '.join(cen_parts)
print('Centro', len(cen_parts), 'barrios,', cen_pts, 'pts (radio %.1f km)' % RADIO_KM)

# ── centros de ciudad (lon, lat CRUDOS): la app los proyecta en runtime con la
#    proyección de la escena activa (fallback para eventos sin coords propias) ──
cities = {
    'mad':   [-3.7038, 40.4168], 'tol':   [-4.0273, 39.8628],
    'gua':   [-3.1669, 40.6333], 'seg':   [-4.1088, 40.9429],
    'avila': [-4.6812, 40.6566], 'cuenca':[-2.1370, 40.0700],
    'sev':   [-5.9940, 37.3920], 'bcn':   [ 2.1700, 41.3800],
    'waw':   [21.0100, 52.2300], 'kra':   [19.9400, 50.0600],
}

def js_proj(pr):
    return '{lon0:%.6f, lat0:%.6f, coslat:%.6f, k:%.4f}' % (pr['lon0'], pr['lat0'], pr['coslat'], pr['k'])

js = []
js.append('/* GENERADO (tools/build_map.py) a partir de georef-spain-provincia/municipio')
js.append('   (opendatasoft, datos IGN). Contornos REALES simplificados (Douglas-Peucker +')
js.append('   suavizado Chaikin) y proyectados (equirrectangular) al viewBox 0..100.')
js.append('   proj: x = 50+(lon-lon0)*coslat*k ; y = 50-(lat-lat0)*k')
js.append('   No editar a mano: regenerar con el script. */')
js.append('window.MAP_GEO = {')
js.append('  madrid: "%s",' % mad_d)
js.append('  provs: {')
for name, d in neigh.items():
    key = name.replace('Á', 'A').lower()
    js.append('    %s: "%s",' % (key, d))
js.append('  },')
js.append('  proj: %s,' % js_proj(REG))
js.append('  city: { d: "%s", dist: "%s", proj: %s },' % (mun_d, bar_d, js_proj(CITY)))
js.append('  center: { d: "%s", proj: %s },' % (cen_d, js_proj(CENTER)))
js.append('  cities: %s' % json.dumps(cities))
js.append('};')
open(OUT, 'w', encoding='utf-8').write('\n'.join(js) + '\n')
print('written', OUT)
