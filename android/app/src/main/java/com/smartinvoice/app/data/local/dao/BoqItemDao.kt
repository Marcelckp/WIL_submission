package com.smartinvoice.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.smartinvoice.app.data.local.entities.BoqItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface BoqItemDao {
    @Query("SELECT * FROM boq_items WHERE searchableText LIKE '%' || :query || '%' OR sapNumber LIKE '%' || :query || '%' LIMIT :limit")
    fun searchItems(query: String, limit: Int = 20): Flow<List<BoqItemEntity>>
    
    @Query("SELECT * FROM boq_items WHERE sapNumber = :sapNumber LIMIT 1")
    suspend fun getItemBySapNumber(sapNumber: String): BoqItemEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<BoqItemEntity>)
    
    @Query("DELETE FROM boq_items")
    suspend fun deleteAll()
    
    @Query("SELECT MAX(version) FROM boq_items")
    suspend fun getLatestVersion(): Int?
}

