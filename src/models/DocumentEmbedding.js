const mongoose = require("mongoose");

const documentEmbeddingSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "projectId is required"],
      index: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: [true, "fileId is required"],
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: [true, "chunkIndex is required"],
      min: [0, "chunkIndex must be a non-negative integer"],
    },
    textContent: {
      type: String,
      required: [true, "textContent is required"],
    },
    embedding: {
      type: [Number],
      required: [true, "embedding is required"],
      validate: {
        validator: (v) => v.length === 1536,
        message: "embedding must have exactly 1536 dimensions",
      },
    },
    metadata: {
      pageNumber: {
        type: Number,
        default: null,
      },
      audioTimestamp: {
        type: String,
        default: null,
        match: [/^\d{1,2}:\d{2}$/, "audioTimestamp must be in MM:SS format"],
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required"],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true, // auto-manages createdAt & updatedAt
  }
);

// Compound index for fast chunk retrieval per file
documentEmbeddingSchema.index({ fileId: 1, chunkIndex: 1 });

// Compound index for fast queries per project
documentEmbeddingSchema.index({ projectId: 1, fileId: 1 });

module.exports = mongoose.model("DocumentEmbedding", documentEmbeddingSchema);
