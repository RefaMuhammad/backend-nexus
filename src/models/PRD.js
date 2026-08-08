const mongoose = require("mongoose");

const prdSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "projectId is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "PRD name is required"],
      trim: true,
    },
    version: {
      type: Number,
      required: [true, "PRD version is required"],
      default: 1,
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "PRD structured content is required"],
    },
    rawMarkdown: {
      type: String,
      required: [true, "PRD rawMarkdown is required"],
    },
    sourceFileIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      }],
      default: [],
    },
    exportedFileIds: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      }],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy user reference is required"],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

prdSchema.index({ projectId: 1, updatedAt: -1 });
prdSchema.index(
  { deletedAt: 1 },
  { expireAfterSeconds: 2592000, partialFilterExpression: { status: "trash" } }
);

module.exports = mongoose.model("PRD", prdSchema);
