package com.smartinvoice.app.data.repository

import com.smartinvoice.app.data.local.dao.InvoiceDao
import com.smartinvoice.app.data.local.dao.InvoiceLineDao
import com.smartinvoice.app.data.local.entities.InvoiceEntity
import com.smartinvoice.app.data.local.entities.InvoiceLineEntity
import com.smartinvoice.app.data.remote.ApiService
import com.smartinvoice.app.data.remote.models.CreateInvoiceRequest
import kotlinx.coroutines.flow.Flow

class InvoiceRepository(
    private val invoiceDao: InvoiceDao,
    private val invoiceLineDao: InvoiceLineDao,
    private val apiService: ApiService
) {
    fun getAllInvoices(): Flow<List<InvoiceEntity>> = invoiceDao.getAllInvoices()

    suspend fun getInvoice(id: String): InvoiceEntity? = invoiceDao.getInvoiceById(id)

    suspend fun createInvoiceLocally(
        invoice: InvoiceEntity,
        lines: List<InvoiceLineEntity>
    ) {
        invoiceDao.insert(invoice)
        invoiceLineDao.insertAll(lines)
    }

    suspend fun syncInvoiceToServer(invoiceId: String): Result<String> {
        val localInvoice = invoiceDao.getInvoiceById(invoiceId) ?: return Result.failure(Exception("Invoice not found"))
        val localLines = invoiceLineDao.getLinesByInvoiceId(invoiceId)

        val request = CreateInvoiceRequest(
            date = localInvoice.date,
            customerName = localInvoice.customerName,
            projectSite = localInvoice.projectSite,
            preparedBy = localInvoice.preparedBy,
            lines = localLines.map { line ->
                com.smartinvoice.app.data.remote.models.InvoiceLineRequest(
                    itemName = line.itemName,
                    description = line.description,
                    unit = line.unit,
                    unitPrice = line.unitPrice,
                    quantity = line.quantity,
                    amount = line.amount
                )
            }
        )

        return try {
            val response = apiService.createInvoice(request)
            invoiceDao.updateServerId(invoiceId, response.id, System.currentTimeMillis())
            Result.success(response.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

