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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { ImageAudit } from '../components/image-audit'

test('audit details expose the original instruction and blocked reason; filtering shows only the requested account', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValueOnce({
      data: {
        data: [
          {
            job_id: 'reviewed-job',
            user_id: 7,
            model: 'qwen-image-2.1',
            user_prompt: '<b>Original instruction</b>',
            model_prompt: 'Prepared model instruction',
            parameters: '{"seed":0}',
            input_hashes: '[]',
            output_hash: 'final-png-hash',
            review: '{"decision":"block"}',
            channel_id: 10,
            state: 'failed',
            error: 'output_blocked',
            created_at: 1,
          },
        ],
      },
    })
    .mockResolvedValue({ data: { data: [] } })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ImageAudit />
    </QueryClientProvider>
  )
  fireEvent.click(await screen.findByText(/reviewed-job/))
  expect(screen.getByText('<b>Original instruction</b>')).toBeVisible()
  expect(screen.getByText('Prepared model instruction')).toBeVisible()
  expect(screen.getByText('output_blocked')).toBeVisible()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Older records' })).toBeDisabled()
  fireEvent.change(screen.getByRole('spinbutton', { name: 'User ID' }), {
    target: { value: '8' },
  })
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith('/api/image-studio-audit', {
      params: { before: undefined, before_job_id: undefined, user_id: '8' },
    })
  )
  expect(await screen.findByText('No image audit records.')).toBeVisible()
  expect(
    screen.queryByText('<b>Original instruction</b>')
  ).not.toBeInTheDocument()
  client.clear()
})
