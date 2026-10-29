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
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

interface ImageAuditRow {
  job_id: string
  user_id: number
  model: string
  user_prompt: string
  model_prompt: string
  parameters: string
  input_hashes: string
  output_hash: string
  review: string
  channel_id: number
  state: string
  created_at: number
}

export function ImageAudit() {
  const { t } = useTranslation()
  const [before, setBefore] = useState<number>()
  const [beforeID, setBeforeID] = useState<string>()
  const [user, setUser] = useState('')
  const rows = useQuery({
    queryKey: ['studio-image-audit', before, beforeID, user],
    queryFn: async () =>
      (
        await api.get<{ data: ImageAuditRow[] }>('/api/image-studio-audit', {
          params: {
            before,
            before_job_id: beforeID,
            user_id: user || undefined,
          },
        })
      ).data.data,
  })
  return (
    <Main className='space-y-4'>
      <h1 className='text-2xl font-semibold'>{t('Image output audit')}</h1>
      <p className='text-muted-foreground'>
        {t(
          'Prompts, parameters, image hashes and review decisions are retained for 30 days. Image bytes are excluded.'
        )}
      </p>
      <label className='block max-w-xs'>
        {t('User ID')}
        <Input
          type='number'
          min={1}
          value={user}
          onChange={(e) => {
            setUser(e.target.value)
            setBefore(undefined)
            setBeforeID(undefined)
          }}
        />
      </label>
      {rows.isError && (
        <p role='alert'>
          {t('Image auditing is unavailable. No image was released.')}
        </p>
      )}
      {rows.isPending && <p role='status'>{t('Loading...')}</p>}
      {rows.data?.length === 0 && <p>{t('No image audit records.')}</p>}
      {rows.data?.map((row) => (
        <details key={row.job_id} className='rounded-xl border p-4'>
          <summary className='cursor-pointer break-all'>
            {new Date(row.created_at).toLocaleString()} Â· {row.model} Â·{' '}
            {row.state} Â· #{row.user_id} Â· {row.job_id}
          </summary>
          <dl className='mt-3 grid gap-2 text-sm'>
            {(
              [
                ['User instruction', row.user_prompt],
                ['Model instruction', row.model_prompt],
                ['Parameters', row.parameters],
                ['Input hashes', row.input_hashes],
                ['Output hash', row.output_hash],
                ['Output review', row.review],
                ['Channel ID', String(row.channel_id)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className='font-medium'>{t(label)}</dt>
                <dd className='text-muted-foreground break-all whitespace-pre-wrap'>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
      <div className='flex gap-2'>
        <Button
          variant='outline'
          onClick={() => {
            setBefore(undefined)
            setBeforeID(undefined)
            void rows.refetch()
          }}
        >
          {t('Refresh')}
        </Button>
        <Button
          variant='outline'
          disabled={!rows.data?.length || rows.data.length < 100}
          onClick={() => {
            const last = rows.data?.at(-1)
            if (last) {
              setBefore(last.created_at)
              setBeforeID(last.job_id)
            }
          }}
        >
          {t('Older records')}
        </Button>
      </div>
    </Main>
  )
}
