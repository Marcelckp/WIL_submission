package com.smartinvoice.app.ui

import android.content.Context
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Filter
import android.widget.Filterable
import com.smartinvoice.app.data.remote.models.BoqItemResponse

class BoqAutocompleteAdapter(
    context: Context,
    resource: Int,
    private val items: List<BoqItemResponse>,
    private val displayText: (BoqItemResponse) -> String
) : ArrayAdapter<BoqItemResponse>(context, resource, items), Filterable {

    private var filteredItems: List<BoqItemResponse> = items

    override fun getItem(position: Int): BoqItemResponse {
        return filteredItems[position]
    }

    override fun getCount(): Int = filteredItems.size

    override fun getItemId(position: Int): Long = position.toLong()

    override fun getView(position: Int, convertView: android.view.View?, parent: ViewGroup): android.view.View {
        val view = super.getView(position, convertView, parent) as android.widget.TextView
        view.text = displayText(getItem(position))
        return view
    }

    override fun getFilter(): Filter {
        return object : Filter() {
            override fun performFiltering(constraint: CharSequence?): FilterResults {
                val results = FilterResults()
                val filtered = if (constraint.isNullOrBlank()) {
                    items
                } else {
                    val filterPattern = constraint.toString().lowercase().trim()
                    items.filter { item ->
                        item.sapNumber.lowercase().contains(filterPattern) ||
                        item.shortDescription.lowercase().contains(filterPattern) ||
                        item.category?.lowercase()?.contains(filterPattern) == true ||
                        item.unit.lowercase().contains(filterPattern)
                    }
                }
                results.values = filtered
                results.count = filtered.size
                return results
            }

            @Suppress("UNCHECKED_CAST")
            override fun publishResults(constraint: CharSequence?, results: FilterResults?) {
                if (results != null && results.count > 0) {
                    filteredItems = results.values as List<BoqItemResponse>
                    notifyDataSetChanged()
                } else {
                    filteredItems = emptyList()
                    notifyDataSetInvalidated()
                }
            }
        }
    }
}
