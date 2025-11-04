"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";

interface MetricsResponse {
  totals: {
    totalRevenue: number;
    approvedRevenue: number;
    draftPendingRevenue: number;
    totalCount: number;
  };
  largestInvoice?: {
    id: string;
    invoiceNumber?: string | null;
    customerName: string;
    total: number;
    createdAt: string;
  } | null;
  topOperatorsByCount: { userId: string; name: string; count: number }[];
  topOperatorsByAmount: { userId: string; name: string; amount: number }[];
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);
  const previousMetricsRef = useRef<MetricsResponse | null>(null);

  const fetchMetrics = useCallback(async (isPolling = false) => {
    // Only show loading spinner on initial load, not during polling
    if (!isPolling) {
      setLoading(true);
    }
    setError(null);
    try {
      const { data } = await apiClient.get("/invoices/metrics");

      // Only update state if data actually changed (prevents unnecessary re-renders)
      setMetrics((prevMetrics) => {
        if (!prevMetrics) {
          previousMetricsRef.current = data;
          return data;
        }

        // Check if metrics changed
        const totalsChanged =
          prevMetrics.totals.totalRevenue !== data.totals.totalRevenue ||
          prevMetrics.totals.approvedRevenue !== data.totals.approvedRevenue ||
          prevMetrics.totals.draftPendingRevenue !==
            data.totals.draftPendingRevenue ||
          prevMetrics.totals.totalCount !== data.totals.totalCount;

        const largestChanged =
          prevMetrics.largestInvoice?.id !== data.largestInvoice?.id ||
          prevMetrics.largestInvoice?.total !== data.largestInvoice?.total;

        if (totalsChanged || largestChanged) {
          // Show notifications for changes (only during polling)
          if (
            isPolling &&
            !isInitialLoad.current &&
            previousMetricsRef.current
          ) {
            const prev = previousMetricsRef.current;

            // Notify on new invoice count increase
            if (data.totals.totalCount > prev.totals.totalCount) {
              const newCount = data.totals.totalCount - prev.totals.totalCount;
              toast.success(
                `${newCount} new invoice${newCount > 1 ? "s" : ""} received`,
                { duration: 5000 }
              );
            }

            // Notify on revenue changes
            if (data.totals.approvedRevenue > prev.totals.approvedRevenue) {
              const increase =
                data.totals.approvedRevenue - prev.totals.approvedRevenue;
              toast.success(
                `Approved revenue increased by R${increase.toFixed(2)}`,
                { duration: 5000 }
              );
            }
          }

          previousMetricsRef.current = data;
          return data;
        }
        return prevMetrics;
      });
    } catch (error: any) {
      console.error("Failed to load metrics:", error);
      if (error.response?.status === 403) {
        setError(
          "Access denied. Please check your authentication token and try logging in again."
        );
      } else if (error.response?.status === 401) {
        setError("Authentication required. Please log in.");
      } else {
        setError("Failed to load dashboard metrics. Please try again.");
      }
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
      isInitialLoad.current = false;
    }
  }, []);

  useEffect(() => {
    isInitialLoad.current = true;
    fetchMetrics(false);
  }, [fetchMetrics]);

  // Poll for updates every 5 seconds (silently, without loading state)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isInitialLoad.current) {
        fetchMetrics(true); // Pass true to indicate this is polling
      }
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center text-gray-500">Loading metrics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-red-800">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="grid grid-cols-1 gap-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow min-h-[100px] flex flex-col justify-center">
            <div className="text-sm text-gray-500">Total revenue</div>
            <div
              className="text-2xl font-bold truncate"
              title={metrics?.totals.totalRevenue.toFixed(2) ?? "0.00"}
            >
              R{metrics?.totals.totalRevenue.toFixed(2) ?? "0.00"}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow min-h-[100px] flex flex-col justify-center">
            <div className="text-sm text-gray-500">Approved revenue</div>
            <div
              className="text-2xl font-bold truncate"
              title={metrics?.totals.approvedRevenue.toFixed(2) ?? "0.00"}
            >
              R{metrics?.totals.approvedRevenue.toFixed(2) ?? "0.00"}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow min-h-[100px] flex flex-col justify-center">
            <div className="text-sm text-gray-500">Draft/Pending revenue</div>
            <div
              className="text-2xl font-bold truncate"
              title={metrics?.totals.draftPendingRevenue.toFixed(2) ?? "0.00"}
            >
              R{metrics?.totals.draftPendingRevenue.toFixed(2) ?? "0.00"}
            </div>
          </div>
        </div>

        {/* Largest invoice */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Largest invoice</div>
              <div className="text-xl font-semibold">
                {metrics?.largestInvoice
                  ? `${
                      metrics.largestInvoice.invoiceNumber ||
                      metrics.largestInvoice.id
                    } — R${metrics.largestInvoice.total.toFixed(2)}`
                  : "No data"}
              </div>
              {metrics?.largestInvoice && (
                <div className="text-gray-600 text-sm">
                  {metrics.largestInvoice.customerName}
                </div>
              )}
            </div>
            <Link
              href="/dashboard/invoices"
              className="text-indigo-600 text-sm"
            >
              View invoices
            </Link>
          </div>
        </div>

        {/* Operator rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-lg font-semibold mb-3">
              Top operators by invoice count
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Operator</th>
                  <th className="py-2 pr-4">Count</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.topOperatorsByCount?.length ? (
                  metrics.topOperatorsByCount.map((o) => (
                    <tr key={o.userId} className="border-t">
                      <td className="py-2 pr-4">{o.name}</td>
                      <td className="py-2 pr-4">{o.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2 text-gray-500" colSpan={2}>
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-lg font-semibold mb-3">
              Top operators by revenue
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Operator</th>
                  <th className="py-2 pr-4">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.topOperatorsByAmount?.length ? (
                  metrics.topOperatorsByAmount.map((o) => (
                    <tr key={o.userId} className="border-t">
                      <td className="py-2 pr-4">{o.name}</td>
                      <td className="py-2 pr-4">R{o.amount.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2 text-gray-500" colSpan={2}>
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/boq"
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition"
          >
            <h3 className="text-lg font-semibold mb-2">BOQ Management</h3>
            <p className="text-gray-600 text-sm">
              Upload and manage Bill of Quantities
            </p>
          </Link>
          <Link
            href="/dashboard/invoices"
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition"
          >
            <h3 className="text-lg font-semibold mb-2">Invoices</h3>
            <p className="text-gray-600 text-sm">
              Review and approve submitted invoices
            </p>
          </Link>
          <Link
            href="/dashboard/settings"
            className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition"
          >
            <h3 className="text-lg font-semibold mb-2">Settings</h3>
            <p className="text-gray-600 text-sm">
              Company settings and configuration
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
