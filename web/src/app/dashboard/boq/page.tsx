'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface ValidationIssue {
  row: number
  column?: string
  message: string
}

interface ValidationResult {
  status: string
  issues: ValidationIssue[]
  counts: {
    totalRows: number
    ok: number
    errors: number
    duplicates: number
  }
}

export default function BoqPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const { data } = await apiClient.post('/boq/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      if (data.status === 'ok') {
        alert('BOQ uploaded successfully!')
        setFile(null)
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        setResult(error.response.data)
      } else {
        alert('Upload failed: ' + (error.response?.data?.error || 'Unknown error'))
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/dashboard" className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Smart Invoice Capture</h1>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6">BOQ Upload</h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Excel File (BOQ format)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload BOQ'}
            </button>

            {result && (
              <div className="mt-6">
                {result.status === 'invalid' ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-2">Validation Errors:</h3>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                      {result.issues.map((issue, idx) => (
                        <li key={idx}>
                          Row {issue.row}: {issue.message}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-red-700">
                      Please fix the errors and upload again.
                    </p>
                  </div>
                ) : result.status === 'ok' ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-900 mb-2">Upload Successful!</h3>
                    <p className="text-sm text-green-800">
                      Processed {result.counts.ok} items successfully.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

