package com.smartinvoice.app.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.smartinvoice.app.data.remote.ApiService
import com.smartinvoice.app.data.remote.models.LoginRequest
import com.smartinvoice.app.databinding.ActivityLoginBinding
import com.smartinvoice.app.util.SharedPreferencesHelper
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private lateinit var apiService: ApiService
    private lateinit var prefs: SharedPreferencesHelper

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        apiService = com.smartinvoice.app.data.remote.ApiClient.create(this)
        prefs = SharedPreferencesHelper.getInstance(this)

        // Check if already logged in
        if (prefs.isLoggedIn()) {
            navigateToDashboard()
            return
        }

        setupViews()
    }

    private fun setupViews() {
        binding.apply {
            // Set version
            versionText.text = "Version 1.0.0"

            signInButton.setOnClickListener {
                val username = usernameEditText.text.toString().trim()
                val password = passwordEditText.text.toString().trim()

                if (username.isEmpty()) {
                    usernameEditText.error = "Username is required"
                    return@setOnClickListener
                }

                if (password.isEmpty()) {
                    passwordEditText.error = "Password is required"
                    return@setOnClickListener
                }

                login(username, password)
            }

            // Password visibility toggle
            passwordToggle.setOnClickListener {
                val selection = passwordEditText.selectionEnd
                if (passwordEditText.transformationMethod == android.text.method.HideReturnsTransformationMethod.getInstance()) {
                    passwordEditText.transformationMethod = android.text.method.PasswordTransformationMethod.getInstance()
                    passwordToggle.setImageResource(android.R.drawable.ic_menu_view)
                } else {
                    passwordEditText.transformationMethod = android.text.method.HideReturnsTransformationMethod.getInstance()
                    passwordToggle.setImageResource(android.R.drawable.ic_menu_revert)
                }
                passwordEditText.setSelection(selection)
            }
        }
    }

    private fun login(username: String, password: String) {
        binding.apply {
            signInButton.isEnabled = false
            progressBar.visibility = View.VISIBLE
        }

        lifecycleScope.launch {
            try {
                val request = LoginRequest(username, password)
                val response = apiService.login(request)

                if (response.token != null) {
                    // Save token and user info
                    prefs.saveToken(response.token)
                    response.user?.let { user ->
                        prefs.saveUser(
                            userId = user.id,
                            email = user.email,
                            name = user.name,
                            role = user.role,
                            companyId = user.companyId
                        )
                    }

                    Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()
                    navigateToDashboard()
                } else {
                    Toast.makeText(this@LoginActivity, "Login failed", Toast.LENGTH_LONG).show()
                    binding.signInButton.isEnabled = true
                    binding.progressBar.visibility = View.GONE
                }
            } catch (e: Exception) {
                e.printStackTrace()
                val errorMessage = when {
                    e is java.net.UnknownHostException -> "Cannot reach server. Check your internet connection."
                    e is java.net.SocketTimeoutException -> "Connection timeout. The server may be slow or unreachable."
                    e is java.net.ConnectException -> "Connection failed. Check if the backend is running."
                    e.message?.contains("Unable to resolve host") == true -> "DNS resolution failed. Check your network."
                    e.message?.contains("SSL") == true -> "SSL certificate error. Check server configuration."
                    else -> "Error: ${e.message ?: "Unknown error occurred"}"
                }
                android.util.Log.e("LoginActivity", "Login error: ${e.javaClass.simpleName}", e)
                Toast.makeText(this@LoginActivity, errorMessage, Toast.LENGTH_LONG).show()
                binding.signInButton.isEnabled = true
                binding.progressBar.visibility = View.GONE
            }
        }
    }

    private fun navigateToDashboard() {
        val intent = Intent(this, DashboardActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}

