"""WGS84 transformations using GDAL's maintained worldwide CRS definitions."""
from rasterio.crs import CRS
from rasterio.warp import transform


class Projector:
    def __init__(self, epsg):
        self.crs = CRS.from_epsg(int(epsg))

    def forward(self, lon, lat):
        x, y = transform("EPSG:4326", self.crs, [lon], [lat])
        return x[0], y[0]

    def inverse(self, x, y):
        lon, lat = transform(self.crs, "EPSG:4326", [x], [y])
        return lon[0], lat[0]
