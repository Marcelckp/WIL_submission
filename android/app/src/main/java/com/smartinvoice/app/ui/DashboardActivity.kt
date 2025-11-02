package com.smartinvoice.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.smartinvoice.app.data.remote.ApiService
import com.smartinvoice.app.data.remote.models.InvoiceResponse
import com.smartinvoice.app.databinding.ActivityDashboardBinding
import com.smartinvoice.app.util.SharedPreferencesHelper
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class DashboardActivity : AppCompatActivity() {
    private lateinit var binding: ActivityDashboardBinding
    private lateinit var apiService: ApiService
    private lateinit var prefs: SharedPreferencesHelper
    private val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "ZA"))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = com.smartinvoice.app.data.remote.ApiService.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)

        setupViews()
        loadDashboardData()
    }

    private fun setupViews() {
        binding.apply {
            // Set user info
            welcomeText.text = "Welcome back"
            userEmailText.text = prefs.getUserEmail() ?: ""

            // Setup action buttons
            createInvoiceCard.setOnClickListener {
                startActivity(Intent(this@DashboardActivity, NewInvoiceActivity::class.java))
            }

            viewInvoicesCard.setOnClickListener {
                startActivity(Intent(this@DashboardActivity, InvoiceListActivity::class.java))
            }
        }
    }

    private fun loadDashboardData() {
        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val response = apiService.getInvoices()
                updateDashboardStatistics(response.invoices)
            } catch (e: Exception) {
                e.printStackTrace()
                // Show error or use default values
                updateDashboardStatistics(emptyList())
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }

    private fun updateDashboardStatistics(invoices: List<InvoiceResponse>) {
        binding.apply {
            val totalInvoices = invoices.size
            val totalAmount = invoices
                .filter { it.total != null }
                .sumOf { it.total!!.toDoubleOrNull() ?: 0.0 }

            val approvedInvoices = invoices.filter { it.status == "APPROVED" || it.status == "FINAL" }
            val approvedAmount = approvedInvoices
                .sumOf { it.total?.toDoubleOrNull() ?: 0.0 }

            val draftPendingInvoices = invoices.filter { it.status == "DRAFT" || it.status == "SUBMITTED" }
            val draftPendingAmount = draftPendingInvoices
                .sumOf { it.total?.toDoubleOrNull() ?: 0.0 }

            val mostCostlyInvoice = invoices
                .filter { it.total != null }
                .maxByOrNull { it.total!!.toDoubleOrNull() ?: 0.0 }

            // Calculate highest quantity invoice (sum of all line quantities)
            val highestQuantityInvoice = invoices
                .map { invoice ->
                    val totalQuantity = invoice.lines.sumOf { it.quantity.toDoubleOrNull() ?: 0.0 }
                    invoice to totalQuantity
                }
                .maxByOrNull { it.second }

            val averageInvoiceValue = if (totalInvoices > 0) totalAmount / totalInvoices else 0.0

            // Update UI
            totalInvoicesValue.text = totalInvoices.toString()
            totalAmountValue.text = currencyFormatter.format(totalAmount)

            // Show additional statistics
            if (mostCostlyInvoice != null) {
                mostCostlyValue.text = currencyFormatter.format(mostCostlyInvoice.total!!.toDoubleOrNull() ?: 0.0)
                mostCostlyCard.visibility = View.VISIBLE
            } else {
                mostCostlyCard.visibility = View.GONE
            }

            if (highestQuantityInvoice != null) {
                val totalQty = highestQuantityInvoice.second.toInt()
                highestQuantityValue.text = "$totalQty items"
                highestQuantityCard.visibility = View.VISIBLE
            } else {
                highestQuantityCard.visibility = View.GONE
            }

            totalApprovedValue.text = currencyFormatter.format(approvedAmount)
            totalDraftPendingValue.text = currencyFormatter.format(draftPendingAmount)
            averageValue.text = currencyFormatter.format(averageInvoiceValue)

            // Calculate this month's invoices
            val currentMonth = java.util.Calendar.getInstance().get(java.util.Calendar.MONTH)
            val currentYear = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
            val thisMonthInvoices = invoices.filter { invoice ->
                try {
                    val invoiceDate = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                        .parse(invoice.date.substring(0, minOf(10, invoice.date.length))) ?: return@filter false
                    val cal = java.util.Calendar.getInstance()
                    cal.time = invoiceDate
                    cal.get(java.util.Calendar.MONTH) == currentMonth &&
                            cal.get(java.util.Calendar.YEAR) == currentYear
                } catch (e: Exception) {
                    false
                }
            }
            thisMonthValue.text = thisMonthInvoices.size.toString()
        }
    }
}

