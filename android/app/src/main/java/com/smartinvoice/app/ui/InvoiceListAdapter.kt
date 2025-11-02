package com.smartinvoice.app.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.smartinvoice.app.data.remote.models.InvoiceResponse
import com.smartinvoice.app.databinding.ItemInvoiceBinding
import java.text.NumberFormat
import java.util.Locale

class InvoiceListAdapter(
    private val onClick: (InvoiceResponse) -> Unit
) : ListAdapter<InvoiceResponse, InvoiceListAdapter.InvoiceViewHolder>(InvoiceDiffCallback()) {

    private val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "ZA"))

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): InvoiceViewHolder {
        val binding = ItemInvoiceBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return InvoiceViewHolder(binding, onClick)
    }

    override fun onBindViewHolder(holder: InvoiceViewHolder, position: Int) {
        holder.bind(getItem(position), currencyFormatter)
    }

    class InvoiceViewHolder(
        private val binding: ItemInvoiceBinding,
        private val onClick: (InvoiceResponse) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(invoice: InvoiceResponse, formatter: NumberFormat) {
            binding.apply {
                invoiceNumberText.text = invoice.invoiceNumber ?: "Pending"
                customerText.text = invoice.customerName
                totalAmountText.text = invoice.total?.let { 
                    formatter.format(it.toDoubleOrNull() ?: 0.0)
                } ?: "R0.00"
                itemsCountText.text = "${invoice.lines.size} items"
                dateText.text = invoice.date
                projectSiteText.text = invoice.projectSite ?: ""

                root.setOnClickListener {
                    onClick(invoice)
                }
            }
        }
    }

    private class InvoiceDiffCallback : DiffUtil.ItemCallback<InvoiceResponse>() {
        override fun areItemsTheSame(oldItem: InvoiceResponse, newItem: InvoiceResponse): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: InvoiceResponse, newItem: InvoiceResponse): Boolean {
            return oldItem == newItem
        }
    }
}

