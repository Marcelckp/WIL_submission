package com.smartinvoice.app.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "boq_items")
data class BoqItemEntity(
    @PrimaryKey val sapNumber: String,
    val shortDescription: String,
    val unit: String,
    val rate: String,
    val category: String? = null,
    val searchableText: String,
    val syncedAt: Long = System.currentTimeMillis(),
    val version: Int = 0
)

