package com.smartinvoice.app.ui

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.smartinvoice.app.data.remote.ApiService
import okhttp3.MediaType.Companion.toMediaType
import com.smartinvoice.app.data.remote.models.BoqItemResponse
import com.smartinvoice.app.data.remote.models.CreateInvoiceRequest
import com.smartinvoice.app.data.remote.models.InvoiceLineRequest
import com.smartinvoice.app.databinding.ActivityNewInvoiceBinding
import com.smartinvoice.app.util.SharedPreferencesHelper
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.net.ConnectException
import java.net.SocketTimeoutException

data class InvoiceLineItem(
    val id: String = UUID.randomUUID().toString(),
    val boqItem: BoqItemResponse,
    var quantity: Double,
    val unitPrice: Double,
    val total: Double
)

class NewInvoiceActivity : AppCompatActivity() {
    private lateinit var binding: ActivityNewInvoiceBinding
    private lateinit var apiService: ApiService
    private lateinit var prefs: SharedPreferencesHelper
    
    private lateinit var itemsAdapter: InvoiceItemsAdapter
    private lateinit var photosAdapter: PhotoAdapter
    
    private val invoiceItems: MutableList<InvoiceLineItem> = mutableListOf()
    private val photoUris: MutableList<Uri> = mutableListOf()
    private val boqItems: MutableList<BoqItemResponse> = mutableListOf()
    private var selectedBoqItem: BoqItemResponse? = null
    
    private var invoiceId: String? = null // For editing existing invoice
    private var isEditMode = false
    
    private val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

    private var photoUri: Uri? = null
    
    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && photoUri != null) {
            photoUri?.let {
                photoUris.add(it)
                photosAdapter.submitList(photoUris.toList())
            }
        }
    }

    private val galleryLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            photoUris.add(it)
            photosAdapter.submitList(photoUris.toList())
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNewInvoiceBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)

        // Initialize adapters now that fields are ready
        itemsAdapter = InvoiceItemsAdapter(
            onDelete = { item ->
                invoiceItems.removeAll { it.id == item.id }
                itemsAdapter.submitList(invoiceItems.toList())
                calculateTotal()
            }
        )

        photosAdapter = PhotoAdapter(
            onDelete = { photo ->
                photoUris.remove(photo)
                photosAdapter.submitList(photoUris.toList())
            }
        )

        setupViews()
        setupDateField()
        loadBoqItems()
        showOfflineDisclaimer()
        
        // Check if editing existing invoice
        invoiceId = intent.getStringExtra("invoice_id")
        if (invoiceId != null) {
            isEditMode = true
            loadInvoiceForEdit()
        }
    }

    private fun setupViews() {
        binding.apply {
            // Back button
            backButton.setOnClickListener {
                finish()
            }

            // Setup RecyclerViews
            itemsRecyclerView.layoutManager = LinearLayoutManager(this@NewInvoiceActivity)
            itemsRecyclerView.adapter = itemsAdapter

            photosRecyclerView.layoutManager = LinearLayoutManager(
                this@NewInvoiceActivity,
                LinearLayoutManager.HORIZONTAL,
                false
            )
            photosRecyclerView.adapter = photosAdapter

            // Setup BOQ Autocomplete
            setupBoqAutocomplete()

            // Add Item Button
            addItemButton.setOnClickListener {
                addItem()
            }

            // Quantity input - auto-update on change
            quantityEditText.setOnFocusChangeListener { _, hasFocus ->
                if (!hasFocus) {
                    // Update quantity when focus lost
                }
            }

            // Upload Photos Button
            uploadPhotosButton.setOnClickListener {
                showPhotoOptions()
            }

            // Preview Button
            previewButton.setOnClickListener {
                // TODO: Show preview dialog
                Toast.makeText(this@NewInvoiceActivity, "Preview functionality coming soon", Toast.LENGTH_SHORT).show()
            }

            // Save Invoice Button
            saveInvoiceButton.setOnClickListener {
                saveInvoice()
            }
        }
    }

    private fun setupDateField() {
        // Set today's date as default
        val today = dateFormat.format(Date())
        binding.dateEditText.setText(today)

        // Set prepared by from user name
        prefs.getUserName()?.let { name ->
            binding.preparedByEditText.setText(name)
        }
    }

    private fun setupBoqAutocomplete() {
        updateBoqAdapter()

        binding.boqItemAutoComplete.setOnItemClickListener { _, _, position, _ ->
            val adapter = binding.boqItemAutoComplete.adapter as BoqAutocompleteAdapter
            val item = adapter.getItem(position)
            selectedBoqItem = item
            val label = "${item.sapNumber} - ${item.shortDescription} (${item.unit}) - R${item.rate}"
            binding.boqItemAutoComplete.setText(label, false)
        }
        
        // Clear selection when user starts typing
        binding.boqItemAutoComplete.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                // Clear selected item if user is typing (not selecting from dropdown)
                if (before == 0 && count > 0) {
                    selectedBoqItem = null
                }
            }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
    }

    private fun loadBoqItems() {
        lifecycleScope.launch {
            // Try loading cached BOQ items first for faster startup
            loadCachedBoqItems()
            
            try {
                val response = apiService.getActiveBoqItems("", 1000)
                boqItems.clear()
                boqItems.addAll(response.items)
                
                // Save to cache for offline use
                val gson = Gson()
                val json = gson.toJson(response.items)
                prefs.saveBoqItemsJson(json)
                
                // Update autocomplete adapter
                updateBoqAdapter()
                
            } catch (e: ConnectException) {
                // Connection error - use cached data if available
                if (boqItems.isEmpty()) {
                    Toast.makeText(
                        this@NewInvoiceActivity,
                        "Cannot connect to server. Please check your connection and ensure the backend is running.",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    Toast.makeText(
                        this@NewInvoiceActivity,
                        "Using cached BOQ items. Server unavailable.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } catch (e: SocketTimeoutException) {
                if (boqItems.isEmpty()) {
                    Toast.makeText(
                        this@NewInvoiceActivity,
                        "Connection timeout. Please check your network.",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    Toast.makeText(
                        this@NewInvoiceActivity,
                        "Using cached BOQ items. Server timeout.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                if (boqItems.isEmpty()) {
                    Toast.makeText(
                        this@NewInvoiceActivity,
                        "Failed to load BOQ items: ${e.message}. Please check your connection.",
                        Toast.LENGTH_LONG
                    ).show()
                } else {
                    Toast.makeText(
                        this@NewInvoiceActivity,
                        "Using cached BOQ items. ${e.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }
    
    private fun loadCachedBoqItems() {
        try {
            val cachedJson = prefs.getBoqItemsJson()
            if (cachedJson != null) {
                val gson = Gson()
                val type = object : TypeToken<List<BoqItemResponse>>() {}.type
                val cachedItems: List<BoqItemResponse> = gson.fromJson(cachedJson, type)
                boqItems.clear()
                boqItems.addAll(cachedItems)
                updateBoqAdapter()
            }
        } catch (e: Exception) {
            // Ignore cache errors, will try API
        }
    }
    
    private fun updateBoqAdapter() {
        val adapter = BoqAutocompleteAdapter(
            this@NewInvoiceActivity,
            android.R.layout.simple_dropdown_item_1line,
            boqItems
        ) { item ->
            "${item.sapNumber} - ${item.shortDescription} (${item.unit}) - R${item.rate}"
        }
        binding.boqItemAutoComplete.setAdapter(adapter)
    }

    private fun addItem() {
        val currentItem = selectedBoqItem
        if (currentItem == null) {
            binding.boqItemAutoComplete.error = "Please select an item from BOQ"
            return
        }

        val quantityText = binding.quantityEditText.text.toString().trim()
        val quantity = quantityText.toDoubleOrNull() ?: 0.0

        if (quantity <= 0) {
            binding.quantityEditText.error = "Quantity must be greater than 0"
            return
        }

        val unitPrice = currentItem.rate.toDoubleOrNull() ?: 0.0
        val total = quantity * unitPrice

        val invoiceLine = InvoiceLineItem(
            boqItem = currentItem,
            quantity = quantity,
            unitPrice = unitPrice,
            total = total
        )

        invoiceItems.add(invoiceLine)
        itemsAdapter.submitList(invoiceItems.toList())

        // Reset fields
        binding.boqItemAutoComplete.text?.clear()
        selectedBoqItem = null
        binding.quantityEditText.setText("0")
        binding.quantityEditText.clearFocus()

        calculateTotal()
    }

    private fun calculateTotal() {
        val total = invoiceItems.sumOf { it.total }
        binding.totalAmountText.text = String.format(Locale.getDefault(), "R%.2f", total)
    }

    private fun loadInvoiceForEdit() {
        val id = invoiceId ?: return
        
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                val invoice = apiService.getInvoice(id)
                
                // Populate form fields
                binding.apply {
                    // Convert date from yyyy-MM-dd to dd/MM/yyyy
                    val date = try {
                        val parsed = apiDateFormat.parse(invoice.date) ?: Date()
                        dateFormat.format(parsed)
                    } catch (e: Exception) {
                        invoice.date
                    }
                    dateEditText.setText(date)
                    
                    customerNameEditText.setText(invoice.customerName)
                    customerEmailEditText.setText(invoice.customerEmail ?: "")
                    projectSiteEditText.setText(invoice.projectSite ?: "")
                    preparedByEditText.setText(invoice.preparedBy ?: "")
                    binding.areaEditText.setText(invoice.area ?: "")
                    binding.jobNoEditText.setText(invoice.jobNo ?: "")
                    binding.grnEditText.setText(invoice.grn ?: "")
                    binding.poEditText.setText(invoice.po ?: "")
                    
                    // Load line items
                    invoice.lines?.forEach { line ->
                        // Parse SAP number and description from itemName
                        val parts = line.itemName.split(" - ", limit = 2)
                        val sapNumber = parts.getOrNull(0) ?: ""
                        val description = parts.getOrNull(1) ?: line.itemName
                        
                        val boqItem = BoqItemResponse(
                            sapNumber = sapNumber,
                            shortDescription = description,
                            unit = line.unit,
                            rate = line.unitPrice,
                            category = null
                        )
                        
                        val item = InvoiceLineItem(
                            id = line.id,
                            boqItem = boqItem,
                            quantity = line.quantity.toDoubleOrNull() ?: 0.0,
                            unitPrice = line.unitPrice.toDoubleOrNull() ?: 0.0,
                            total = line.amount.toDoubleOrNull() ?: 0.0
                        )
                        invoiceItems.add(item)
                    }
                    itemsAdapter.submitList(invoiceItems.toList())
                    calculateTotal()
                    
                    // Update button text
                    saveInvoiceButton.text = getString(com.smartinvoice.app.R.string.save)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@NewInvoiceActivity, "Failed to load invoice: ${e.message}", Toast.LENGTH_LONG).show()
                finish()
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }
    
    private fun showOfflineDisclaimer() {
        // Show disclaimer to inform users that rates are from cached BOQ
        binding.offlineBannerCard.visibility = View.VISIBLE
        binding.offlineBannerText.text = "Rates reflect BOQ version as cached. Final invoice rates may update after sync."
    }

    private fun showPhotoOptions() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Add Photo")
            .setItems(arrayOf("Take Photo", "Choose from Gallery")) { _, which ->
                when (which) {
                    0 -> takePhoto()
                    1 -> chooseFromGallery()
                }
            }
            .show()
    }

    private fun takePhoto() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), CAMERA_PERMISSION_REQUEST)
            return
        }

        // Create file for photo
        val photoFile = java.io.File(getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES), "invoice_photo_${System.currentTimeMillis()}.jpg")
        try {
            photoUri = androidx.core.content.FileProvider.getUriForFile(
                this,
                "${packageName}.fileprovider",
                photoFile
            )
        } catch (e: Exception) {
            photoUri = android.net.Uri.fromFile(photoFile)
        }
        
        photoUri?.let { takePictureLauncher.launch(it) }
    }

    private fun chooseFromGallery() {
        galleryLauncher.launch("image/*")
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            takePhoto()
        }
    }

    private fun saveInvoice() {
        // Validate required fields
        val customerName = binding.customerNameEditText.text.toString().trim()
        if (customerName.isEmpty()) {
            binding.customerNameEditText.error = "Customer name is required"
            return
        }

        if (invoiceItems.isEmpty()) {
            Toast.makeText(this, "Please add at least one item", Toast.LENGTH_SHORT).show()
            return
        }

        val dateText = binding.dateEditText.text.toString().trim()
        val date = try {
            // Convert from dd/MM/yyyy to yyyy-MM-dd
            val parsedDate = dateFormat.parse(dateText) ?: Date()
            apiDateFormat.format(parsedDate)
        } catch (e: Exception) {
            apiDateFormat.format(Date())
        }

        val invoiceRequest = CreateInvoiceRequest(
            date = date,
            customerName = customerName,
            customerEmail = binding.customerEmailEditText.text.toString().trim().takeIf { it.isNotEmpty() },
            projectSite = binding.projectSiteEditText.text.toString().trim().takeIf { it.isNotEmpty() },
            preparedBy = binding.preparedByEditText.text.toString().trim().takeIf { it.isNotEmpty() },
            area = binding.areaEditText.text.toString().trim().takeIf { it.isNotEmpty() },
            jobNo = binding.jobNoEditText.text.toString().trim().takeIf { it.isNotEmpty() },
            grn = binding.grnEditText.text.toString().trim().takeIf { it.isNotEmpty() },
            po = binding.poEditText.text.toString().trim().takeIf { it.isNotEmpty() },
            address = null, // Address field not in current UI, can be added later
            lines = invoiceItems.map { item ->
                InvoiceLineRequest(
                    itemName = "${item.boqItem.sapNumber} - ${item.boqItem.shortDescription}",
                    description = item.boqItem.shortDescription,
                    unit = item.boqItem.unit,
                    unitPrice = String.format(Locale.getDefault(), "%.2f", item.unitPrice),
                    quantity = String.format(Locale.getDefault(), "%.2f", item.quantity),
                    amount = String.format(Locale.getDefault(), "%.2f", item.total)
                )
            }
        )

        // Show progress
        binding.saveInvoiceButton.isEnabled = false
        binding.progressBar.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val invoice = if (isEditMode && invoiceId != null) {
                    // Update existing invoice
                    apiService.updateInvoice(invoiceId!!, invoiceRequest)
                } else {
                    // Create new invoice
                    apiService.createInvoice(invoiceRequest)
                }
                
                // Upload photos if any (only for new invoices, existing ones already have photos)
                if (!isEditMode) {
                    photoUris.forEach { uri ->
                        try {
                            uploadPhoto(invoice.id, uri)
                        } catch (e: Exception) {
                            e.printStackTrace()
                            // Continue even if photo upload fails
                        }
                    }
                }

                Toast.makeText(this@NewInvoiceActivity, if (isEditMode) "Invoice updated successfully" else "Invoice saved successfully", Toast.LENGTH_SHORT).show()
                finish()
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@NewInvoiceActivity, "Failed to ${if (isEditMode) "update" else "save"} invoice: ${e.message}", Toast.LENGTH_LONG).show()
                binding.saveInvoiceButton.isEnabled = true
                binding.progressBar.visibility = View.GONE
            }
        }
    }

    private suspend fun uploadPhoto(invoiceId: String, uri: Uri) {
        try {
            val inputStream = contentResolver.openInputStream(uri) ?: return
            val bytes = inputStream.readBytes()
            inputStream.close()

            val requestFile = okhttp3.RequestBody.create("image/jpeg".toMediaType(), bytes)
            
            val filePart = okhttp3.MultipartBody.Part.createFormData("file", "photo.jpg", requestFile)
            apiService.uploadMedia(invoiceId, filePart)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    companion object {
        private const val CAMERA_PERMISSION_REQUEST = 1001
    }
}
