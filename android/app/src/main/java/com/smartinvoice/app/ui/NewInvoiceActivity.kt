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
        val adapter = BoqAutocompleteAdapter(
            this,
            android.R.layout.simple_dropdown_item_1line,
            boqItems
        ) { item ->
            "${item.sapNumber} - ${item.shortDescription} (${item.unit}) - R${item.rate}"
        }

        binding.boqItemAutoComplete.setAdapter(adapter)

        binding.boqItemAutoComplete.setOnItemClickListener { _, _, position, _ ->
            val selectedItem = adapter.getItem(position)
            // Item selected, ready to add with quantity
        }
    }

    private fun loadBoqItems() {
        lifecycleScope.launch {
            try {
                val response = apiService.getActiveBoqItems("", 1000)
                boqItems.clear()
                boqItems.addAll(response.items)
                
                // Update autocomplete adapter
                val adapter = BoqAutocompleteAdapter(
                    this@NewInvoiceActivity,
                    android.R.layout.simple_dropdown_item_1line,
                    boqItems
                ) { item ->
                    "${item.sapNumber} - ${item.shortDescription} (${item.unit}) - R${item.rate}"
                }
                binding.boqItemAutoComplete.setAdapter(adapter)
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@NewInvoiceActivity, "Failed to load BOQ items: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun addItem() {
        val selectedText = binding.boqItemAutoComplete.text.toString().trim()
        if (selectedText.isEmpty()) {
            binding.boqItemAutoComplete.error = "Please select an item from BOQ"
            return
        }

        // Find selected BOQ item
        val selectedItem = boqItems.find { item ->
            "${item.sapNumber} - ${item.shortDescription} (${item.unit}) - R${item.rate}" == selectedText
        } ?: run {
            binding.boqItemAutoComplete.error = "Selected item not found"
            return
        }

        val quantityText = binding.quantityEditText.text.toString().trim()
        val quantity = quantityText.toDoubleOrNull() ?: 0.0

        if (quantity <= 0) {
            binding.quantityEditText.error = "Quantity must be greater than 0"
            return
        }

        val unitPrice = selectedItem.rate.toDoubleOrNull() ?: 0.0
        val total = quantity * unitPrice

        val invoiceLine = InvoiceLineItem(
            boqItem = selectedItem,
            quantity = quantity,
            unitPrice = unitPrice,
            total = total
        )

        invoiceItems.add(invoiceLine)
        itemsAdapter.submitList(invoiceItems.toList())

        // Reset fields
        binding.boqItemAutoComplete.text?.clear()
        binding.quantityEditText.setText("0")
        binding.quantityEditText.clearFocus()

        calculateTotal()
    }

    private fun calculateTotal() {
        val total = invoiceItems.sumOf { it.total }
        binding.totalAmountText.text = String.format(Locale.getDefault(), "R%.2f", total)
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
            projectSite = binding.projectSiteEditText.text.toString().trim().takeIf { it.isNotEmpty() },
            preparedBy = binding.preparedByEditText.text.toString().trim().takeIf { it.isNotEmpty() },
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
                val invoice = apiService.createInvoice(invoiceRequest)
                
                // Upload photos if any
                photoUris.forEach { uri ->
                    try {
                        uploadPhoto(invoice.id, uri)
                    } catch (e: Exception) {
                        e.printStackTrace()
                        // Continue even if photo upload fails
                    }
                }

                Toast.makeText(this@NewInvoiceActivity, "Invoice saved successfully", Toast.LENGTH_SHORT).show()
                finish()
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@NewInvoiceActivity, "Failed to save invoice: ${e.message}", Toast.LENGTH_LONG).show()
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
