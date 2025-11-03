"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface ValidationIssue {
  row: number;
  column?: string;
  message: string;
}

interface ValidationResult {
  status: string;
  issues: ValidationIssue[];
  counts: {
    totalRows: number;
    ok: number;
    errors: number;
    duplicates: number;
  };
}

export default function BoqPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [ackOverwrite, setAckOverwrite] = useState(false);
  const [versions, setVersions] = useState<
    Array<{
      id: string;
      name: string;
      version: number;
      status: string;
      createdAt: string;
      uploadedBy: string;
    }>
  >([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | "active">(
    "active"
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const fetchVersions = async () => {
    try {
      setLoadingVersions(true);
      const { data } = await apiClient.get("/boq");
      setVersions(data);
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    if (!ackOverwrite) {
      alert(
        "Please acknowledge that this upload will overwrite the current BOQ."
      );
      return;
    }

    const confirmed = window.confirm(
      "This action will completely replace the currently active BOQ with the file you upload.\n\n- All existing BOQ items will be removed and replaced.\n- Previously submitted invoices remain unchanged.\n\nDo you want to continue?"
    );
    if (!confirmed) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await apiClient.post("/boq/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      if (data.status === "ok") {
        alert("BOQ uploaded successfully!");
        setFile(null);
        setAckOverwrite(false);
        fetchVersions();
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        setResult(error.response.data);
      } else {
        alert(
          "Upload failed: " + (error.response?.data?.error || "Unknown error")
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    const params =
      selectedVersion === "active" ? "" : `?version=${selectedVersion}`;
    try {
      const response = await apiClient.get(`/boq/export${params}`, {
        responseType: "blob" as any,
      });
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boq-${
        selectedVersion === "active" ? "active" : "v" + selectedVersion
      }.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Failed to export BOQ: " + (e.response?.data?.error || e.message));
    }
  };

  const activateVersion = async (id: string) => {
    if (
      !confirm(
        "Activate this BOQ version? This will set it as the active version."
      )
    )
      return;
    await apiClient.patch(`/boq/${id}/activate`);
    fetchVersions();
  };

  const exportVersionCsv = async (version: number) => {
    try {
      const response = await apiClient.get(`/boq/export?version=${version}`, {
        responseType: "blob" as any,
      });
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boq-v${version}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Failed to export BOQ: " + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">BOQ Upload</h2>

        <div className="mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">
              Overwrite warning
            </h3>
            <p className="text-sm text-yellow-800">
              Uploading a new BOQ will{" "}
              <span className="font-semibold">completely overwrite</span> the
              currently active BOQ. All existing BOQ items will be replaced.
              Previously submitted invoices remain unchanged because they are
              immutable.
            </p>
          </div>
        </div>

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

        <div className="mb-6 flex items-start gap-2">
          <input
            id="ack-overwrite"
            type="checkbox"
            className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded"
            checked={ackOverwrite}
            onChange={(e) => setAckOverwrite(e.target.checked)}
          />
          <label htmlFor="ack-overwrite" className="text-sm text-gray-700">
            I understand this upload will overwrite the current BOQ entirely.
          </label>
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || uploading || !ackOverwrite}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading..." : "Upload BOQ"}
        </button>

        {result && (
          <div className="mt-6">
            {result.status === "invalid" ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">
                  Validation Errors:
                </h3>
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
            ) : result.status === "ok" ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">
                  Upload Successful!
                </h3>
                <p className="text-sm text-green-800">
                  Processed {result.counts.ok} items successfully.
                </p>
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-10 border-t pt-6">
          <h3 className="text-xl font-semibold mb-4">BOQ Versions</h3>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Version</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Uploaded</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingVersions ? (
                  <tr>
                    <td className="py-3 text-gray-500" colSpan={5}>
                      Loading versions…
                    </td>
                  </tr>
                ) : versions.length === 0 ? (
                  <tr>
                    <td className="py-3 text-gray-500" colSpan={5}>
                      No versions found.
                    </td>
                  </tr>
                ) : (
                  versions.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="py-2 pr-4">v{v.version}</td>
                      <td className="py-2 pr-4">{v.name}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            v.status === "ACTIVE"
                              ? "text-green-700 font-medium"
                              : "text-gray-600"
                          }
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {new Date(v.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 flex gap-2">
                        <Link
                          href={`/dashboard/boq/${v.id}`}
                          className="px-3 py-1 rounded border text-indigo-700 hover:bg-indigo-50"
                        >
                          Details
                        </Link>
                        <button
                          onClick={() => exportVersionCsv(v.version)}
                          className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-50"
                        >
                          Download CSV
                        </button>
                        {v.status !== "ACTIVE" && (
                          <button
                            onClick={() => activateVersion(v.id)}
                            className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-50"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
