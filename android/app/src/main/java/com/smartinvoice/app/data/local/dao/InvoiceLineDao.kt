package com.smartinvoice.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.smartinvoice.app.data.local.entities.InvoiceLineEntity

@Dao
interface InvoiceLineDao {
    @Query("SELECT * FROM invoice_lines WHERE invoiceId = :invoiceId")
    suspend fun getLinesByInvoiceId(invoiceId: String): List<InvoiceLineEntity>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(lines: List<InvoiceLineEntity>)
    
    @Query("DELETE FROM invoice_lines WHERE invoiceId = :invoiceId")
    suspend fun deleteByInvoiceId(invoiceId: String)
}

