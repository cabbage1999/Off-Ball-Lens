"""Display conversion only. Scalar AS and DAS never use this grid."""
from __future__ import annotations

import base64
import numpy as np
from .config import HEATMAP


def radial_widths(r_grid):
    """Exact midpoint widths used by author core.integrate_surfaces 2.1.0."""
    lower = np.empty_like(r_grid)
    upper = np.empty_like(r_grid)
    lower[0], lower[1:] = r_grid[0], (r_grid[:-1] + r_grid[1:]) / 2
    upper[-1], upper[:-1] = r_grid[-1], (r_grid[:-1] + r_grid[1:]) / 2
    return upper - lower


def display_field(result, frame_index: int, player_index: int, direction: int = 1):
    """Periodic polar bilinear interpolation, with the canonical x restored."""
    density = result.player_poss_density[frame_index, player_index]
    field = density * radial_widths(result.r_grid)[None, :]
    width, height = HEATMAP["width"], HEATMAP["height"]
    xs = HEATMAP["xMin"] + (np.arange(width) + 0.5) * (HEATMAP["xMax"] - HEATMAP["xMin"]) / width
    ys = HEATMAP["yMin"] + (np.arange(height) + 0.5) * (HEATMAP["yMax"] - HEATMAP["yMin"]) / height
    xx, yy = np.meshgrid(xs * direction, ys)
    # r_grid[0] is zero for our pinned DAS configuration.
    bx, by = float(result.x_grid[frame_index, 0, 0]), float(result.y_grid[frame_index, 0, 0])
    radius = np.hypot(xx - bx, yy - by)
    phi = np.mod(np.arctan2(yy - by, xx - bx) - result.phi_grid[frame_index, 0], 2 * np.pi)
    angular_index = phi * density.shape[0] / (2 * np.pi)
    a0 = np.floor(angular_index).astype(int) % density.shape[0]
    a1 = (a0 + 1) % density.shape[0]
    af = angular_index - np.floor(angular_index)
    r1 = np.searchsorted(result.r_grid, radius, side="right").clip(1, len(result.r_grid) - 1)
    r0 = r1 - 1
    rf = (radius - result.r_grid[r0]) / (result.r_grid[r1] - result.r_grid[r0])
    row0 = field[a0, r0] * (1 - rf) + field[a0, r1] * rf
    row1 = field[a1, r0] * (1 - rf) + field[a1, r1] * rf
    interpolated = row0 * (1 - af) + row1 * af
    interpolated[radius > result.r_grid[-1]] = 0
    return np.maximum(interpolated, 0)


def encode_heatmap(result, frame_index: int, player_index: int, direction: int = 1):
    field = display_field(result, frame_index, player_index, direction)
    maximum = float(np.max(field))
    saturated = int(np.count_nonzero(field > HEATMAP["scaleMax"]))
    quantized = np.rint(np.clip(field / HEATMAP["scaleMax"], 0, 1) * 255).astype(np.uint8)
    return base64.b64encode(quantized.tobytes()).decode("ascii"), {"max": maximum, "saturatedCells": saturated}
