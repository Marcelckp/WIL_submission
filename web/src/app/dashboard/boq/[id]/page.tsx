'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api'

interface BoqItem {
  sapNumber: string
  shortDescription: string
  unit: string
  rate: string
  category?: string | null
}

interface BoqDetailsResponse {
  id: string
  name: string
  version: number
  status: string
  createdAt: string
  uploadedBy: string
  counts: { totalItems: number; filtered: number }
  items: BoqItem[]
  limit: number
  offset: number
  q: string
}

export default function BoqDetailsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<BoqDetailsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)

  const fetchDetails = async () => {
    if (!params?.id) return
    setLoading(true)
    try {
      const { data } = await apiClient.get(`/boq/${params.id}`, { params: { q, limit, offset } })
      setData(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id, q, limit, offset])

  const canPrev = offset > 0
  const canNext = data ? offset + data.items.length < data.counts.filtered : false

  const exportCsv = async () => {
    if (!data) return
    try {
      const response = await apiClient.get(`/boq/export?version=${data.version}`, { responseType: 'blob' as any })
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `boq-v${data.version}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Failed to export CSV: ' + (e.response?.data?.error || e.message))
    }
  }

  const activate = async () => {
    if (!data) return
    if (!confirm('Activate this BOQ version? This will set it as the active BOQ.')) return
    await apiClient.patch(`/boq/${data.id}/activate`)
    fetchDetails()
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">BOQ v{data?.version}</h2>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="px-3 py-1.5 rounded bg-gray-700 text-white hover:bg-gray-800">Download CSV</button>
            {data?.status !== 'ACTIVE' && (
              <button onClick={activate} className="px-3 py-1.5 rounded border text-gray-700 hover:bg-gray-50">Activate</button>
            )}
            <Link href="/dashboard/boq" className="px-3 py-1.5 rounded border text-gray-700 hover:bg-gray-50">Back</Link>
          </div>
        </div>

        {data && (
          <div className="mb-6 text-sm text-gray-700">
            <div className="flex gap-6">
              <div><span className="text-gray-500">Status:</span> <span className={data.status === 'ACTIVE' ? 'text-green-700 font-medium' : ''}>{data.status}</span></div>
              <div><span className="text-gray-500">Items:</span> {data.counts.totalItems.toLocaleString()}</div>
              <div><span className="text-gray-500">Created:</span> {new Date(data.createdAt).toLocaleString()}</div>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => { setOffset(0); setQ(e.target.value) }}
            placeholder="Search SAP / description / unit / category"
            className="border rounded px-3 py-2 text-sm w-full max-w-md"
          />
          <select className="border rounded px-2 py-2 text-sm" value={limit} onChange={(e) => { setOffset(0); setLimit(Number(e.target.value)) }}>
            {[25,50,100,200].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2 pr-4">SAP #</th>
                <th className="py-2 pr-4">Short Description</th>
                <th className="py-2 pr-4">Unit</th>
                <th className="py-2 pr-4">Rate</th>
                <th className="py-2 pr-4">Category</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="py-3 text-gray-500" colSpan={5}>Loading…</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td className="py-3 text-gray-500" colSpan={5}>No items</td></tr>
              ) : (
                data.items.map((i) => (
                  <tr key={i.sapNumber + i.shortDescription} className="border-t">
                    <td className="py-2 pr-4">{i.sapNumber}</td>
                    <td className="py-2 pr-4">{i.shortDescription}</td>
                    <td className="py-2 pr-4">{i.unit}</td>
                    <td className="py-2 pr-4">{i.rate}</td>
                    <td className="py-2 pr-4">{i.category || ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <div>
            Showing {data ? Math.min(data.items.length, limit) : 0} of {data?.counts.filtered ?? 0}
          </div>
          <div className="flex gap-2">
            <button disabled={!canPrev} onClick={() => setOffset(Math.max(offset - limit, 0))} className={`px-3 py-1.5 rounded border ${canPrev ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}>Previous</button>
            <button disabled={!canNext} onClick={() => setOffset(offset + limit)} className={`px-3 py-1.5 rounded border ${canNext ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 cursor-not-allowed'}`}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}


