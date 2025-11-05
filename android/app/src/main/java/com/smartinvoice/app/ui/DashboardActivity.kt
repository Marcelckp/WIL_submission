package com.smartinvoice.app.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.PopupMenu
import androidx.core.util.Pair
import androidx.lifecycle.lifecycleScope
import com.google.android.material.datepicker.MaterialDatePicker
import com.google.android.material.snackbar.Snackbar
import com.smartinvoice.app.R
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
    private val pollingHandler = Handler(Looper.getMainLooper())
    private var pollingRunnable: Runnable? = null
    private val POLLING_INTERVAL = 5_000L // 5 seconds
    private var previousInvoiceCount = 0
    private var previousTotalAmount = 0.0
    private var currentUserId: String? = null
    private var isInitialized = false

    override fun onResume() {
        super.onResume()
        // Only check for user changes after activity is initialized
        if (isInitialized) {
            val userId = prefs.getUserId()
            if (userId != currentUserId) {
                // User changed - reset everything and reload
                currentUserId = userId
                previousInvoiceCount = 0
                previousTotalAmount = 0.0
                // Recreate API service to ensure we're using the latest token
                apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
                // Stop any existing polling
                pollingRunnable?.let {
                    pollingHandler.removeCallbacks(it)
                }
                // Reload data and restart polling
                loadDashboardData()
                startPolling()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)

        // Initialize current user ID to detect user changes
        currentUserId = prefs.getUserId()

        // Reset previous stats when activity starts (ensures new user sees correct data)
        previousInvoiceCount = 0
        previousTotalAmount = 0.0

        setupViews()
        loadDashboardData()
        startPolling()
        
        // Mark as initialized after setup is complete
        isInitialized = true
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
                    .setSelection(
                        Pair(
                            startDateMillis ?: MaterialDatePicker.todayInUtcMilliseconds(),
                            endDateMillis ?: MaterialDatePicker.todayInUtcMilliseconds()
                        )
                    )
                    .build()
                picker.addOnPositiveButtonClickListener { range ->
                    // Set start date to beginning of day (00:00:00)
                    val startCal = Calendar.getInstance()
                    startCal.timeInMillis = range.first
                    startCal.set(Calendar.HOUR_OF_DAY, 0)
                    startCal.set(Calendar.MINUTE, 0)
                    startCal.set(Calendar.SECOND, 0)
                    startCal.set(Calendar.MILLISECOND, 0)
                    startDateMillis = startCal.timeInMillis
                    
                    // Set end date to end of day (23:59:59.999)
                    val endCal = Calendar.getInstance()
                    endCal.timeInMillis = range.second
                    endCal.set(Calendar.HOUR_OF_DAY, 23)
                    endCal.set(Calendar.MINUTE, 59)
                    endCal.set(Calendar.SECOND, 59)
                    endCal.set(Calendar.MILLISECOND, 999)
                    endDateMillis = endCal.timeInMillis
                    
                    if (startDateMillis != null && endDateMillis != null) {
                        periodPrefs.edit().putLong("start", startDateMillis!!).putLong("end", endDateMillis!!).apply()
                    }
                    updateSelectedPeriodText()
                    loadDashboardData()
                }
                picker.show(supportFragmentManager, "rangePicker")
            }

            // Setup settings button with logout menu
            settingsButton.setOnClickListener {
                showSettingsMenu(it)
            }
        }
    }

    private fun showSettingsMenu(view: View) {
        val popupMenu = PopupMenu(this, view)
        
        // Create a simple menu item for logout
        val menu = popupMenu.menu
        menu.add(0, 1, 0, getString(R.string.logout))
        
        popupMenu.setOnMenuItemClickListener { item ->
            if (item.itemId == 1) {
                showLogoutConfirmation()
                true
            } else {
                false
            }
        }
        popupMenu.show()
    }

    private fun showLogoutConfirmation() {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.logout))
            .setMessage(getString(R.string.logout_confirmation))
            .setPositiveButton(getString(R.string.yes)) { _, _ ->
                logout()
            }
            .setNegativeButton(getString(R.string.no), null)
            .show()
    }

    private fun logout() {
        // Clear all stored preferences
        prefs.clear()
        
        // Clear dashboard period preferences
        periodPrefs.edit().clear().apply()
        
        // Navigate to login screen
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }

    private fun loadDashboardData(showLoading: Boolean = true) {
        if (showLoading) {
            binding.progressBar.visibility = View.VISIBLE
        }

        lifecycleScope.launch {
            try {
                // Ensure we're using the latest token by recreating the API service
                apiService = com.smartinvoice.app.data.remote.ApiClient.create(this@DashboardActivity)
                
                // Debug: Log current user info
                val currentUserId = prefs.getUserId()
                val currentUserEmail = prefs.getUserEmail()
                val currentUserName = prefs.getUserName()
                android.util.Log.d("DashboardActivity", "Current user: ID=$currentUserId, Email=$currentUserEmail, Name=$currentUserName")
                
                val response = apiService.getInvoices()
                
                android.util.Log.d("DashboardActivity", "Received ${response.invoices.size} invoices from API")
                
                // Double-check that we're only showing invoices for the current user
                val filteredInvoices = if (currentUserId != null) {
                    // Filter invoices client-side as an extra safety measure
                    // This ensures we only show invoices created by the current user
                    // Backend should already filter, but this adds an extra layer of protection
                    val filtered = response.invoices.filter { 
                        it.createdBy != null && it.createdBy == currentUserId 
                    }
                    android.util.Log.d("DashboardActivity", "Filtered to ${filtered.size} invoices for user $currentUserId")
                    filtered
                } else {
                    // If no user ID, show empty list to prevent showing wrong user's data
                    android.util.Log.w("DashboardActivity", "No user ID found - showing empty list")
                    emptyList()
                }
                
                updateDashboardStatistics(filteredInvoices, isPolling = !showLoading)
            } catch (e: Exception) {
                e.printStackTrace()
                // Show error or use default values
                updateDashboardStatistics(emptyList(), isPolling = !showLoading)
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
                loadDashboardData(showLoading = false) // Don't show loading spinner during polling
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

    private fun updateDashboardStatistics(invoices: List<InvoiceResponse>, isPolling: Boolean = false) {
        binding.apply {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val start = startDateMillis
            val end = endDateMillis
            val filtered = if (start != null && end != null) {
                invoices.filter { invoice ->
                    try {
                        // Parse the invoice date (format: yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss...)
                        val dateStr = invoice.date.substring(0, minOf(10, invoice.date.length))
                        val parsedDate = sdf.parse(dateStr) ?: return@filter false
                        
                        // Create calendar instances for comparison
                        val invoiceCal = Calendar.getInstance()
                        invoiceCal.time = parsedDate
                        invoiceCal.set(Calendar.HOUR_OF_DAY, 0)
                        invoiceCal.set(Calendar.MINUTE, 0)
                        invoiceCal.set(Calendar.SECOND, 0)
                        invoiceCal.set(Calendar.MILLISECOND, 0)
                        val invoiceTime = invoiceCal.timeInMillis
                        
                        // Check if invoice date falls within the selected range (inclusive)
                        invoiceTime >= start && invoiceTime <= end
                    } catch (e: Exception) { 
                        false 
                    }
                }
            } else invoices

            val totalInvoices = filtered.size
            
            // Calculate total amount for ALL invoices (draft or any state)
            // Use total field if available, otherwise calculate from line items including VAT
            val totalAmount = filtered.sumOf { invoice ->
                if (invoice.total != null) {
                    // Use existing total if available (includes VAT)
                    invoice.total!!.toDoubleOrNull() ?: 0.0
                } else {
                    // Calculate from line items for draft/pending invoices
                    val subtotal = invoice.lines?.sumOf { line ->
                        val qty = line.quantity.toDoubleOrNull() ?: 0.0
                        val price = line.unitPrice.toDoubleOrNull() ?: 0.0
                        qty * price
                    } ?: 0.0
                    
                    // Add VAT (default 15% if not specified)
                    val vatPercent = invoice.vatPercent?.toDoubleOrNull() ?: 15.0
                    val vatAmount = subtotal * (vatPercent / 100.0)
                    
                    // Return total including VAT
                    subtotal + vatAmount
                }
            }

            // Show notifications for changes (only during polling)
            if (isPolling && previousInvoiceCount > 0) {
                if (totalInvoices > previousInvoiceCount) {
                    val newCount = totalInvoices - previousInvoiceCount
                    Snackbar.make(
                        binding.root,
                        "$newCount new invoice${if (newCount > 1) "s" else ""} received",
                        Snackbar.LENGTH_LONG
                    ).show()
                }
                
                if (totalAmount > previousTotalAmount) {
                    val increase = totalAmount - previousTotalAmount
                    val formattedIncrease = currencyFormatter.format(increase)
                    Snackbar.make(
                        binding.root,
                        "Total amount increased by $formattedIncrease",
                        Snackbar.LENGTH_LONG
                    ).show()
                }
            }

            previousInvoiceCount = totalInvoices
            previousTotalAmount = totalAmount

            totalInvoicesValue.text = totalInvoices.toString()
            
            // Format amount and set with tooltip
            val formattedAmount = currencyFormatter.format(totalAmount)
            totalAmountValue.text = formattedAmount
            
            // Set content description for accessibility and potential tooltip
            totalAmountValue.contentDescription = formattedAmount
            totalAmountValue.setOnLongClickListener {
                // Show full value in a toast when long-pressed
                android.widget.Toast.makeText(
                    this@DashboardActivity,
                    "Total Amount: $formattedAmount",
                    android.widget.Toast.LENGTH_SHORT
                ).show()
                true
            }
        }
    }

    private fun updateSelectedPeriodText() {
        val sdf = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
        val start = startDateMillis?.let { sdf.format(Date(it)) } ?: ""
        val end = endDateMillis?.let { sdf.format(Date(it)) } ?: ""
        binding.selectedPeriodText.text = if (start.isNotEmpty() && end.isNotEmpty()) "$start - $end" else "All time"
    }
}

