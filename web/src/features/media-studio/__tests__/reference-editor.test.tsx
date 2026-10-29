/*
Copyright (C) 2023-2026 QuantumNous
Copyright (C) 2026 CubeRouter

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { ReferenceEditor } from '../components/reference-editor'
import { markPath, validImageMark } from '../lib/reference-markup'

const image = {
  id: 'photo-a',
  mime: 'image/png',
  url: 'data:image/png;base64,YQ==',
}

test('coordinate entry, undo and redo preserve the selected reference and normalized rectangle', () => {
  const apply = vi.fn()
  render(
    <ReferenceEditor image={image} regional onClose={vi.fn()} onApply={apply} />
  )
  expect(screen.getByRole('button', { name: 'Use drawing' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Add rectangle' }))
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  expect(screen.getByRole('button', { name: 'Use drawing' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Use drawing' }))
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({
      referenceID: 'photo-a',
      kind: 'region',
      marks: [
        expect.objectContaining({
          tool: 'rectangle',
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.5, y: 0.5 },
          ],
        }),
      ],
    })
  )
})

test('annotation-only models expose colored guides and reject coordinates outside the image', () => {
  render(
    <ReferenceEditor
      image={image}
      regional={false}
      onClose={vi.fn()}
      onApply={vi.fn()}
    />
  )
  expect(
    screen.queryByRole('button', { name: 'Region selection' })
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Stroke color'), {
    target: { value: 'red' },
  })
  fireEvent.change(screen.getByLabelText('Rectangle X'), {
    target: { value: '99' },
  })
  expect(screen.getByRole('button', { name: 'Add rectangle' })).toBeDisabled()
})

test('malformed or unbounded paths cannot be rasterized as a valid region', () => {
  const mark = {
    tool: 'lasso' as const,
    color: 'blue' as const,
    width: 0.02,
    points: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 },
    ],
  }
  expect(validImageMark(mark)).toBe(true)
  expect(markPath(mark)).toMatch(/Z$/)
  expect(validImageMark({ ...mark, points: [{ x: Infinity, y: 0 }] })).toBe(
    false
  )
  expect(markPath({ ...mark, width: Number.NaN })).toBe('')
})
