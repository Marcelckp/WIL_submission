"use client";

import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to Admin Dashboard
        </h2>
        <p className="text-gray-600 mb-6">
          Manage BOQ uploads, review invoices, and approve/reject submissions.
        </p>
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
