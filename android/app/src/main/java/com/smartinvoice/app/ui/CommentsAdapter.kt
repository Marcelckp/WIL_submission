package com.smartinvoice.app.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.smartinvoice.app.data.remote.models.CommentResponse
import com.smartinvoice.app.databinding.ItemCommentBinding
import java.text.SimpleDateFormat
import java.util.*

class CommentsAdapter : ListAdapter<CommentResponse, CommentsAdapter.CommentViewHolder>(CommentDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CommentViewHolder {
        val binding = ItemCommentBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return CommentViewHolder(binding)
    }

    override fun onBindViewHolder(holder: CommentViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class CommentViewHolder(
        private val binding: ItemCommentBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        private val displayDateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())

        fun bind(comment: CommentResponse) {
            binding.apply {
                commentText.text = comment.body
                authorText.text = comment.author?.name ?: "Unknown"
                
                // Format date
                try {
                    val parsedDate = dateFormat.parse(comment.createdAt)
                    dateText.text = displayDateFormat.format(parsedDate ?: Date())
                } catch (e: Exception) {
                    dateText.text = comment.createdAt
                }
            }
        }
    }

    private class CommentDiffCallback : DiffUtil.ItemCallback<CommentResponse>() {
        override fun areItemsTheSame(oldItem: CommentResponse, newItem: CommentResponse): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: CommentResponse, newItem: CommentResponse): Boolean {
            return oldItem == newItem
        }
    }
}


