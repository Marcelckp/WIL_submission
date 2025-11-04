"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api";

interface InvoiceLine {
  id: string;
  itemName: string;
  description: string | null;
  unit: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

interface Media {
  id: string;
  url: string;
  mimeType: string;
  source: string;
  createdAt: string;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  date: string;
  customerName: string;
  projectSite: string | null;
  preparedBy: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FINAL";
  subtotal: string | null;
  vatPercent: string | null;
  vatAmount: string | null;
  total: string | null;
  rejectionReason: string | null;
  serverPdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lines: InvoiceLine[];
  media: Media[];
  comments: Comment[];
  company: {
    id: string;
    name: string;
    vatNumber: string | null;
    address: string | null;
  };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");

  const fetchInvoiceDetails = useCallback(async () => {
    if (!user || !invoiceId) return;

    try {
      setError(null);
      setLoading(true);
      const { data } = await apiClient.get<Invoice>(`/invoices/${invoiceId}`);
      
      // Validate required fields
      if (!data) {
        throw new Error("Invoice data is empty");
      }
      
      if (!data.company) {
        throw new Error("Company information is missing");
      }
      
      // Ensure arrays are initialized if backend returns null/undefined
      const invoiceData: Invoice = {
        ...data,
        lines: data.lines || [],
        media: data.media || [],
        comments: data.comments || [],
      };
      
      setInvoice(invoiceData);
      setLastUpdateTime(new Date(data.updatedAt).getTime());
    } catch (err: any) {
      console.error("Error fetching invoice:", err);
      let errorMessage = "Failed to load invoice details";
      
      if (err.response) {
        // Server responded with error status
        if (err.response.status === 404) {
          errorMessage = "Invoice not found";
        } else if (err.response.status === 403) {
          errorMessage = "You don't have permission to view this invoice";
        } else if (err.response.data?.error) {
          errorMessage = err.response.data.error;
        } else {
          errorMessage = `Server error: ${err.response.status}`;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user, invoiceId]);

  const checkForUpdates = useCallback(async () => {
    if (!user || !invoiceId || !invoice) return;

    try {
      const { data } = await apiClient.get<{
        changed: boolean;
        lastUpdatedAt: number;
        status: string;
        comments: Comment[];
        serverPdfUrl: string | null;
      }>(`/invoices/${invoiceId}/updates?since=${lastUpdateTime}`);

      if (data.changed) {
        // Refresh full invoice data
        fetchInvoiceDetails();
      } else if (data.comments.length > 0) {
        // Only comments changed, update comments list
        // Filter out duplicates by comment ID before merging
        setInvoice((prev) => {
          if (!prev) return null;
          
          const existingCommentIds = new Set(prev.comments.map(c => c.id));
          const newComments = data.comments.filter(c => !existingCommentIds.has(c.id));
          
          // Update lastUpdateTime to prevent re-fetching the same comments
          setLastUpdateTime(data.lastUpdatedAt);
          
          if (newComments.length === 0) {
            // No new comments, return previous state unchanged
            return prev;
          }
          
          return {
            ...prev,
            comments: [...prev.comments, ...newComments].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            ),
          };
        });
      }
    } catch (err) {
      // Silently fail polling
      console.error("Polling error:", err);
    }
  }, [user, invoiceId, invoice, lastUpdateTime, fetchInvoiceDetails]);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [fetchInvoiceDetails]);

  // Poll for updates every 5 seconds
  useEffect(() => {
    if (!invoice) return;

    const interval = setInterval(() => {
      checkForUpdates();
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [invoice, checkForUpdates]);

  const handleApprove = async () => {
    if (!confirm("Are you sure you want to approve this invoice?")) return;

    try {
      setActionLoading(true);
      await apiClient.post(`/invoices/${invoiceId}/approve`);
      alert("Invoice approved successfully!");
      fetchInvoiceDetails();
    } catch (error: any) {
      alert(
        "Failed to approve: " + (error.response?.data?.error || "Unknown error")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Enter rejection reason (required):");
    if (!reason || reason.trim() === "") {
      alert("Rejection reason is required");
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post(`/invoices/${invoiceId}/reject`, {
        reason: reason.trim(),
      });
      alert("Invoice rejected");
      fetchInvoiceDetails();
    } catch (error: any) {
      alert(
        "Failed to reject: " + (error.response?.data?.error || "Unknown error")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      alert("Please enter a comment");
      return;
    }

    try {
      setSubmittingComment(true);
      const { data } = await apiClient.post<Comment>(
        `/invoices/${invoiceId}/comments`,
        { body: commentText.trim() }
      );

      setInvoice((prev) =>
        prev
          ? {
              ...prev,
              comments: [...prev.comments, data].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              ),
            }
          : null
      );
      setCommentText("");
    } catch (error: any) {
      alert(
        "Failed to add comment: " +
          (error.response?.data?.error || "Unknown error")
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) {
      alert("Please enter an email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress.trim())) {
      alert("Please enter a valid email address");
      return;
    }

    try {
      setSendingEmail(true);
      await apiClient.post(`/invoices/${invoiceId}/email`, {
        to: emailAddress.trim(),
      });
      alert("Email sent successfully!");
      setEmailDialogOpen(false);
      setEmailAddress("");
    } catch (error: any) {
      alert(
        "Failed to send email: " +
          (error.response?.data?.error || "Unknown error")
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-blue-400 text-blue-900 font-bold shadow-md rounded";
      case "SUBMITTED":
        return "bg-amber-400 text-amber-900 font-bold shadow-md rounded";
      case "APPROVED":
      case "FINAL":
        return "bg-emerald-400 text-emerald-900 font-bold shadow-md rounded";
      case "REJECTED":
        return "bg-red-400 text-red-900 font-bold shadow-md rounded";
      default:
        return "bg-gray-300 text-gray-800 font-bold shadow-md rounded";
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center text-gray-500">Loading invoice...</div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-red-600">
            {error || "Invoice not found"}
          </div>
          <button
            onClick={() => router.push("/dashboard/invoices")}
            className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-4">
        <button
          onClick={() => router.push("/dashboard/invoices")}
          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
        >
          ← Back to Invoices
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Invoice {invoice.invoiceNumber || "Draft"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Created: {formatDate(invoice.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`px-2 py-1 inline-flex text-sm leading-5 font-semibold rounded ${getStatusBadgeClass(
                  invoice.status
                )}`}
              >
                {invoice.status}
              </span>
              {/* Only show rejection reason for DRAFT invoices */}
              {invoice.status === "DRAFT" && 
               invoice.rejectionReason && 
               invoice.rejectionReason.trim() !== "" && (
                <p className="mt-2 text-sm text-red-600 max-w-xs">
                  {invoice.rejectionReason}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {invoice.status === "SUBMITTED" && user?.role === "ADMIN" && (
          <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? "Processing..." : "Approve Invoice"}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Reject Invoice
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Invoice Information
              </h2>
              <dl className="grid grid-cols-1 gap-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Date</dt>
                  <dd className="text-sm text-gray-900">{formatDate(invoice.date)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer</dt>
                  <dd className="text-sm text-gray-900">{invoice.customerName}</dd>
                </div>
                {invoice.projectSite && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Project/Site
                    </dt>
                    <dd className="text-sm text-gray-900">{invoice.projectSite}</dd>
                  </div>
                )}
                {invoice.preparedBy && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Prepared By
                    </dt>
                    <dd className="text-sm text-gray-900">{invoice.preparedBy}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Company Information
              </h2>
              <dl className="grid grid-cols-1 gap-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Company</dt>
                  <dd className="text-sm text-gray-900">{invoice.company.name}</dd>
                </div>
                {invoice.company.vatNumber && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">VAT Number</dt>
                    <dd className="text-sm text-gray-900">{invoice.company.vatNumber}</dd>
                  </div>
                )}
                {invoice.company.address && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Address</dt>
                    <dd className="text-sm text-gray-900">{invoice.company.address}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Line Items
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {line.itemName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {line.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {line.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {parseFloat(line.quantity).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        R {parseFloat(line.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        R {parseFloat(line.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="mb-6 flex justify-end">
            <div className="w-full md:w-1/3">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900 font-medium">
                    R{" "}
                    {invoice.subtotal
                      ? parseFloat(invoice.subtotal).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
                {invoice.vatPercent && parseFloat(invoice.vatPercent) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      VAT ({invoice.vatPercent}%)
                    </span>
                    <span className="text-gray-900 font-medium">
                      R{" "}
                      {invoice.vatAmount
                        ? parseFloat(invoice.vatAmount).toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-300">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">
                    R{" "}
                    {invoice.total ? parseFloat(invoice.total).toFixed(2) : "0.00"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Media */}
          {invoice.media.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Attachments ({invoice.media.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {invoice.media.map((media) => (
                  <div key={media.id} className="relative">
                    <img
                      src={media.url}
                      alt="Invoice attachment"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Comments ({invoice.comments.length})
            </h2>
            <div className="space-y-4 mb-4">
              {invoice.comments.length === 0 ? (
                <p className="text-sm text-gray-500">No comments yet.</p>
              ) : (
                invoice.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {comment.author.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-gray-200 pt-4">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
              />
              <button
                onClick={handleAddComment}
                disabled={submittingComment || !commentText.trim()}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {submittingComment ? "Adding..." : "Add Comment"}
              </button>
            </div>
          </div>

          {/* PDF Link and Email */}
          {(invoice.status === "FINAL" || invoice.status === "APPROVED") &&
            invoice.serverPdfUrl && (
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center space-x-3">
                  <a
                    href={invoice.serverPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    View/Download PDF
                  </a>
                  <button
                    onClick={() => setEmailDialogOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Send Email
                  </button>
                </div>
              </div>
            )}

          {/* Email Dialog */}
          {emailDialogOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">Send Invoice Email</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleSendEmail();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setEmailDialogOpen(false);
                      setEmailAddress("");
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !emailAddress.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {sendingEmail ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

