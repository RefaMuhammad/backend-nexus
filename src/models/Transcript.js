const mongoose = require("mongoose");

const segmentSchema = new mongoose.Schema(
  {
    start: {
      type: Number,
      required: [true, "segment.start is required"],
      min: [0, "segment.start must be non-negative"],
    },
    end: {
      type: Number,
      required: [true, "segment.end is required"],
      min: [0, "segment.end must be non-negative"],
    },
    text: {
      type: String,
      required: [true, "segment.text is required"],
      trim: true,
    },
  },
  { _id: false }
);

const transcriptSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      required: [true, "fileId is required"],
      unique: true, // One transcript per file
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "projectId is required"],
      index: true,
    },
    fullText: {
      type: String,
      required: [true, "fullText is required"],
      trim: true,
    },
    language: {
      type: String,
      default: null,
      trim: true,
    },
    durationSeconds: {
      type: Number,
      required: [true, "durationSeconds is required"],
      min: [0, "durationSeconds must be non-negative"],
    },
    segments: {
      type: [segmentSchema],
      required: [true, "segments is required"],
      validate: {
        validator: (val) => Array.isArray(val) && val.length > 0,
        message: "segments must be a non-empty array",
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

module.exports = mongoose.model("Transcript", transcriptSchema);
