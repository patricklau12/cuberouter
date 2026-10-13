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
import math
import unittest
from types import SimpleNamespace

from edit_quality import MAX_REFERENCE_PIXELS, reference_resolution


def image(width, height):
    return SimpleNamespace(size=(width, height))


class EditQualityTests(unittest.TestCase):
    def test_native_single_reference_retains_supported_dimensions(self):
        # Match the pipeline's area/aspect -> 32-pixel bucket calculation.
        for width, height in ((1280, 1280), (1312, 1312), (1536, 1024),
                              (1664, 928), (672, 640), (512, 512)):
            with self.subTest(size=(width, height)):
                side = reference_resolution([image(width, height)])
                calculated_width = round(math.sqrt(side * side * width / height) / 32) * 32
                calculated_height = round(math.sqrt(side * side * height / width) / 32) * 32
                self.assertEqual((calculated_width, calculated_height), (width, height))

    def test_large_single_reference_is_bounded(self):
        self.assertEqual(reference_resolution([image(4096, 4096)]), math.isqrt(MAX_REFERENCE_PIXELS))

    def test_small_reference_meets_vision_minimum(self):
        self.assertEqual(reference_resolution([image(64, 64)]), 256)

    def test_multi_reference_gpu_budget_is_preserved(self):
        for count in range(2, 11):
            self.assertEqual(reference_resolution([image(1312, 1312)] * count), 1024 if count <= 3 else 512)

    def test_missing_reference_is_rejected(self):
        with self.assertRaises(ValueError):
            reference_resolution([])


if __name__ == '__main__':
    unittest.main()
