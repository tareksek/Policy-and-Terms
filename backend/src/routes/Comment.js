const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  edited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: Date
  }],
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ author: 1 });

module.exports = mongoose.model('Comment', commentSchema);