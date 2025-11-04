"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  date: string;
  customerName: string;
  projectSite: string | null;
  preparedBy: string | null;
  status: string;
  subtotal: string | null;
  vatPercent: string | null;
  vatAmount: string | null;
  total: string | null;
  rejectionReason: string | null;
  serverPdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: Array<{
    id: string;
    itemName: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
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
  const isInitialLoad = useRef(true);
  const previousInvoicesRef = useRef<Map<string, Invoice>>(new Map());

  const fetchInvoices = useCallback(
    async (isPolling = false) => {
      if (!user) return;

      try {
        // Only show loading spinner on initial load, not during polling
        if (!isPolling) {
          setLoading(true);
        }
        setError(null);
        const params = new URLSearchParams();
        if (statusFilter) {
          params.append("status", statusFilter);
        }
        const { data } = await apiClient.get<InvoicesResponse>(
          `/invoices?${params.toString()}`
        );

        // Only update state if data actually changed (prevents unnecessary re-renders)
        setInvoices((prevInvoices) => {
          const prevIds = new Set(prevInvoices.map((inv) => inv.id));
          const newIds = new Set(data.invoices.map((inv) => inv.id));

          // Check if invoices changed
          if (
            prevInvoices.length !== data.invoices.length ||
            ![...prevIds].every((id) => newIds.has(id)) ||
            prevInvoices.some((prevInv) => {
              const newInv = data.invoices.find((inv) => inv.id === prevInv.id);
              return (
                !newInv ||
                prevInv.status !== newInv.status ||
                prevInv.updatedAt !== newInv.updatedAt
              );
            })
          ) {
            // Detect changes for notifications (only during polling)
            if (isPolling && !isInitialLoad.current) {
              const prevMap = previousInvoicesRef.current;

              // Find new invoices
              data.invoices.forEach((newInv) => {
                if (!prevMap.has(newInv.id)) {
                  toast.success(
                    `New invoice: ${
                      newInv.invoiceNumber ||
                      `Draft-${newInv.id.substring(0, 8)}`
                    }`,
                    { duration: 5000 }
                  );
                } else {
                  // Check for status changes
                  const prevInv = prevMap.get(newInv.id);
                  if (prevInv && prevInv.status !== newInv.status) {
                    const statusLabels: Record<string, string> = {
                      DRAFT: "Draft",
                      SUBMITTED: "Submitted",
                      APPROVED: "Approved",
                      REJECTED: "Rejected",
                      FINAL: "Final",
                    };
                    toast(
                      `Invoice ${
                        newInv.invoiceNumber || newInv.id.substring(0, 8)
                      } status changed: ${
                        statusLabels[prevInv.status] || prevInv.status
                      } → ${statusLabels[newInv.status] || newInv.status}`,
                      {
                        duration: 5000,
                        icon: "ℹ️",
                      }
                    );
                  }
                }
              });

              // Update previous invoices map
              previousInvoicesRef.current = new Map(
                data.invoices.map((inv) => [inv.id, inv])
              );
            } else if (!isPolling) {
              // Initialize previous invoices map on first load
              previousInvoicesRef.current = new Map(
                data.invoices.map((inv) => [inv.id, inv])
              );
            }

            return data.invoices;
          }
          return prevInvoices;
        });
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load invoices");
        if (!isPolling) {
          setInvoices([]);
        }
      } finally {
        if (!isPolling) {
          setLoading(false);
        }
        isInitialLoad.current = false;
      }
    },
    [user, statusFilter]
  );

  useEffect(() => {
    isInitialLoad.current = true;
    fetchInvoices(false);
  }, [statusFilter]); // Reset on filter change

  // Poll for updates every 5 seconds (silently, without loading state)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (!isInitialLoad.current) {
        fetchInvoices(true); // Pass true to indicate this is polling
      }
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [user, fetchInvoices]);

  const handleApprove = async (id: string) => {
    if (!confirm("Are you sure you want to approve this invoice?")) return;

    try {
      await apiClient.post(`/invoices/${id}/approve`);
      alert("Invoice approved successfully!");
      fetchInvoices(false); // Refresh list
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
      fetchInvoices(false); // Refresh list
    } catch (error: any) {
      alert(
        "Failed to reject: " + (error.response?.data?.error || "Unknown error")
      );
    }
  };

  return (
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
              onClick={() => fetchInvoices(false)}
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
            No invoices found. Invoices submitted by field operators will appear
            here.
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
                      {invoice.invoiceNumber ||
                        `Draft-${invoice.id.substring(0, 8)}`}
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
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded shadow-sm ${
                          invoice.status === "DRAFT"
                            ? "bg-blue-400 text-blue-900"
                            : invoice.status === "SUBMITTED"
                            ? "bg-amber-400 text-amber-900"
                            : invoice.status === "APPROVED"
                            ? "bg-emerald-400 text-emerald-900"
                            : invoice.status === "REJECTED"
                            ? "bg-red-400 text-red-900"
                            : invoice.status === "FINAL"
                            ? "bg-emerald-400 text-emerald-900"
                            : "bg-gray-300 text-gray-800"
                        }`}
                      >
                        {invoice.status}
                      </span>
                      {invoice.rejectionReason &&
                        invoice.status === "DRAFT" && (
                          <div
                            className="mt-1 text-xs text-red-600 max-w-xs truncate"
                            title={invoice.rejectionReason}
                          >
                            {invoice.rejectionReason}
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {(() => {
                        // Calculate total including VAT
                        let calculatedTotal = 0;

                        if (invoice.total) {
                          // Use stored total (already includes VAT)
                          calculatedTotal = parseFloat(invoice.total);
                        } else if (invoice.lines && invoice.lines.length > 0) {
                          // Calculate from line items and add VAT
                          const subtotal = invoice.lines.reduce((sum, line) => {
                            const qty = parseFloat(line.quantity) || 0;
                            const price = parseFloat(line.unitPrice) || 0;
                            return sum + qty * price;
                          }, 0);

                          // Calculate VAT (default 15% if not specified)
                          const vatPercent = invoice.vatPercent
                            ? parseFloat(invoice.vatPercent)
                            : 15;
                          const vatAmount = subtotal * (vatPercent / 100);

                          // Total including VAT
                          calculatedTotal = subtotal + vatAmount;
                        }

                        const formattedTotal =
                          calculatedTotal > 0
                            ? `R ${calculatedTotal.toFixed(2)}`
                            : "-";

                        return (
                          <span
                            className="truncate max-w-[120px] inline-block"
                            title={calculatedTotal > 0 ? formattedTotal : ""}
                          >
                            {formattedTotal}
                          </span>
                        );
                      })()}
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
                        {invoice.status === "FINAL" && invoice.serverPdfUrl && (
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
  );
}
