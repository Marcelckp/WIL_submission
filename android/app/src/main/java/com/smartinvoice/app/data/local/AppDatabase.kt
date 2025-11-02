package com.smartinvoice.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.smartinvoice.app.data.local.dao.BoqItemDao
import com.smartinvoice.app.data.local.dao.InvoiceDao
import com.smartinvoice.app.data.local.dao.InvoiceLineDao
import com.smartinvoice.app.data.local.entities.BoqItemEntity
import com.smartinvoice.app.data.local.entities.InvoiceEntity
import com.smartinvoice.app.data.local.entities.InvoiceLineEntity

@Database(
    entities = [BoqItemEntity::class, InvoiceEntity::class, InvoiceLineEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun boqItemDao(): BoqItemDao
    abstract fun invoiceDao(): InvoiceDao
    abstract fun invoiceLineDao(): InvoiceLineDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "smart_invoice_database"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}

