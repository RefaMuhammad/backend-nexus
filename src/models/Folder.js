const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "projectId is required"],
      index: true,
    },
    parentFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Folder name is required"],
      maxlength: [100, "Folder name cannot exceed 100 characters"],
      trim: true,
    },
    color: {
      type: String,
      default: null,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
        },
        message: (props) => `${props.value} is not a valid hex color code!`,
      },
    },
    path: {
      type: String,
      required: [true, "Path is required"],
      index: true,
    },
    level: {
      type: Number,
      required: [true, "Level is required"],
      min: [1, "Minimum depth level is 1"],
      max: [5, "Maximum depth level is 5"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required"],
    },
    status: {
      type: String,
      enum: {
        values: ["active", "trash", "deleted"],
        message: "Status needs to be 'active', 'trash', or 'deleted'",
      },
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

module.exports = mongoose.model("Folder", folderSchema);