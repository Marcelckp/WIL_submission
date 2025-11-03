package com.smartinvoice.app.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.bumptech.glide.Glide
import com.smartinvoice.app.data.remote.ApiService
import com.smartinvoice.app.data.remote.models.InvoiceResponse
import com.smartinvoice.app.databinding.ActivityInvoiceDetailBinding
import com.smartinvoice.app.util.SharedPreferencesHelper
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class InvoiceDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityInvoiceDetailBinding
    private lateinit var apiService: ApiService
    private lateinit var prefs: SharedPreferencesHelper
    
    private var invoiceId: String? = null
    private var invoice: InvoiceResponse? = null
    private var lastUpdateTime: Long = 0
    
    private val itemsAdapter = InvoiceItemsAdapter(
        onDelete = null // Read-only in detail view
    )
    
    private val commentsAdapter = CommentsAdapter()
    private val photosAdapter = PhotoAdapter(null)
    
    private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "ZA")).apply {
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    private val displayDateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
    
    private val pollingHandler = Handler(Looper.getMainLooper())
    private var pollingRunnable: Runnable? = null
    private val POLLING_INTERVAL = 10_000L // 10 seconds

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInvoiceDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        invoiceId = intent.getStringExtra("invoiceId")
        
        if (invoiceId == null) {
            Toast.makeText(this, "Invoice ID not found", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)

        setupViews()
        loadInvoice()
        startPolling()
    }

    private fun setupViews() {
        binding.apply {
            // Setup RecyclerViews
            itemsRecyclerView.layoutManager = LinearLayoutManager(this@InvoiceDetailActivity)
            itemsRecyclerView.adapter = itemsAdapter
            
            commentsRecyclerView.layoutManager = LinearLayoutManager(this@InvoiceDetailActivity)
            commentsRecyclerView.adapter = commentsAdapter
            
            photosRecyclerView.layoutManager = LinearLayoutManager(
                this@InvoiceDetailActivity,
                LinearLayoutManager.HORIZONTAL,
                false
            )
            photosRecyclerView.adapter = photosAdapter

            // Action buttons
            editButton.setOnClickListener {
                // TODO: Navigate to edit screen
                Toast.makeText(this@InvoiceDetailActivity, "Edit functionality coming soon", Toast.LENGTH_SHORT).show()
            }

            submitButton.setOnClickListener {
                submitInvoice()
            }

            viewPdfButton.setOnClickListener {
                viewPdf()
            }

            addCommentButton.setOnClickListener {
                addComment()
            }
        }
    }

    private fun loadInvoice() {
        val id = invoiceId ?: return
        
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                invoice = apiService.getInvoice(id)
                invoice?.let {
                    lastUpdateTime = System.currentTimeMillis()
                    updateUI(it)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@InvoiceDetailActivity, "Failed to load invoice: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }

    private fun updateUI(invoice: InvoiceResponse) {
        binding.apply {
            // Invoice header
            invoiceNumberText.text = invoice.invoiceNumber ?: getString(com.smartinvoice.app.R.string.pending)
            invoiceDateText.text = try {
                displayDateFormat.format(dateFormat.parse(invoice.date) ?: Date())
            } catch (e: Exception) {
                invoice.date
            }
            
            customerNameText.text = invoice.customerName
            projectSiteText.text = invoice.projectSite ?: "-"
            preparedByText.text = invoice.preparedBy ?: "-"

            // Status badge
            updateStatusBadge(invoice.status)

            // Line items - create a simplified adapter list
            val lineItems = invoice.lines.map { line ->
                InvoiceLineItem(
                    id = line.id,
                    boqItem = com.smartinvoice.app.data.remote.models.BoqItemResponse(
                        sapNumber = "",
                        shortDescription = line.itemName,
                        unit = line.unit,
                        rate = line.unitPrice,
                        category = null
                    ),
                    quantity = line.quantity.toDoubleOrNull() ?: 0.0,
                    unitPrice = line.unitPrice.toDoubleOrNull() ?: 0.0,
                    total = line.amount.toDoubleOrNull() ?: 0.0
                )
            }
            itemsAdapter.submitList(lineItems)

            // Totals
            subtotalText.text = invoice.subtotal?.let {
                currencyFormat.format(it.toDoubleOrNull() ?: 0.0)
            } ?: "R0.00"
            
            vatText.text = invoice.vatAmount?.let {
                "${invoice.vatPercent ?: "15"}% - ${currencyFormat.format(it.toDoubleOrNull() ?: 0.0)}"
            } ?: "R0.00"
            
            totalText.text = invoice.total?.let {
                currencyFormat.format(it.toDoubleOrNull() ?: 0.0)
            } ?: "R0.00"

            // Comments
            invoice.comments?.let { comments ->
                if (comments.isEmpty()) {
                    noCommentsText.visibility = View.VISIBLE
                    commentsRecyclerView.visibility = View.GONE
                } else {
                    noCommentsText.visibility = View.GONE
                    commentsRecyclerView.visibility = View.VISIBLE
                    commentsAdapter.submitList(comments.reversed())
                }
            } ?: run {
                noCommentsText.visibility = View.VISIBLE
                commentsRecyclerView.visibility = View.GONE
            }

            // Action buttons based on status
            when (invoice.status) {
                "DRAFT" -> {
                    editButton.visibility = View.VISIBLE
                    submitButton.visibility = View.VISIBLE
                    viewPdfButton.visibility = View.GONE
                }
                "SUBMITTED", "APPROVED", "REJECTED" -> {
                    editButton.visibility = View.GONE
                    submitButton.visibility = View.GONE
                    viewPdfButton.visibility = View.GONE
                }
                "FINAL" -> {
                    editButton.visibility = View.GONE
                    submitButton.visibility = View.GONE
                    if (invoice.serverPdfUrl != null) {
                        viewPdfButton.visibility = View.VISIBLE
                    }
                }
            }
        }
    }

    private fun updateStatusBadge(status: String) {
        val badge = binding.statusBadge
        badge.text = status
        
        val drawableRes = when (status) {
            "DRAFT" -> com.smartinvoice.app.R.drawable.status_badge_draft
            "SUBMITTED" -> com.smartinvoice.app.R.drawable.status_badge_submitted
            "FINAL", "APPROVED" -> com.smartinvoice.app.R.drawable.status_badge_final
            "REJECTED" -> com.smartinvoice.app.R.drawable.status_badge_rejected
            else -> com.smartinvoice.app.R.drawable.status_badge_draft
        }
        
        badge.setBackgroundResource(drawableRes)
    }

    private fun submitInvoice() {
        val id = invoiceId ?: return
        
        AlertDialog.Builder(this)
            .setTitle("Submit Invoice")
            .setMessage("Are you sure you want to submit this invoice for approval? You won't be able to edit it after submission.")
            .setPositiveButton("Submit") { _, _ ->
                lifecycleScope.launch {
                    try {
                        binding.progressBar.visibility = View.VISIBLE
                        invoice = apiService.submitInvoice(id)
                        invoice?.let { updateUI(it) }
                        Toast.makeText(this@InvoiceDetailActivity, "Invoice submitted successfully", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        e.printStackTrace()
                        Toast.makeText(this@InvoiceDetailActivity, "Failed to submit invoice: ${e.message}", Toast.LENGTH_LONG).show()
                    } finally {
                        binding.progressBar.visibility = View.GONE
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun viewPdf() {
        val id = invoiceId ?: return
        
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                
                // Download PDF bytes
                val token = prefs.getToken()
                val client = okhttp3.OkHttpClient()
                val request = okhttp3.Request.Builder()
                    .url("${com.smartinvoice.app.BuildConfig.API_BASE_URL}invoices/$id/pdf")
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                
                val response = client.newCall(request).execute()
                if (!response.isSuccessful) {
                    Toast.makeText(this@InvoiceDetailActivity, "Failed to download PDF", Toast.LENGTH_SHORT).show()
                    return@launch
                }
                
                val pdfBytes = response.body?.bytes() ?: return@launch
                
                // Save to temporary file
                val tempFile = java.io.File(getExternalFilesDir(null), "invoice_${id}.pdf")
                tempFile.writeBytes(pdfBytes)
                
                // Share PDF
                sharePdf(tempFile)
                
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@InvoiceDetailActivity, "Failed to download PDF: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }
    
    private fun sharePdf(file: java.io.File) {
        try {
            val uri = androidx.core.content.FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                file
            )
            
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Invoice ${invoice?.invoiceNumber ?: invoiceId}")
                putExtra(Intent.EXTRA_TEXT, "Please find attached invoice ${invoice?.invoiceNumber ?: invoiceId}")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            
            // Create chooser with specific options
            val chooserIntent = Intent.createChooser(shareIntent, "Share Invoice PDF").apply {
                val emailIntent = Intent(Intent.ACTION_SENDTO).apply {
                    data = Uri.parse("mailto:")
                    putExtra(Intent.EXTRA_SUBJECT, "Invoice ${invoice?.invoiceNumber ?: invoiceId}")
                    putExtra(Intent.EXTRA_TEXT, "Please find attached invoice.")
                    putExtra(Intent.EXTRA_STREAM, uri)
                    type = "application/pdf"
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                
                val whatsappIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "application/pdf"
                    setPackage("com.whatsapp")
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                
                putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(emailIntent, whatsappIntent))
            }
            
            startActivity(chooserIntent)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to share PDF: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun addComment() {
        val commentText = binding.commentEditText.text.toString().trim()
        if (commentText.isEmpty()) {
            Toast.makeText(this, "Please enter a comment", Toast.LENGTH_SHORT).show()
            return
        }

        val id = invoiceId ?: return
        
        lifecycleScope.launch {
            try {
                apiService.addComment(id, mapOf("body" to commentText))
                binding.commentEditText.text?.clear()
                loadInvoice() // Refresh to show new comment
                Toast.makeText(this@InvoiceDetailActivity, "Comment added", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@InvoiceDetailActivity, "Failed to add comment: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun startPolling() {
        pollingRunnable = object : Runnable {
            override fun run() {
                if (invoiceId != null && invoice?.status != "FINAL") {
                    checkForUpdates()
                }
                pollingHandler.postDelayed(this, POLLING_INTERVAL)
            }
        }
        pollingHandler.post(pollingRunnable!!)
    }

    private fun checkForUpdates() {
        val id = invoiceId ?: return
        
        lifecycleScope.launch {
            try {
                val updates = apiService.getInvoiceUpdates(id, lastUpdateTime)
                if (updates.changed) {
                    lastUpdateTime = updates.lastUpdatedAt
                    // Reload invoice to get latest data
                    loadInvoice()
                    
                    // Show notification if status changed
                    if (updates.status != invoice?.status) {
                        Toast.makeText(
                            this@InvoiceDetailActivity,
                            "Invoice status updated to ${updates.status}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    
                    // Show notification for new comments
                    if (updates.comments.isNotEmpty()) {
                        Toast.makeText(
                            this@InvoiceDetailActivity,
                            "New comment from office",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    
                    // Show PDF if now available
                    if (updates.serverPdfUrl != null && invoice?.serverPdfUrl == null) {
                        Toast.makeText(
                            this@InvoiceDetailActivity,
                            "Invoice PDF is now available",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            } catch (e: Exception) {
                // Silently fail polling - don't spam user with errors
                e.printStackTrace()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        pollingRunnable?.let {
            pollingHandler.removeCallbacks(it)
        }
    }
}
