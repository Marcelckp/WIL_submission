package com.smartinvoice.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.smartinvoice.app.data.remote.ApiService
import com.smartinvoice.app.databinding.ActivityInvoiceListBinding
import com.smartinvoice.app.util.SharedPreferencesHelper
import kotlinx.coroutines.launch

class InvoiceListActivity : AppCompatActivity() {
    private lateinit var binding: ActivityInvoiceListBinding
    private lateinit var apiService: ApiService
    private lateinit var prefs: SharedPreferencesHelper
    private lateinit var adapter: InvoiceListAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInvoiceListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = com.smartinvoice.app.data.remote.ApiService.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)

        setupViews()
        loadInvoices()
    }

    private fun setupViews() {
        binding.apply {
            backButton.setOnClickListener {
                finish()
            }

            adapter = InvoiceListAdapter { invoice ->
                // Navigate to invoice detail
                val intent = Intent(this@InvoiceListActivity, InvoiceDetailActivity::class.java)
                intent.putExtra("invoice_id", invoice.id)
                startActivity(intent)
            }

            recyclerView.layoutManager = LinearLayoutManager(this@InvoiceListActivity)
            recyclerView.adapter = adapter
        }
    }

    private fun loadInvoices() {
        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val response = apiService.getInvoices()
                adapter.submitList(response.invoices)
                
                // Update count
                val count = response.invoices.size
                binding.savedCountText.text = "$count ${getString(com.smartinvoice.app.R.string.saved)}"
                
            } catch (e: Exception) {
                e.printStackTrace()
                // Show error
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }
}

