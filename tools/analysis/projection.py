"""Minimal WGS84 projection helpers: UTM and polar stereographic north (EPSG:3413)."""
import math

A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)
EP2 = E2 / (1 - E2)
E = math.sqrt(E2)

K0_UTM = 0.9996


def _meridian_arc(lat):
    return A * (
        (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256) * lat
        - (3 * E2 / 8 + 3 * E2**2 / 32 + 45 * E2**3 / 1024) * math.sin(2 * lat)
        + (15 * E2**2 / 256 + 45 * E2**3 / 1024) * math.sin(4 * lat)
        - (35 * E2**3 / 3072) * math.sin(6 * lat)
    )


def lonlat_to_utm(lon, lat, zone=None):
    if zone is None:
        zone = int((lon + 180) // 6) + 1
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    tan_lat = math.tan(lat_rad)
    n = A / math.sqrt(1 - E2 * sin_lat**2)
    t = tan_lat**2
    c = EP2 * cos_lat**2
    aa = cos_lat * (lon_rad - lon0)
    m = _meridian_arc(lat_rad)
    x = K0_UTM * n * (
        aa
        + (1 - t + c) * aa**3 / 6
        + (5 - 18 * t + t**2 + 72 * c - 58 * EP2) * aa**5 / 120
    )
    y = K0_UTM * (
        m
        + n
        * tan_lat
        * (
            aa**2 / 2
            + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24
            + (61 - 58 * t + t**2 + 600 * c - 330 * EP2) * aa**6 / 720
        )
    )
    return x + 500000.0, y


def utm_to_lonlat(x, y, zone):
    x = x - 500000.0
    m = y / K0_UTM
    mu = m / (A * (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256))
    e1 = (1 - math.sqrt(1 - E2)) / (1 + math.sqrt(1 - E2))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )
    sin1 = math.sin(phi1)
    cos1 = math.cos(phi1)
    tan1 = math.tan(phi1)
    c1 = EP2 * cos1**2
    t1 = tan1**2
    n1 = A / math.sqrt(1 - E2 * sin1**2)
    r1 = A * (1 - E2) / (1 - E2 * sin1**2) ** 1.5
    d = x / (n1 * K0_UTM)
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    lat = phi1 - (n1 * tan1 / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * EP2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * EP2 - 3 * c1**2) * d**6 / 720
    )
    lon = lon0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * EP2 + 24 * t1**2) * d**5 / 120
    ) / cos1
    return math.degrees(lon), math.degrees(lat)


def _ps_t(lat_rad):
    sin_lat = math.sin(lat_rad)
    return math.tan(math.pi / 4 - lat_rad / 2) / (
        (1 - E * sin_lat) / (1 + E * sin_lat)
    ) ** (E / 2)


_STD_PARALLEL = math.radians(70.0)
_K0_PS = (
    (math.cos(_STD_PARALLEL) / math.sqrt(1 - E2 * math.sin(_STD_PARALLEL) ** 2))
    * math.sqrt((1 + E) ** (1 + E) * (1 - E) ** (1 - E))
    / (2 * _ps_t(_STD_PARALLEL))
)
_LON0_PS = math.radians(-45.0)


def lonlat_to_ps(lon, lat):
    lat_rad = math.radians(lat)
    rho = (
        2
        * A
        * _K0_PS
        * _ps_t(lat_rad)
        / math.sqrt((1 + E) ** (1 + E) * (1 - E) ** (1 - E))
    )
    dlon = math.radians(lon) - _LON0_PS
    return rho * math.sin(dlon), -rho * math.cos(dlon)


def ps_to_lonlat(x, y):
    rho = math.hypot(x, y)
    t = rho * math.sqrt((1 + E) ** (1 + E) * (1 - E) ** (1 - E)) / (2 * A * _K0_PS)
    phi = math.pi / 2 - 2 * math.atan(t)
    for _ in range(10):
        sin_phi = math.sin(phi)
        phi = math.pi / 2 - 2 * math.atan(
            t * ((1 - E * sin_phi) / (1 + E * sin_phi)) ** (E / 2)
        )
    lon = _LON0_PS + math.atan2(x, -y)
    return math.degrees(lon), math.degrees(phi)


def zone_for(lon):
    return int((lon + 180) // 6) + 1


class Projector:
    def __init__(self, epsg, lon_hint=None):
        self.epsg = int(epsg)
        if 32601 <= self.epsg <= 32660:
            self.kind = "utm"
            self.zone = self.epsg - 32600
        elif 32701 <= self.epsg <= 32760:
            self.kind = "utm_south"
            self.zone = self.epsg - 32700
        elif self.epsg == 3413:
            self.kind = "ps_north"
            self.zone = None
        else:
            raise ValueError(f"unsupported EPSG {epsg}")

    def forward(self, lon, lat):
        if self.kind in ("utm", "utm_south"):
            return lonlat_to_utm(lon, lat, self.zone)
        return lonlat_to_ps(lon, lat)

    def inverse(self, x, y):
        if self.kind in ("utm", "utm_south"):
            return utm_to_lonlat(x, y, self.zone)
        return ps_to_lonlat(x, y)
