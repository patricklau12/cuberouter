# Copyright (C) 2023-2026 QuantumNous
# Copyright (C) 2026 CubeRouter
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# For commercial licensing, please contact support@quantumnous.com
"""Keep single-reference edits at their native detail within the GPU budget."""
import math


MAX_REFERENCE_PIXELS = 2_097_152


def reference_resolution(images):
    if not images:
        raise ValueError('missing_reference')
    if len(images) > 3:
        return 512
    if len(images) > 1:
        return 1024
    width, height = images[0].size
    # The pipeline derives an aspect-preserving, 32-pixel-aligned size from
    # this area. Avoid forcing a small original up to 1 MP, or a larger
    # supported original down to 1 MP. Keep multi-reference memory unchanged.
    return max(256, math.isqrt(min(width * height, MAX_REFERENCE_PIXELS)))
