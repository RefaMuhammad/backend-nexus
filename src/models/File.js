  const mongoose = require("mongoose");

  const fileSchema = new mongoose.Schema(
    {
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
        index: true,
      },
      folderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
        default: null,
        index: true,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      fileName: {
        type: String,
        required: true,
        index: true,
      },
      originalName: {
        type: String,
        required: true,
      },
      fileType: {
        type: String,
        required: true,
        enum: [
          "pdf",
          "docx",
          "xlsx",
          "mp3",
          "m4a",
          "wav",
          "txt",
          "md"
        ],
      },
      category: {
        type: String,
        required: true,
        enum: ["document", "audio", "spreadsheet", "prd"],
      },
      sizeBytes: {
        type: Number,
        required: true,
        max: [52428800, "Maximum file size: 50 MB (52,428,800 bytes)"],
      },
      fileUrl: {
        type: String,
        required: true,
      },
      version: {
        type: Number,
        default: 1,
      },
      previousVersionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
        default: null,
      },
      status: {
        type: String,
        required: true,
        enum: ["active", "trash", "deleted"],
        default: "active",
        index: true,
      },
      deletedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

  fileSchema.index({ updatedAt: -1 });

  fileSchema.index(
    { deletedAt: 1 },
    { expireAfterSeconds: 2592000, partialFilterExpression: { status: "trash" } }
  );

  module.exports = mongoose.model("File", fileSchema);
