"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api";

interface Company {
  id: string;
  name: string;
  vatNumber: string | null;
  address: string | null;
  logoUrl: string | null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const [company, setCompany] = useState<Company | null>(null);
  const [logoError, setLogoError] = useState(false);

  // Prevent hydration mismatches by waiting until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/login");
    }
  }, [mounted, isAuthenticated, router]);

  // Fetch company data including logo URL
  useEffect(() => {
    if (mounted && isAuthenticated) {
      const fetchCompany = async () => {
        try {
          const { data } = await apiClient.get<Company>("/company");
          setCompany(data);
        } catch (error) {
          console.error("Failed to fetch company:", error);
        }
      };
      fetchCompany();
    }
  }, [mounted, isAuthenticated]);

  if (!mounted) return null;
  if (!isAuthenticated) return null;

  // Determine active link based on current pathname
  const isDashboardActive = pathname === "/dashboard";
  const isBoqActive = pathname?.startsWith("/dashboard/boq");
  const isInvoicesActive = pathname?.startsWith("/dashboard/invoices");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="flex items-center">
                  {company?.logoUrl && !logoError ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name || "Company Logo"}
                      className="h-10 w-auto max-w-[200px] object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <h1 className="text-xl font-bold text-gray-900">
                      Smart Invoice Capture
                    </h1>
                  )}
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className={`${
                    isDashboardActive
                      ? "border-indigo-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/boq"
                  className={`${
                    isBoqActive
                      ? "border-indigo-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  BOQ Management
                </Link>
                <Link
                  href="/dashboard/invoices"
                  className={`${
                    isInvoicesActive
                      ? "border-indigo-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Invoices
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700 mr-4">{user?.name}</span>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
