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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInvoiceListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)

        setupViews()
        loadInvoices()
        startPolling()
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
                val response = apiService.getInvoices()
                
                // Detect changes for notifications (only during polling)
                if (!showLoading && previousInvoicesMap.isNotEmpty()) {
                    val newInvoices = response.invoices.filter { !previousInvoicesMap.containsKey(it.id) }
                    val statusChanged = response.invoices.filter { invoice ->
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
                response.invoices.forEach { invoice ->
                    previousInvoicesMap[invoice.id] = invoice
                }
                
                adapter.submitList(response.invoices)
                
                // Update count
                val count = response.invoices.size
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

