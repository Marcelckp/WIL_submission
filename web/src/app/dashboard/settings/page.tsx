"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const [operators, setOperators] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ userId: string; tempPassword: string } | null>(null);

  const fetchOperators = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/users", { params: { role: "FIELD" } });
      setOperators(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const resetPassword = async (userId: string) => {
    if (!confirm("Reset this operator's password? A temporary password will be generated.")) return;
    const { data } = await apiClient.post(`/users/${userId}/reset-password`);
    setResetInfo(data);
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        <p className="text-gray-600 mb-6">Manage operators and reset passwords.</p>

        <h3 className="text-xl font-semibold mb-3">Operators</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="py-3 text-gray-500" colSpan={5}>Loading…</td></tr>
              ) : operators.length === 0 ? (
                <tr><td className="py-3 text-gray-500" colSpan={5}>No operators found.</td></tr>
              ) : (
                operators.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="py-2 pr-4">{u.name}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">{u.role}</td>
                    <td className="py-2 pr-4">{u.active ? "Active" : "Inactive"}</td>
                    <td className="py-2 pr-4">
                      <button onClick={() => resetPassword(u.id)} className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-50">Reset password</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {resetInfo && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-4 text-sm">
            <div className="font-semibold text-yellow-900 mb-1">Temporary password generated</div>
            <div className="text-yellow-800">User ID: {resetInfo.userId}</div>
            <div className="text-yellow-800">Temp password: <span className="font-mono">{resetInfo.tempPassword}</span></div>
            <div className="text-yellow-700 mt-2">Share this with the operator and ask them to sign in and change it.</div>
          </div>
        )}
      </div>
    </div>
  );
}


