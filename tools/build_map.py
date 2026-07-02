# Genera js/map-geo.js: contornos reales (simplificados) de la Comunidad de
# Madrid y provincias vecinas, proyectados al viewBox 0..100 del mapa de la app.
# Fuente: georef-spain-provincia (opendatasoft, datos IGN). Uso:
#   python tools/build_map.py        (descarga los GeoJSON si no están en caché)
import json, math, os, unicodedata, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'provs.geojson')          # 5 provincias (sin tilde)
SRC_AV = os.path.join(HERE, 'avila.geojson')       # Ávila por código (la tilde rompe el where)
OUT = os.path.join(HERE, '..', 'js', 'map-geo.js')
API = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-spain-provincia/exports/geojson'

def fetch(path, where):
    if os.path.exists(path): return
    url = API + '?' + urllib.parse.urlencode({'where': where, 'select': 'prov_name'})
    urllib.request.urlretrieve(url, path)

fetch(SRC, "prov_name in ('Madrid','Toledo','Guadalajara','Cuenca','Segovia')")
fetch(SRC_AV, "prov_code='05'")

gj = json.load(open(SRC, encoding='utf-8'))
gj['features'] += json.load(open(SRC_AV, encoding='utf-8'))['features']

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

# ── proyección equirrectangular centrada en Madrid, ajustada al viewBox ──
lons = [p[0] for p in mad]; lats = [p[1] for p in mad]
lon_min, lon_max = min(lons), max(lons)
lat_min, lat_max = min(lats), max(lats)
lat_mid = (lat_min + lat_max) / 2
coslat = math.cos(math.radians(lat_mid))

w_deg = (lon_max - lon_min) * coslat
h_deg = lat_max - lat_min
# Madrid ocupa [12..88] (76 unidades) en su eje mayor, centrado en 50,50
span = max(w_deg, h_deg)
k = 76.0 / span
lon0 = (lon_min + lon_max) / 2
lat0 = lat_mid

def proj(lon, lat):
    x = 50 + (lon - lon0) * coslat * k
    y = 50 - (lat - lat0) * k
    return x, y

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
    ring = pts[:-1]  # trabajar abierto, cerrar al final
    for _ in range(iters):
        out = []
        n = len(ring)
        for i in range(n):
            px, py = ring[i]; qx, qy = ring[(i + 1) % n]
            out.append((0.75 * px + 0.25 * qx, 0.75 * py + 0.25 * qy))
            out.append((0.25 * px + 0.75 * qx, 0.25 * py + 0.75 * qy))
        ring = out
    return ring + [ring[0]]

def to_path(ring, tol, smooth=2):
    pts = [proj(lon, lat) for lon, lat in ring]
    if pts[0] != pts[-1]: pts.append(pts[0])
    pts = dp(pts, tol)
    if smooth: pts = chaikin(pts, smooth)
    d = 'M' + ' '.join('%.1f,%.1f' % (x, y) for x, y in pts[:-1]) + 'Z'
    return d, len(pts)

import sys
sys.setrecursionlimit(100000)

mad_d, n_mad = to_path(mad, 0.45, smooth=2)
neigh = {}
for name in ['Segovia', 'Guadalajara', 'Cuenca', 'Toledo', 'Ávila']:
    neigh[name], n = to_path(provs[name], 0.7, smooth=1)
    print(name, n, 'pts')
print('Madrid', n_mad, 'pts')

# ── ciudades (lon, lat reales); se proyectan y se recortan al marco ──
cities = {
    'mad':   (-3.7038, 40.4168), 'tol':   (-4.0273, 39.8628),
    'gua':   (-3.1669, 40.6333), 'seg':   (-4.1088, 40.9429),
    'avila': (-4.6812, 40.6566), 'cuenca':(-2.1370, 40.0700),
    'sev':   (-5.9940, 37.3920), 'bcn':   ( 2.1700, 41.3800),
    'waw':   (21.0100, 52.2300), 'kra':   (19.9400, 50.0600),
}
cxy = {}
for kk, (lon, lat) in cities.items():
    x, y = proj(lon, lat)
    cxy[kk] = [round(max(7, min(93, x)), 1), round(max(7, min(93, y)), 1)]

js = []
js.append('/* GENERADO (tools/build_map.py) a partir de georef-spain-provincia')
js.append('   (opendatasoft, datos IGN). Contornos REALES simplificados (Douglas-Peucker +')
js.append('   suavizado Chaikin) y proyectados (equirrectangular centrada en Madrid) al')
js.append('   viewBox 0..100. No editar a mano: regenerar con el script. */')
js.append('window.MAP_GEO = {')
js.append('  madrid: "%s",' % mad_d)
js.append('  provs: {')
for name, d in neigh.items():
    key = name.replace('Á', 'A').lower()
    js.append('    %s: "%s",' % (key, d))
js.append('  },')
js.append('  cities: %s,' % json.dumps(cxy))
# parámetros de proyección: x = 50 + (lon-lon0)*coslat*k ; y = 50 - (lat-lat0)*k
# (permiten proyectar en runtime coordenadas reales de cualquier local/evento)
js.append('  proj: {lon0:%.6f, lat0:%.6f, coslat:%.6f, k:%.4f}' % (lon0, lat0, coslat, k))
js.append('};')
open(OUT, 'w', encoding='utf-8').write('\n'.join(js) + '\n')
print('written', OUT)
