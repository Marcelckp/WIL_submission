package com.smartinvoice.app.data.remote.models

data class BoqItemResponse(
    val sapNumber: String,
    val shortDescription: String,
    val unit: String,
    val rate: String,
    val category: String? = null
)

data class BoqItemsResponse(
    val version: Int,
    val items: List<BoqItemResponse>
)

