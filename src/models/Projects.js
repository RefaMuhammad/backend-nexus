const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "editor", "viewer"], default: "editor" },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    projectId: { type: String, unique: true, required: true, default: () => `NEX-PRJ-${String(Math.floor(1 + Math.random() * 999)).padStart(3, '0')}` },
    name: { type: String, required: [true, 'Project name is required'], index: true, trim: true },
    description: { type: String, maxlength: [500, 'Maximum description of 500 characters'], default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    members: { type: [memberSchema], validate: [(val) => val.length <= 5, 'Project collaborator list maximum of 5 people'], default: [] },
    status: {
      type: String,
      enum: ['active', 'trash', 'deleted'],
      default: 'active',
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

projectSchema.index({ updatedAt: -1 });
projectSchema.index({ createdBy: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

module.exports = mongoose.model('Project', projectSchema);
