package com.smartinvoice.app.data.remote

import com.smartinvoice.app.BuildConfig
import com.smartinvoice.app.data.remote.models.*
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

interface ApiService {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("boq/active/items")
    suspend fun getActiveBoqItems(
        @Query("q") query: String = "",
        @Query("limit") limit: Int = 20
    ): BoqItemsResponse

    @GET("invoices")
    suspend fun getInvoices(
        @Query("status") status: String? = null,
        @Query("limit") limit: Int = 100,
        @Query("offset") offset: Int = 0
    ): InvoiceListResponse

    @POST("invoices")
    suspend fun createInvoice(@Body request: CreateInvoiceRequest): InvoiceResponse

    @GET("invoices/{id}")
    suspend fun getInvoice(@Path("id") id: String): InvoiceResponse

    @PATCH("invoices/{id}")
    suspend fun updateInvoice(@Path("id") id: String, @Body request: CreateInvoiceRequest): InvoiceResponse

    @POST("invoices/{id}/submit")
    suspend fun submitInvoice(@Path("id") id: String): InvoiceResponse

    @GET("invoices/{id}/updates")
    suspend fun getInvoiceUpdates(
        @Path("id") id: String,
        @Query("since") since: Long
    ): InvoiceUpdatesResponse

    @POST("invoices/{id}/comments")
    suspend fun addComment(
        @Path("id") id: String,
        @Body request: Map<String, String>
    ): CommentResponse

    @POST("invoices/{id}/email")
    suspend fun sendInvoiceEmail(
        @Path("id") id: String,
        @Body request: SendEmailRequest
    ): SendEmailResponse

    @Multipart
    @POST("invoices/{id}/media")
    suspend fun uploadMedia(
        @Path("id") id: String,
        @Part file: okhttp3.MultipartBody.Part
    ): MediaResponse

    @DELETE("invoices/{id}/media/{mediaId}")
    suspend fun deleteMedia(
        @Path("id") id: String,
        @Path("mediaId") mediaId: String
    )
}

data class MediaResponse(
    val id: String,
    val url: String,
    val mimeType: String?,
    val createdAt: String
)

data class SendEmailRequest(
    val to: String
)

data class SendEmailResponse(
    val status: String,
    val messageId: String?
)

class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): okhttp3.Response {
        val token = tokenProvider()
        val request = chain.request().newBuilder()
            .apply {
                token?.let {
                    addHeader("Authorization", "Bearer $it")
                }
            }
            .build()
        return chain.proceed(request)
    }
}

object ApiClient {
    fun create(context: android.content.Context): ApiService {
        val tokenProvider = {
            com.smartinvoice.app.util.SharedPreferencesHelper.getInstance(context).getToken()
        }
        return create(tokenProvider)
    }
    
    fun create(tokenProvider: () -> String?): ApiService {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .addInterceptor(AuthInterceptor(tokenProvider))
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}

