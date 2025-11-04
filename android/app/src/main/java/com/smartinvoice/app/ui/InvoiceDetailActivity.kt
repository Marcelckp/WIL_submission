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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
        onDelete = null, // Read-only in detail view
        invoiceStatus = null // Will be set when invoice is loaded
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
    private val POLLING_INTERVAL = 5_000L // 5 seconds

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
            // Setup back button
            backButton.setOnClickListener {
                finish()
            }
            
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
                // Navigate to edit screen with invoice data
                val id = invoice?.id ?: return@setOnClickListener
                val intent = Intent(this@InvoiceDetailActivity, NewInvoiceActivity::class.java)
                intent.putExtra("invoice_id", id)
                startActivity(intent)
            }

            submitButton.setOnClickListener {
                submitInvoice()
            }

            viewPdfButton.setOnClickListener {
                viewPdf()
            }

            sendEmailButton.setOnClickListener {
                sendEmail()
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
            // Update header with invoice number
            invoiceNumberHeaderText.text = invoice.invoiceNumber ?: "Draft-${invoice.id.take(8)}"
            
            // Invoice header
            invoiceNumberText.text = invoice.invoiceNumber ?: "Draft-${invoice.id.take(8)}"
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

            // Update adapter with invoice status to control delete button visibility
            // Create new adapter instance with the correct status
            val newAdapter = InvoiceItemsAdapter(
                onDelete = null, // Read-only in detail view
                invoiceStatus = invoice.status
            )
            itemsRecyclerView.adapter = newAdapter

            // Line items - create a simplified adapter list
            val lineItems = invoice.lines?.map { line ->
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
            } ?: emptyList()
            newAdapter.submitList(lineItems)

            // Totals - Calculate from line items if totals are null (for DRAFT invoices)
            val calculatedSubtotal = invoice.subtotal?.let {
                it.toDoubleOrNull() ?: 0.0
            } ?: run {
                // Calculate from line items for DRAFT invoices
                invoice.lines?.sumOf { line ->
                    val qty = line.quantity.toDoubleOrNull() ?: 0.0
                    val price = line.unitPrice.toDoubleOrNull() ?: 0.0
                    qty * price
                } ?: 0.0
            }
            
            val vatPercent = invoice.vatPercent?.toDoubleOrNull() ?: 15.0
            val calculatedVat = invoice.vatAmount?.let {
                it.toDoubleOrNull() ?: 0.0
            } ?: run {
                calculatedSubtotal * (vatPercent / 100.0)
            }
            
            val calculatedTotal = invoice.total?.let {
                it.toDoubleOrNull() ?: 0.0
            } ?: run {
                calculatedSubtotal + calculatedVat
            }
            
            subtotalText.text = currencyFormat.format(calculatedSubtotal)
            vatText.text = "${vatPercent.toInt()}% - ${currencyFormat.format(calculatedVat)}"
            totalText.text = currencyFormat.format(calculatedTotal)

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

            // Show rejection feedback if invoice was rejected and set back to DRAFT
            if (invoice.rejectionReason != null && invoice.status == "DRAFT") {
                // Show rejection reason prominently
                binding.rejectionReasonText?.visibility = View.VISIBLE
                binding.rejectionReasonText?.text = "Rejection Feedback: ${invoice.rejectionReason}"
            } else {
                binding.rejectionReasonText?.visibility = View.GONE
            }

            // Display attachments/media
            invoice.media?.let { mediaList ->
                if (mediaList.isEmpty()) {
                    binding.noPhotosText.visibility = View.VISIBLE
                    binding.photosRecyclerView.visibility = View.GONE
                } else {
                    binding.noPhotosText.visibility = View.GONE
                    binding.photosRecyclerView.visibility = View.VISIBLE
                    // Convert media URLs to Uri objects for adapter
                    val mediaUris = mediaList.map { media ->
                        Uri.parse(media.url)
                    }
                    photosAdapter.submitList(mediaUris)
                }
            } ?: run {
                binding.noPhotosText.visibility = View.VISIBLE
                binding.photosRecyclerView.visibility = View.GONE
            }

            // Action buttons based on status
            when (invoice.status) {
                "DRAFT" -> {
                    editButton.visibility = View.VISIBLE
                    submitButton.visibility = View.VISIBLE
                    viewPdfButton.visibility = View.GONE
                    sendEmailButton.visibility = View.GONE
                }
                "SUBMITTED", "REJECTED" -> {
                    // SUBMITTED and REJECTED invoices cannot be edited or submitted
                    editButton.visibility = View.GONE
                    submitButton.visibility = View.GONE
                    viewPdfButton.visibility = View.GONE
                    sendEmailButton.visibility = View.GONE
                }
                "FINAL", "APPROVED" -> {
                    editButton.visibility = View.GONE
                    submitButton.visibility = View.GONE
                    if (invoice.serverPdfUrl != null && !invoice.customerEmail.isNullOrBlank()) {
                        viewPdfButton.visibility = View.VISIBLE
                        sendEmailButton.visibility = View.VISIBLE
                    } else {
                        viewPdfButton.visibility = if (invoice.serverPdfUrl != null) View.VISIBLE else View.GONE
                        sendEmailButton.visibility = View.GONE
                    }
                }
            }
        }
    }

    private fun updateStatusBadge(status: String) {
        val badge = binding.statusBadge
        badge.text = status
        
        // Set vibrant text colors for better contrast
        val textColor = when (status) {
            "DRAFT" -> android.graphics.Color.parseColor("#1E40AF") // Dark blue
            "SUBMITTED" -> android.graphics.Color.parseColor("#92400E") // Dark amber
            "FINAL", "APPROVED" -> android.graphics.Color.parseColor("#065F46") // Dark green
            "REJECTED" -> android.graphics.Color.parseColor("#991B1B") // Dark red
            else -> android.graphics.Color.parseColor("#1E40AF")
        }
        badge.setTextColor(textColor)
        
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
        val invoice = this.invoice
        
        if (invoice?.status != "FINAL" && invoice?.status != "APPROVED") {
            Toast.makeText(this, "PDF is only available for approved invoices", Toast.LENGTH_SHORT).show()
            return
        }
        
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                
                // First try to use serverPdfUrl if available, otherwise download from API
                val pdfBytes = if (invoice?.serverPdfUrl != null && invoice.serverPdfUrl!!.isNotBlank()) {
                    try {
                        // Download from Firebase Storage URL
                        withContext(Dispatchers.IO) {
                            downloadFromUrl(invoice.serverPdfUrl!!)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        // Fallback to API endpoint
                        try {
                            withContext(Dispatchers.IO) {
                                downloadFromApi(id)
                            }
                        } catch (apiError: Exception) {
                            apiError.printStackTrace()
                            throw Exception("Failed to download from URL: ${e.message ?: "Unknown error"}. Failed to download from API: ${apiError.message ?: "Unknown error"}")
                        }
                    }
                } else {
                    // Download from API endpoint
                    withContext(Dispatchers.IO) {
                        downloadFromApi(id)
                    }
                }
                
                if (pdfBytes == null || pdfBytes.isEmpty()) {
                    Toast.makeText(this@InvoiceDetailActivity, "Failed to download PDF: Empty response", Toast.LENGTH_SHORT).show()
                    return@launch
                }
                
                // Save to temporary file
                val tempFile = withContext(Dispatchers.IO) {
                    val file = java.io.File(getExternalFilesDir(null), "invoice_${invoice?.invoiceNumber ?: id}.pdf")
                    file.parentFile?.mkdirs()
                    file.writeBytes(pdfBytes)
                    file
                }
                
                // Share PDF
                sharePdf(tempFile)
                
            } catch (e: Exception) {
                e.printStackTrace()
                val errorMsg = when {
                    e.message != null && e.message!!.isNotBlank() -> e.message!!
                    e.cause?.message != null -> e.cause!!.message!!
                    else -> "Unknown error occurred. Please check your internet connection and try again."
                }
                Toast.makeText(this@InvoiceDetailActivity, "Failed to download PDF: $errorMsg", Toast.LENGTH_LONG).show()
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }
    
    private suspend fun downloadFromUrl(url: String): ByteArray {
        return withContext(Dispatchers.IO) {
            val client = OkHttpClient.Builder()
                .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .build()
            
            val request = Request.Builder()
                .url(url)
                .build()
            
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: ""
                throw Exception("HTTP ${response.code}: ${response.message}. $errorBody")
            }
            
            val body = response.body ?: throw Exception("Response body is null")
            try {
                body.bytes()
            } catch (e: Exception) {
                throw Exception("Failed to read response body: ${e.message}")
            }
        }
    }
    
    private suspend fun downloadFromApi(invoiceId: String): ByteArray {
        return withContext(Dispatchers.IO) {
            val token = prefs.getToken()
            if (token == null) {
                throw Exception("Authentication token not found")
            }
            
            val baseUrl = com.smartinvoice.app.BuildConfig.API_BASE_URL
            val url = if (baseUrl.endsWith("/")) {
                "${baseUrl}invoices/$invoiceId/pdf"
            } else {
                "$baseUrl/invoices/$invoiceId/pdf"
            }
            
            val client = OkHttpClient.Builder()
                .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .build()
            
            val request = Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer $token")
                .build()
            
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                val errorBody = response.body?.string() ?: "Unknown error"
                throw Exception("HTTP ${response.code}: $errorBody")
            }
            
            val body = response.body ?: throw Exception("Response body is null")
            try {
                body.bytes()
            } catch (e: Exception) {
                throw Exception("Failed to read response body: ${e.message}")
            }
        }
    }
    
    private fun sharePdf(file: java.io.File) {
        try {
            if (!file.exists() || file.length() == 0L) {
                Toast.makeText(this, "PDF file is empty or not found", Toast.LENGTH_SHORT).show()
                return
            }
            
            val uri = androidx.core.content.FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                file
            )
            
            val invoiceNumber = invoice?.invoiceNumber ?: invoiceId ?: "Unknown"
            val shareText = "Please find attached invoice $invoiceNumber"
            
            // Create main share intent
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, "Invoice $invoiceNumber")
                putExtra(Intent.EXTRA_TEXT, shareText)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            
            // Create WhatsApp-specific intent
            val whatsappIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                setPackage("com.whatsapp")
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, shareText)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            
            // Create email intent
            val emailIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_EMAIL, arrayOf(""))
                putExtra(Intent.EXTRA_SUBJECT, "Invoice $invoiceNumber")
                putExtra(Intent.EXTRA_TEXT, shareText)
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            
            // Create chooser with WhatsApp and Email as priority options
            val chooserIntent = Intent.createChooser(shareIntent, "Share Invoice PDF").apply {
                // Add WhatsApp and Email as initial intents
                val initialIntents = mutableListOf<Intent>()
                
                // Check if WhatsApp is installed
                if (packageManager.resolveActivity(whatsappIntent, 0) != null) {
                    initialIntents.add(whatsappIntent)
                }
                
                // Email is usually available
                initialIntents.add(emailIntent)
                
                if (initialIntents.isNotEmpty()) {
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, initialIntents.toTypedArray())
                }
            }
            
            startActivity(chooserIntent)
        } catch (e: Exception) {
            e.printStackTrace()
            val errorMsg = e.message ?: "Unknown error"
            Toast.makeText(this, "Failed to share PDF: $errorMsg", Toast.LENGTH_LONG).show()
        }
    }

    private fun sendEmail() {
        val id = invoiceId ?: return
        val invoice = this.invoice
        
        if (invoice?.status != "FINAL" && invoice?.status != "APPROVED") {
            Toast.makeText(this, "Can only send emails for approved invoices", Toast.LENGTH_SHORT).show()
            return
        }
        
        // Create dialog to enter email address
        val input = android.widget.EditText(this).apply {
            inputType = android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            hint = getString(com.smartinvoice.app.R.string.enter_email_address)
        }
        
        AlertDialog.Builder(this)
            .setTitle(getString(com.smartinvoice.app.R.string.send_email_recipient))
            .setMessage(getString(com.smartinvoice.app.R.string.enter_email_address))
            .setView(input)
            .setPositiveButton(getString(com.smartinvoice.app.R.string.send_email)) { _, _ ->
                val emailAddress = input.text.toString().trim()
                if (emailAddress.isEmpty()) {
                    Toast.makeText(this, "Please enter an email address", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                
                // Validate email format
                if (!android.util.Patterns.EMAIL_ADDRESS.matcher(emailAddress).matches()) {
                    Toast.makeText(this, "Please enter a valid email address", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                
                lifecycleScope.launch {
                    try {
                        binding.progressBar.visibility = View.VISIBLE
                        val response = apiService.sendInvoiceEmail(
                            id,
                            com.smartinvoice.app.data.remote.SendEmailRequest(to = emailAddress)
                        )
                        Toast.makeText(
                            this@InvoiceDetailActivity,
                            getString(com.smartinvoice.app.R.string.email_sent_successfully),
                            Toast.LENGTH_SHORT
                        ).show()
                    } catch (e: Exception) {
                        e.printStackTrace()
                        Toast.makeText(
                            this@InvoiceDetailActivity,
                            "${getString(com.smartinvoice.app.R.string.failed_to_send_email)}: ${e.message}",
                            Toast.LENGTH_LONG
                        ).show()
                    } finally {
                        binding.progressBar.visibility = View.GONE
                    }
                }
            }
            .setNegativeButton(getString(com.smartinvoice.app.R.string.cancel), null)
            .show()
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
                } else {
                    // Even if nothing changed, update lastUpdateTime to prevent re-fetching
                    // This prevents duplicate comments if the backend returns the same comments
                    lastUpdateTime = updates.lastUpdatedAt
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
