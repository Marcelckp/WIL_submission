package com.smartinvoice.app.data.remote.models

data class InvoiceListResponse(
    val invoices: List<InvoiceResponse>,
    val total: Int,
    val limit: Int,
    val offset: Int
)

