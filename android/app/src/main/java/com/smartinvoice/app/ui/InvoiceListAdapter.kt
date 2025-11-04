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
                // Show invoice number or a draft identifier if not available
                invoiceNumberText.text = invoice.invoiceNumber ?: "Draft-${invoice.id.take(8)}"
                customerText.text = invoice.customerName
                
                // Update status badge
                statusBadge.text = invoice.status
                
                // Set vibrant text colors for better contrast
                val textColor = when (invoice.status) {
                    "DRAFT" -> android.graphics.Color.parseColor("#1E40AF") // Dark blue
                    "SUBMITTED" -> android.graphics.Color.parseColor("#92400E") // Dark amber
                    "FINAL", "APPROVED" -> android.graphics.Color.parseColor("#065F46") // Dark green
                    "REJECTED" -> android.graphics.Color.parseColor("#991B1B") // Dark red
                    else -> android.graphics.Color.parseColor("#1E40AF")
                }
                statusBadge.setTextColor(textColor)
                
                val drawableRes = when (invoice.status) {
                    "DRAFT" -> com.smartinvoice.app.R.drawable.status_badge_draft
                    "SUBMITTED" -> com.smartinvoice.app.R.drawable.status_badge_submitted
                    "FINAL", "APPROVED" -> com.smartinvoice.app.R.drawable.status_badge_final
                    "REJECTED" -> com.smartinvoice.app.R.drawable.status_badge_rejected
                    else -> com.smartinvoice.app.R.drawable.status_badge_draft
                }
                statusBadge.setBackgroundResource(drawableRes)
                
                // Calculate total from lines if total is null (for draft invoices)
                val displayTotal = invoice.total?.let { 
                    it.toDoubleOrNull() ?: 0.0
                } ?: run {
                    // Calculate from line items for draft invoices
                    invoice.lines?.sumOf { line ->
                        val qty = line.quantity.toDoubleOrNull() ?: 0.0
                        val price = line.unitPrice.toDoubleOrNull() ?: 0.0
                        qty * price
                    } ?: 0.0
                }
                totalAmountText.text = if (displayTotal > 0) formatter.format(displayTotal) else "-"
                
                itemsCountText.text = "${invoice.lines?.size ?: 0} items"
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

