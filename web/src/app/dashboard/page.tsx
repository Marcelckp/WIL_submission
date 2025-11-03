"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

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

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get("/invoices/metrics");
        setMetrics(data);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="grid grid-cols-1 gap-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">Total revenue</div>
            <div className="text-2xl font-bold">
              R{metrics?.totals.totalRevenue.toFixed(2) ?? "0.00"}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">Approved revenue</div>
            <div className="text-2xl font-bold">
              R{metrics?.totals.approvedRevenue.toFixed(2) ?? "0.00"}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">Draft/Pending revenue</div>
            <div className="text-2xl font-bold">
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
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Settings</h3>
            <p className="text-gray-600 text-sm">
              Company settings and configuration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
