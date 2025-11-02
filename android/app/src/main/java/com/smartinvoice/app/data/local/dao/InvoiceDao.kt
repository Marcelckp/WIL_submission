package com.smartinvoice.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.smartinvoice.app.data.local.entities.InvoiceEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM invoices ORDER BY updatedAt DESC")
    fun getAllInvoices(): Flow<List<InvoiceEntity>>
    
    @Query("SELECT * FROM invoices WHERE id = :id LIMIT 1")
    suspend fun getInvoiceById(id: String): InvoiceEntity?
    
    @Query("SELECT * FROM invoices WHERE serverId = :serverId LIMIT 1")
    suspend fun getInvoiceByServerId(serverId: String): InvoiceEntity?
    
    @Query("SELECT * FROM invoices WHERE status = :status ORDER BY updatedAt DESC")
    fun getInvoicesByStatus(status: String): Flow<List<InvoiceEntity>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(invoice: InvoiceEntity)
    
    @Query("UPDATE invoices SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, updatedAt: Long)
    
    @Query("UPDATE invoices SET serverId = :serverId, lastSyncedAt = :syncedAt WHERE id = :id")
    suspend fun updateServerId(id: String, serverId: String, syncedAt: Long)
    
    @Query("DELETE FROM invoices WHERE id = :id")
    suspend fun delete(id: String)
}

