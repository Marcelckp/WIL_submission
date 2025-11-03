package com.smartinvoice.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.datepicker.MaterialDatePicker
import com.smartinvoice.app.data.remote.ApiService
import com.smartinvoice.app.data.remote.models.InvoiceResponse
import com.smartinvoice.app.databinding.ActivityDashboardBinding
import com.smartinvoice.app.util.SharedPreferencesHelper
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.Calendar
import java.util.Date

class DashboardActivity : AppCompatActivity() {
    private lateinit var binding: ActivityDashboardBinding
    private lateinit var apiService: ApiService
    private lateinit var prefs: SharedPreferencesHelper
    private val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "ZA"))
    private var startDateMillis: Long? = null
    private var endDateMillis: Long? = null
    private val periodPrefs by lazy { getSharedPreferences("dashboard_period", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)

        setupViews()
        loadDashboardData()
    }

    private fun setupViews() {
        binding.apply {
            // Set user info
            welcomeText.text = "Welcome back"
            userEmailText.text = prefs.getUserName() ?: ""

            // Setup action buttons
            createInvoiceCard.setOnClickListener {
                startActivity(Intent(this@DashboardActivity, NewInvoiceActivity::class.java))
            }

            viewInvoicesCard.setOnClickListener {
                startActivity(Intent(this@DashboardActivity, InvoiceListActivity::class.java))
            }

            // Restore saved period or default to current month
            val savedStart = periodPrefs.getLong("start", -1L)
            val savedEnd = periodPrefs.getLong("end", -1L)
            if (savedStart > 0 && savedEnd > 0) {
                startDateMillis = savedStart
                endDateMillis = savedEnd
            } else {
                val cal = Calendar.getInstance()
                cal.set(Calendar.DAY_OF_MONTH, 1)
                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                startDateMillis = cal.timeInMillis
                cal.add(Calendar.MONTH, 1)
                cal.add(Calendar.MILLISECOND, -1)
                endDateMillis = cal.timeInMillis
            }
            updateSelectedPeriodText()

            monthPickerButton.setOnClickListener {
                val picker = MaterialDatePicker.Builder.datePicker()
                    .setTitleText("Select month")
                    .build()
                picker.addOnPositiveButtonClickListener { selectedDate ->
                    val c = Calendar.getInstance()
                    c.timeInMillis = selectedDate
                    c.set(Calendar.DAY_OF_MONTH, 1)
                    c.set(Calendar.HOUR_OF_DAY, 0)
                    c.set(Calendar.MINUTE, 0)
                    c.set(Calendar.SECOND, 0)
                    c.set(Calendar.MILLISECOND, 0)
                    startDateMillis = c.timeInMillis
                    c.add(Calendar.MONTH, 1)
                    c.add(Calendar.MILLISECOND, -1)
                    endDateMillis = c.timeInMillis
                    periodPrefs.edit().putLong("start", startDateMillis!!).putLong("end", endDateMillis!!).apply()
                    updateSelectedPeriodText()
                    loadDashboardData()
                }
                picker.show(supportFragmentManager, "monthPicker")
            }

            rangePickerButton.setOnClickListener {
                val picker = MaterialDatePicker.Builder.dateRangePicker()
                    .setTitleText("Select date range")
                    .build()
                picker.addOnPositiveButtonClickListener { range ->
                    startDateMillis = range.first
                    endDateMillis = range.second
                    if (startDateMillis != null && endDateMillis != null) {
                        periodPrefs.edit().putLong("start", startDateMillis!!).putLong("end", endDateMillis!!).apply()
                    }
                    updateSelectedPeriodText()
                    loadDashboardData()
                }
                picker.show(supportFragmentManager, "rangePicker")
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
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val start = startDateMillis
            val end = endDateMillis
            val filtered = if (start != null && end != null) {
                invoices.filter { invoice ->
                    try {
                        val d = sdf.parse(invoice.date.substring(0, minOf(10, invoice.date.length))) ?: return@filter false
                        val time = d.time
                        time in start..end
                    } catch (e: Exception) { false }
                }
            } else invoices

            val totalInvoices = filtered.size
            val totalAmount = filtered
                .filter { it.total != null }
                .sumOf { it.total!!.toDoubleOrNull() ?: 0.0 }

            totalInvoicesValue.text = totalInvoices.toString()
            totalAmountValue.text = currencyFormatter.format(totalAmount)
        }
    }

    private fun updateSelectedPeriodText() {
        val sdf = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
        val start = startDateMillis?.let { sdf.format(Date(it)) } ?: ""
        val end = endDateMillis?.let { sdf.format(Date(it)) } ?: ""
        binding.selectedPeriodText.text = if (start.isNotEmpty() && end.isNotEmpty()) "$start - $end" else "All time"
    }
}

