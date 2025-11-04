package com.smartinvoice.app.data.remote.models

data class InvoiceLineRequest(
    val itemName: String,
    val description: String? = null,
    val unit: String,
    val unitPrice: String,
    val quantity: String,
    val amount: String? = null
)

data class CreateInvoiceRequest(
    val date: String,
    val customerName: String,
    val customerEmail: String? = null,
    val projectSite: String? = null,
    val preparedBy: String? = null,
    val area: String? = null,
    val jobNo: String? = null,
    val grn: String? = null,
    val po: String? = null,
    val address: String? = null,
    val lines: List<InvoiceLineRequest>? = null
)

data class InvoiceResponse(
    val id: String,
    val invoiceNumber: String?,
    val date: String,
    val customerName: String,
    val customerEmail: String?,
    val projectSite: String?,
    val preparedBy: String?,
    val area: String?,
    val jobNo: String?,
    val grn: String?,
    val po: String?,
    val address: String?,
    val status: String,
    val subtotal: String?,
    val vatPercent: String?,
    val vatAmount: String?,
    val total: String?,
    val rejectionReason: String?,
    val serverPdfUrl: String?,
    val createdAt: String,
    val updatedAt: String,
    val createdBy: String?,
    val lines: List<InvoiceLineResponse>?,
    val comments: List<CommentResponse>? = null,
    val media: List<MediaResponse>? = null
)

data class InvoiceLineResponse(
    val id: String,
    val itemName: String,
    val description: String?,
    val unit: String,
    val unitPrice: String,
    val quantity: String,
    val amount: String
)

data class CommentResponse(
    val id: String,
    val body: String,
    val createdAt: String,
    val author: UserResponse? = null
)

data class InvoiceUpdatesResponse(
    val changed: Boolean,
    val lastUpdatedAt: Long,
    val status: String,
    val comments: List<CommentResponse>,
    val serverPdfUrl: String?
)

data class RejectRequest(
    val reason: String
)

data class MediaResponse(
    val id: String,
    val url: String,
    val mimeType: String?,
    val source: String?,
    val createdAt: String
)

