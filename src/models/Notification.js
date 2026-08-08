const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "recipientId is required"],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null = System-generated
    },
    type: {
      type: String,
      required: [true, "type is required"],
      enum: {
        values: ["collaboration_invite", "storage_warning"],
        message: "type must be 'collaboration_invite' or 'storage_warning'",
      },
    },
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "message is required"],
      trim: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ["pending", "accepted", "rejected", "read"],
        message: "status must be 'pending', 'accepted', 'rejected', or 'read'",
      },
      default: "pending",
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
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

// Index for fast recipient queries sorted by newest first
notificationSchema.index({ recipientId: 1, createdAt: -1 });

// TTL Index: auto-purge documents 1 day (86400s) after deletedAt is set
notificationSchema.index(
  { deletedAt: 1 },
  { expireAfterSeconds: 86400, partialFilterExpression: { deletedAt: { $ne: null } } }
);

module.exports = mongoose.model("Notification", notificationSchema);
