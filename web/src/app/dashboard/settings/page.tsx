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

interface Company {
  id: string;
  name: string;
  vatNumber: string | null;
  address: string | null;
  logoUrl: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [operators, setOperators] = useState<UserRow[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ userId: string; tempPassword: string } | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    vatNumber: "",
    address: "",
    logoUrl: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [operatorsRes, companyRes] = await Promise.all([
        apiClient.get("/users", { params: { role: "FIELD" } }),
        apiClient.get("/company"),
      ]);
      setOperators(operatorsRes.data);
      const comp = companyRes.data;
      setCompany(comp);
      setCompanyForm({
        name: comp.name || "",
        vatNumber: comp.vatNumber || "",
        address: comp.address || "",
        logoUrl: comp.logoUrl || "",
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetPassword = async (userId: string) => {
    if (!confirm("Reset this operator's password? A temporary password will be generated.")) return;
    const { data } = await apiClient.post(`/users/${userId}/reset-password`);
    setResetInfo(data);
  };

  const saveCompany = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.patch("/company", companyForm);
      setCompany(data);
      alert("Company settings saved successfully!");
    } catch (error: any) {
      alert("Failed to save: " + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Company Settings */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Company Settings</h2>
        <p className="text-gray-600 mb-6">Manage company profile and VAT information.</p>

        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Company Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              VAT Number
            </label>
            <input
              type="text"
              value={companyForm.vatNumber}
              onChange={(e) => setCompanyForm({ ...companyForm, vatNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="VAT Number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              value={companyForm.address}
              onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Company Address"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logo URL
            </label>
            <input
              type="url"
              value={companyForm.logoUrl}
              onChange={(e) => setCompanyForm({ ...companyForm, logoUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter a URL to your company logo (will be used in PDF invoices)
            </p>
          </div>

          <button
            onClick={saveCompany}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Company Settings"}
          </button>
        </div>
      </div>

      {/* Operator Management */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Operator Management</h2>
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
