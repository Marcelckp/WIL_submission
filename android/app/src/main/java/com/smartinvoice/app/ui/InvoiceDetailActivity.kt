package com.smartinvoice.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.smartinvoice.app.databinding.ActivityInvoiceDetailBinding

class InvoiceDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityInvoiceDetailBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityInvoiceDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val invoiceId = intent.getStringExtra("invoice_id")
        // TODO: Load and display invoice details
    }
}

