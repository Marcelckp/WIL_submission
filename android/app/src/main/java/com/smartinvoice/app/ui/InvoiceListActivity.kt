package com.smartinvoice.app.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.snackbar.Snackbar
import com.smartinvoice.app.data.remote.ApiService
import com.smartinvoice.app.data.remote.models.InvoiceResponse
import com.smartinvoice.app.databinding.ActivityInvoiceListBinding
import com.smartinvoice.app.util.SharedPreferencesHelper
import kotlinx.coroutines.launch

class InvoiceListActivity : AppCompatActivity() {
    private lateinit var binding: ActivityInvoiceListBinding
    private lateinit var apiService: ApiService
    private lateinit var prefs: SharedPreferencesHelper
    private lateinit var adapter: InvoiceListAdapter
    
    private val pollingHandler = Handler(Looper.getMainLooper())
    private var pollingRunnable: Runnable? = null
    private val POLLING_INTERVAL = 5_000L // 5 seconds
    private val previousInvoicesMap = mutableMapOf<String, InvoiceResponse>()
    private var currentUserId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInvoiceListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)
        
        // Initialize current user ID to detect user changes
        currentUserId = prefs.getUserId()

        setupViews()
        loadInvoices()
        startPolling()
    }
    
    override fun onResume() {
        super.onResume()
        // Check if user has changed (important when switching accounts)
        val userId = prefs.getUserId()
        if (userId != currentUserId) {
            // User changed - reset everything and reload
            currentUserId = userId
            previousInvoicesMap.clear()
            // Recreate API service to ensure we're using the latest token
            apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
            // Stop any existing polling
            pollingRunnable?.let {
                pollingHandler.removeCallbacks(it)
            }
            // Reload data and restart polling
            loadInvoices()
            startPolling()
        }
    }

    private fun setupViews() {
        binding.apply {
            backButton.setOnClickListener {
                finish()
            }

            adapter = InvoiceListAdapter { invoice ->
                // Navigate to invoice detail
                val intent = Intent(this@InvoiceListActivity, InvoiceDetailActivity::class.java)
                intent.putExtra("invoiceId", invoice.id)
                startActivity(intent)
            }

            recyclerView.layoutManager = LinearLayoutManager(this@InvoiceListActivity)
            recyclerView.adapter = adapter
        }
    }

    private fun loadInvoices(showLoading: Boolean = true) {
        if (showLoading) {
            binding.progressBar.visibility = View.VISIBLE
        }

        lifecycleScope.launch {
            try {
                // Ensure we're using the latest token by recreating the API service
                apiService = com.smartinvoice.app.data.remote.ApiClient.create(this@InvoiceListActivity)
                
                val response = apiService.getInvoices()
                
                // Double-check that we're only showing invoices for the current user
                val currentUserId = prefs.getUserId()
                val filteredInvoices = if (currentUserId != null) {
                    // Filter invoices client-side as an extra safety measure
                    // This ensures we only show invoices created by the current user
                    // Backend should already filter, but this adds an extra layer of protection
                    response.invoices.filter { 
                        it.createdBy != null && it.createdBy == currentUserId 
                    }
                } else {
                    // If no user ID, show empty list to prevent showing wrong user's data
                    emptyList()
                }
                
                // Detect changes for notifications (only during polling)
                if (!showLoading && previousInvoicesMap.isNotEmpty()) {
                    val newInvoices = filteredInvoices.filter { !previousInvoicesMap.containsKey(it.id) }
                    val statusChanged = filteredInvoices.filter { invoice ->
                        val prev = previousInvoicesMap[invoice.id]
                        prev != null && prev.status != invoice.status
                    }
                    
                    // Show notification for new invoices
                    newInvoices.forEach { invoice ->
                        val invoiceNumber = invoice.invoiceNumber ?: "Draft-${invoice.id.take(8)}"
                        Snackbar.make(
                            binding.root,
                            "New invoice: $invoiceNumber",
                            Snackbar.LENGTH_LONG
                        ).show()
                    }
                    
                    // Show notifications for status changes
                    statusChanged.forEach { invoice ->
                        val prev = previousInvoicesMap[invoice.id]!!
                        val invoiceNumber = invoice.invoiceNumber ?: invoice.id.take(8)
                        val statusLabels = mapOf(
                            "DRAFT" to "Draft",
                            "SUBMITTED" to "Submitted",
                            "APPROVED" to "Approved",
                            "REJECTED" to "Rejected",
                            "FINAL" to "Final"
                        )
                        Snackbar.make(
                            binding.root,
                            "Invoice $invoiceNumber: ${statusLabels[prev.status] ?: prev.status} → ${statusLabels[invoice.status] ?: invoice.status}",
                            Snackbar.LENGTH_LONG
                        ).show()
                    }
                }
                
                // Update previous invoices map
                previousInvoicesMap.clear()
                filteredInvoices.forEach { invoice ->
                    previousInvoicesMap[invoice.id] = invoice
                }
                
                adapter.submitList(filteredInvoices)
                
                // Update count
                val count = filteredInvoices.size
                binding.savedCountText.text = "$count ${getString(com.smartinvoice.app.R.string.saved)}"
                
            } catch (e: Exception) {
                e.printStackTrace()
                // Show error
            } finally {
                if (showLoading) {
                    binding.progressBar.visibility = View.GONE
                }
            }
        }
    }
    
    private fun startPolling() {
        pollingRunnable = object : Runnable {
            override fun run() {
                loadInvoices(showLoading = false) // Don't show loading spinner during polling
                pollingHandler.postDelayed(this, POLLING_INTERVAL)
            }
        }
        pollingHandler.post(pollingRunnable!!)
    }
    
    override fun onDestroy() {
        super.onDestroy()
        pollingRunnable?.let {
            pollingHandler.removeCallbacks(it)
        }
    }
}

