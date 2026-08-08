const DocumentEmbedding = require("../models/DocumentEmbedding");
const Project = require("../models/Projects");

// Helper: verify user is a member of the project
const verifyProjectMembership = async (projectId, userId) => {
  const project = await Project.findOne({ _id: projectId, isDeleted: false });
  if (!project) return { error: "Project not found", status: 404 };

  const isMember =
    project.createdBy.toString() === userId.toString() ||
    project.members.some((m) => m.userId.toString() === userId.toString());

  if (!isMember) return { error: "Access denied to project", status: 403 };

  return { project };
};

// Get all embedding chunks for a specific file (paginated)
exports.getEmbeddingsByFile = async (req, res) => {
  try {
    const { fileId, projectId, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!fileId) {
      return res.status(400).json({ success: false, message: "fileId query parameter is required" });
    }

    // If projectId is provided, verify membership directly
    // Otherwise, find the embedding first to get the projectId
    let resolvedProjectId = projectId;

    if (!resolvedProjectId) {
      const sample = await DocumentEmbedding.findOne({ fileId }).select("projectId");
      if (!sample) {
        return res.status(404).json({ success: false, message: "No embeddings found for this file" });
      }
      resolvedProjectId = sample.projectId;
    }

    const { error, status } = await verifyProjectMembership(resolvedProjectId, userId);
    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const embeddings = await DocumentEmbedding.find({ fileId, projectId: resolvedProjectId })
      .sort({ chunkIndex: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    const total = await DocumentEmbedding.countDocuments({ fileId, projectId: resolvedProjectId });

    return res.status(200).json({
      success: true,
      data: embeddings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve document embeddings",
      error: error.message,
    });
  }
};

// PUT /api/document-embeddings/:id
// Update a single embedding chunk (textContent, embedding, metadata, chunkIndex)
exports.updateEmbedding = async (req, res) => {
  try {
    const { id } = req.params;
    const { textContent, embedding, metadata, chunkIndex } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const doc = await DocumentEmbedding.findById(id);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Document embedding not found" });
    }

    const { error, status } = await verifyProjectMembership(doc.projectId, userId);
    if (error) {
      return res.status(status).json({ success: false, message: error });
    }

    // Apply updates only for fields that are provided
    if (textContent !== undefined) doc.textContent = textContent;
    if (embedding !== undefined) doc.embedding = embedding;
    if (chunkIndex !== undefined) doc.chunkIndex = chunkIndex;
    if (metadata !== undefined) {
      if (metadata.pageNumber !== undefined) doc.metadata.pageNumber = metadata.pageNumber;
      if (metadata.audioTimestamp !== undefined) doc.metadata.audioTimestamp = metadata.audioTimestamp;
    }

    doc.updatedBy = userId;

    const updated = await doc.save();

    return res.status(200).json({
      success: true,
      message: "Document embedding updated successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update document embedding",
      error: error.message,
    });
  }
};
