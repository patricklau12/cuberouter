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
import { useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import {
  markPath,
  validImageMark,
  type ImageMark,
  type MarkPoint,
  type ReferenceMarkup,
} from '../lib/reference-markup'
import { newId } from '../workflow-api'
import type { StudioAsset } from '../workflow-types'

export function ReferenceEditor(props: {
  image: StudioAsset
  value?: ReferenceMarkup
  regional: boolean
  onClose: () => void
  onApply: (value: ReferenceMarkup) => void
}) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<ReferenceMarkup['kind']>(
    props.value?.kind ?? (props.regional ? 'region' : 'annotation')
  )
  const [tool, setTool] = useState<ImageMark['tool']>('brush')
  const [color, setColor] = useState<ImageMark['color']>('blue')
  const [width, setWidth] = useState(0.02)
  const [marks, setMarks] = useState<ImageMark[]>(
    props.value?.marks.map((mark) => ({ ...mark, id: mark.id ?? newId() })) ??
      []
  )
  const [redo, setRedo] = useState<ImageMark[]>([])
  const [draft, setDraft] = useState<ImageMark>()
  const [maskOnly, setMaskOnly] = useState(false)
  const [coordinates, setCoordinates] = useState([0.1, 0.1, 0.4, 0.4])
  const [ratio, setRatio] = useState(1)
  const pointer = useRef<number | null>(null)
  const surface = useRef<SVGSVGElement>(null)
  const at = (event: PointerEvent<SVGSVGElement>): MarkPoint | undefined => {
    const rect = surface.current?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return undefined
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    }
  }
  const append = (mark: ImageMark) => {
    if (marks.length < 100 && validImageMark(mark)) {
      setMarks([...marks, { ...mark, id: mark.id ?? newId() }])
      setRedo([])
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Edit reference image')}</DialogTitle>
          <DialogDescription>
            {t(
              'Region edits preserve pixels outside your selection. Colored marks guide a whole-image edit; describe each color in your prompt.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-wrap gap-2'>
          {props.regional && (
            <Button
              type='button'
              variant={kind === 'region' ? 'secondary' : 'outline'}
              aria-pressed={kind === 'region'}
              onClick={() => setKind('region')}
            >
              {t('Region selection')}
            </Button>
          )}
          <Button
            type='button'
            variant={kind === 'annotation' ? 'secondary' : 'outline'}
            aria-pressed={kind === 'annotation'}
            onClick={() => setKind('annotation')}
          >
            {t('Colored marks')}
          </Button>
          {(['rectangle', 'lasso', 'brush'] as const).map((value) => (
            <Button
              key={value}
              type='button'
              variant={tool === value ? 'secondary' : 'outline'}
              aria-pressed={tool === value}
              onClick={() => setTool(value)}
            >
              {t(value)}
            </Button>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <label>
            {t('Brush width')}
            <Input
              aria-label={t('Brush width')}
              type='number'
              min={0.5}
              max={10}
              step={0.5}
              value={width * 100}
              onChange={(e) => setWidth(Number(e.target.value) / 100)}
            />
          </label>
          {kind === 'annotation' && (
            <label>
              {t('Stroke color')}
              <select
                aria-label={t('Stroke color')}
                value={color}
                onChange={(e) => setColor(e.target.value as ImageMark['color'])}
              >
                {(['blue', 'red', 'green', 'white'] as const).map((value) => (
                  <option key={value} value={value}>
                    {t(value)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'region' && (
            <label className='flex items-center gap-2'>
              <input
                type='checkbox'
                checked={maskOnly}
                onChange={(e) => setMaskOnly(e.target.checked)}
              />
              {t('Show mask only')}
            </label>
          )}
        </div>
        <div
          className='relative mx-auto w-full overflow-hidden rounded-lg border bg-black'
          style={{
            aspectRatio: ratio,
            maxWidth: `min(100%, ${55 * ratio}dvh)`,
          }}
        >
          <img
            className={`h-full w-full object-contain ${maskOnly && kind === 'region' ? 'invisible' : ''}`}
            src={props.image.url}
            alt={t('Original reference')}
            onLoad={(e) =>
              setRatio(
                e.currentTarget.naturalWidth / e.currentTarget.naturalHeight
              )
            }
          />
          <svg
            ref={surface}
            viewBox={`0 0 ${ratio} 1`}
            preserveAspectRatio='none'
            className='absolute inset-0 h-full w-full touch-none'
            role='img'
            aria-label={t('Reference drawing surface')}
            onPointerDown={(event) => {
              if (pointer.current !== null || marks.length >= 100) return
              const point = at(event)
              if (!point) return
              pointer.current = event.pointerId
              event.currentTarget.setPointerCapture?.(event.pointerId)
              setDraft({ id: newId(), tool, color, width, points: [point] })
            }}
            onPointerMove={(event) => {
              if (pointer.current !== event.pointerId) return
              const point = at(event)
              if (point) {
                setDraft((value) =>
                  value && value.points.length < 2048
                    ? {
                        ...value,
                        points:
                          tool === 'rectangle'
                            ? [value.points[0], point]
                            : [...value.points, point],
                      }
                    : value
                )
              }
            }}
            onPointerUp={(event) => {
              if (pointer.current !== event.pointerId) return
              const point = at(event)
              pointer.current = null
              if (draft) {
                append(
                  point
                    ? {
                        ...draft,
                        points:
                          tool === 'rectangle'
                            ? [draft.points[0], point]
                            : [...draft.points, point],
                      }
                    : draft
                )
              }
              setDraft(undefined)
            }}
            onPointerCancel={() => {
              pointer.current = null
              setDraft(undefined)
            }}
          >
            {[...marks, ...(draft ? [draft] : [])].map((mark) => (
              <path
                key={mark.id}
                d={markPath(mark, ratio)}
                stroke={kind === 'region' ? 'white' : mark.color}
                strokeWidth={mark.width * Math.min(ratio, 1)}
                strokeLinecap='round'
                strokeLinejoin='round'
                fill={
                  kind === 'region' && mark.tool !== 'brush' ? 'white' : 'none'
                }
                opacity={maskOnly ? 1 : 0.65}
              />
            ))}
          </svg>
        </div>
        <fieldset className='grid grid-cols-2 gap-2 sm:grid-cols-5'>
          <legend>{t('Rectangle coordinates (%)')}</legend>
          {['X', 'Y', 'Width', 'Height'].map((label, index) => (
            <label key={label}>
              {t(label)}
              <Input
                aria-label={`${t('Rectangle')} ${label}`}
                type='number'
                min={0}
                max={100}
                value={coordinates[index] * 100}
                onChange={(e) =>
                  setCoordinates((values) =>
                    values.map((value, i) =>
                      i === index ? Number(e.target.value) / 100 : value
                    )
                  )
                }
              />
            </label>
          ))}
          <Button
            type='button'
            variant='outline'
            disabled={
              coordinates.some(
                (value) => !Number.isFinite(value) || value < 0 || value > 1
              ) ||
              coordinates[2] <= 0 ||
              coordinates[3] <= 0 ||
              coordinates[0] + coordinates[2] > 1 ||
              coordinates[1] + coordinates[3] > 1
            }
            onClick={() =>
              append({
                tool: 'rectangle',
                color,
                width,
                points: [
                  { x: coordinates[0], y: coordinates[1] },
                  {
                    x: coordinates[0] + coordinates[2],
                    y: coordinates[1] + coordinates[3],
                  },
                ],
              })
            }
          >
            {t('Add rectangle')}
          </Button>
        </fieldset>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            disabled={!marks.length}
            onClick={() => {
              const last = marks.at(-1)
              if (!last) return
              setRedo([...redo, last])
              setMarks(marks.slice(0, -1))
            }}
          >
            {t('Undo')}
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={!redo.length}
            onClick={() => {
              const last = redo.at(-1)
              if (!last) return
              setMarks([...marks, last])
              setRedo(redo.slice(0, -1))
            }}
          >
            {t('Redo')}
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={!marks.length}
            onClick={() => {
              setMarks([])
              setRedo([])
            }}
          >
            {t('Clear drawing')}
          </Button>
          <Button
            type='button'
            disabled={
              !marks.length || marks.some((mark) => !validImageMark(mark))
            }
            onClick={() =>
              props.onApply({ referenceID: props.image.id, kind, marks })
            }
          >
            {t('Use drawing')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
