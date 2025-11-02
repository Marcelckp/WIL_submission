"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  date: string;
  customerName: string;
  projectSite: string | null;
  preparedBy: string | null;
  status: string;
  subtotal: string | null;
  vatAmount: string | null;
  total: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  limit: number;
  offset: number;
}

export default function InvoicesPage() {
  const user = useAuthStore((state) => state.user);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchInvoices = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append("status", statusFilter);
      }
      const { data } = await apiClient.get<InvoicesResponse>(
        `/invoices?${params.toString()}`
      );
      setInvoices(data.invoices);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load invoices");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleApprove = async (id: string) => {
    if (!confirm("Are you sure you want to approve this invoice?")) return;

    try {
      await apiClient.post(`/invoices/${id}/approve`);
      alert("Invoice approved successfully!");
      fetchInvoices(); // Refresh list
    } catch (error: any) {
      alert(
        "Failed to approve: " + (error.response?.data?.error || "Unknown error")
      );
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason (required):");
    if (!reason || reason.trim() === "") {
      alert("Rejection reason is required");
      return;
    }

    try {
      await apiClient.post(`/invoices/${id}/reject`, { reason: reason.trim() });
      alert("Invoice rejected");
      fetchInvoices(); // Refresh list
    } catch (error: any) {
      alert(
        "Failed to reject: " + (error.response?.data?.error || "Unknown error")
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/dashboard" className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">
                  Smart Invoice Capture
                </h1>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Invoices</h2>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700">Filter:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                >
                  <option value="">All</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="FINAL">Final</option>
                </select>
                <button
                  onClick={fetchInvoices}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Refresh
                </button>
              </div>
            </div>
            {error && (
              <div className="px-6 py-4 bg-red-50 border-b border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                Loading invoices...
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No invoices found. Invoices submitted by field operators will
                appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Project/Site
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Prepared By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoice.invoiceNumber || "Pending"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {invoice.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoice.customerName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {invoice.projectSite || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {invoice.preparedBy || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              invoice.status === "SUBMITTED"
                                ? "bg-yellow-100 text-yellow-800"
                                : invoice.status === "APPROVED"
                                ? "bg-green-100 text-green-800"
                                : invoice.status === "REJECTED"
                                ? "bg-red-100 text-red-800"
                                : invoice.status === "FINAL"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {invoice.status}
                          </span>
                          {invoice.rejectionReason && (
                            <div
                              className="mt-1 text-xs text-red-600 max-w-xs truncate"
                              title={invoice.rejectionReason}
                            >
                              {invoice.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {invoice.total
                            ? `R ${parseFloat(invoice.total).toFixed(2)}`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            {invoice.status === "SUBMITTED" &&
                              user?.role === "ADMIN" && (
                                <>
                                  <button
                                    onClick={() => handleApprove(invoice.id)}
                                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(invoice.id)}
                                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            {invoice.status === "FINAL" &&
                              invoice.serverPdfUrl && (
                                <a
                                  href={invoice.serverPdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                >
                                  View PDF
                                </a>
                              )}
                            <Link
                              href={`/dashboard/invoices/${invoice.id}`}
                              className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                            >
                              Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
