package com.smartinvoice.app.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.smartinvoice.app.databinding.ItemInvoiceLineBinding
import java.util.*

class InvoiceItemsAdapter(
    private val onDelete: (InvoiceLineItem) -> Unit
) : ListAdapter<InvoiceLineItem, InvoiceItemsAdapter.ItemViewHolder>(ItemDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ItemViewHolder {
        val binding = ItemInvoiceLineBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ItemViewHolder(binding, onDelete)
    }

    override fun onBindViewHolder(holder: ItemViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ItemViewHolder(
        private val binding: ItemInvoiceLineBinding,
        private val onDelete: (InvoiceLineItem) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(item: InvoiceLineItem) {
            binding.apply {
                itemNameText.text = "${item.boqItem.sapNumber} - ${item.boqItem.shortDescription}"
                quantityPriceText.text = "${item.quantity} ${item.boqItem.unit} x R${String.format(Locale.getDefault(), "%.2f", item.unitPrice)}"
                totalPriceText.text = String.format(Locale.getDefault(), "R%.2f", item.total)

                deleteButton.setOnClickListener {
                    onDelete(item)
                }
            }
        }
    }

    private class ItemDiffCallback : DiffUtil.ItemCallback<InvoiceLineItem>() {
        override fun areItemsTheSame(oldItem: InvoiceLineItem, newItem: InvoiceLineItem): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: InvoiceLineItem, newItem: InvoiceLineItem): Boolean {
            return oldItem == newItem
        }
    }
}

