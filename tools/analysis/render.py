"""Render compact display rasters so bundles stay small and honest."""
import numpy as np
from PIL import Image
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import Affine, array_bounds
from rasterio.warp import calculate_default_transform, reproject, transform_bounds


def _rgba(red, green, blue, alpha):
    return np.stack([red, green, blue, alpha], axis=-1).astype(np.uint8)


def display_image(rgba, path, affine, epsg):
    """Warp display pixels to a north-up Web Mercator image; never measure this image."""
    height, width = rgba.shape[:2]
    src_transform = Affine(*affine)
    bounds = array_bounds(height, width, src_transform)
    geographic = transform_bounds(CRS.from_epsg(epsg), "EPSG:4326", *bounds)
    if geographic[0] > geographic[2] or geographic[3] > 85 or geographic[1] < -85:
        return None
    dst_transform, dst_width, dst_height = calculate_default_transform(
        CRS.from_epsg(epsg), "EPSG:3857", width, height, *bounds)
    destination = np.zeros((4, dst_height, dst_width), np.uint8)
    reproject(np.moveaxis(rgba, -1, 0), destination, src_transform=src_transform,
              src_crs=CRS.from_epsg(epsg), dst_transform=dst_transform, dst_crs="EPSG:3857",
              resampling=Resampling.nearest, dst_nodata=0)
    Image.fromarray(np.moveaxis(destination, 0, -1)).save(path, "WEBP", lossless=True, method=4)
    west, south, east, north = transform_bounds("EPSG:3857", "EPSG:4326",
                                               *array_bounds(dst_height, dst_width, dst_transform))
    return [[west, north], [east, north], [east, south], [west, south]]


def delta_image(delta, changed, path, affine, epsg, max_db=6.0):
    """Orange/brighter, blue/darker; transparent outside retained screened components."""
    scaled = np.clip(np.nan_to_num(delta, nan=0.0) / max_db, -1.0, 1.0)
    strength = np.abs(scaled) * 255.0
    red = np.where(scaled > 0, 230, 40 + (1 - np.abs(scaled)) * 60)
    green = np.where(scaled > 0, 120 + (1 - np.abs(scaled)) * 80, 140)
    blue = np.where(scaled > 0, 40, 220)
    alpha = np.where(changed & np.isfinite(delta), np.clip(120 + strength, 0, 235), 0)
    return display_image(_rgba(red, green, blue, alpha), path, affine, epsg)


def water_image(first_mask, last_mask, path, affine, epsg):
    """Water candidates in both, first only, and last only; not confirmed water change."""
    first = first_mask & ~last_mask
    last = last_mask & ~first_mask
    both = first_mask & last_mask
    alpha = np.where(first | last | both, 230, 0)
    red = np.where(last, 240, np.where(first, 40, 20))
    green = np.where(last, 80, np.where(first, 170, 60))
    blue = np.where(last, 220, np.where(first, 220, 120))
    return display_image(_rgba(red, green, blue, alpha), path, affine, epsg)
