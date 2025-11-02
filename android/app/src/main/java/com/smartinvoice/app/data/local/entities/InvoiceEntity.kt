package com.smartinvoice.app.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "invoices")
data class InvoiceEntity(
    @PrimaryKey val id: String,
    val serverId: String? = null, // Server ID after sync
    val invoiceNumber: String? = null,
    val date: String,
    val customerName: String,
    val projectSite: String? = null,
    val preparedBy: String? = null,
    val status: String, // DRAFT, SUBMITTED, APPROVED, REJECTED, FINAL
    val subtotal: String? = null,
    val vatPercent: String? = null,
    val vatAmount: String? = null,
    val total: String? = null,
    val rejectionReason: String? = null,
    val serverPdfUrl: String? = null,
    val lastSyncedBoqVersion: Int? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val lastSyncedAt: Long? = null
)

