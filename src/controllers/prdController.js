const PRD = require("../models/PRD");
const Project = require("../models/Projects");

// Create PRD Data Collection
exports.createPRD = async (req, res) => {
  try {
    const {
      projectId,
      name,
      content,
      rawMarkdown,
      sourceFileIds,
      exportedFileIds,
      version,
    } = req.body;

    const createdBy = req.user?.id || req.user?._id || req.body.createdBy;

    if (!createdBy) {
      return res.status(401).json({
        success: false,
        message: "Pengguna tidak terautentikasi (Silakan sertakan Token JWT pada Header atau createdBy pada Body)",
      });
    }

    // Check project access
    const project = await Project.findOne({ _id: projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const isMember =
      project.createdBy.toString() === createdBy ||
      project.members.some((m) => m.userId.toString() === createdBy);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied to project" });
    }

    const newPrd = new PRD({
      projectId,
      name,
      version: version || 1,
      content,
      rawMarkdown,
      sourceFileIds: sourceFileIds || [],
      exportedFileIds: exportedFileIds || [],
      createdBy,
    });

    const savedPrd = await newPrd.save();
    return res.status(201).json({
      success: true,
      message: "PRD berhasil disimpan",
      data: savedPrd,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create PRD",
      error: error.message,
    });
  }
};

// Get List of PRDs (with Project Filter)
exports.getPRDs = async (req, res) => {
  try {
    const { projectId, status = "active", page = 1, limit = 20 } = req.query;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Identify which projects the user has access to
    const userProjects = await Project.find({
      isDeleted: false,
      $or: [{ createdBy: userId }, { "members.userId": userId }],
    }).select("_id");
    const projectIds = userProjects.map((p) => p._id.toString());

    const filter = { status };

    if (projectId) {
      if (!projectIds.includes(projectId.toString())) {
        return res.status(403).json({ success: false, message: "Access denied to project" });
      }
      filter.projectId = projectId;
    } else {
      filter.projectId = { $in: userProjects.map((p) => p._id) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const prds = await PRD.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    const total = await PRD.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: prds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve PRD list",
      error: error.message,
    });
  }
};

// Get Single PRD by ID
exports.getPRDById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const prd = await PRD.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("sourceFileIds")
      .populate("exportedFileIds");

    if (!prd || prd.status === "deleted") {
      return res.status(404).json({ success: false, message: "PRD not found" });
    }

    // Verify project membership
    const project = await Project.findOne({ _id: prd.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Associated project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied to PRD's project" });
    }

    return res.status(200).json({ success: true, data: prd });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve PRD details",
      error: error.message,
    });
  }
};

// Update PRD
exports.updatePRD = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, rawMarkdown, version, sourceFileIds, exportedFileIds } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const prd = await PRD.findById(id);
    if (!prd || prd.status !== "active") {
      return res.status(404).json({ success: false, message: "PRD not found or not active" });
    }

    // Verify project membership
    const project = await Project.findOne({ _id: prd.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Associated project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    prd.updatedBy = userId;

    if (name !== undefined) prd.name = name;
    if (content !== undefined) prd.content = content;
    if (rawMarkdown !== undefined) prd.rawMarkdown = rawMarkdown;
    if (version !== undefined) prd.version = version;
    if (sourceFileIds !== undefined) prd.sourceFileIds = sourceFileIds;
    if (exportedFileIds !== undefined) prd.exportedFileIds = exportedFileIds;

    const updatedPrd = await prd.save();
    return res.status(200).json({
      success: true,
      message: "PRD successfully updated",
      data: updatedPrd,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update PRD",
      error: error.message,
    });
  }
};

// Delete PRD (Hard Delete)
exports.deletePRD = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const prd = await PRD.findById(id);
    if (!prd || prd.status === "deleted") {
      return res.status(404).json({ success: false, message: "PRD not found" });
    }

    // Verify project membership
    const project = await Project.findOne({ _id: prd.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Associated project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    prd.status = "deleted";
    prd.deletedAt = new Date();
    await prd.save();

    return res.status(200).json({
      success: true,
      message: "PRD successfully deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete PRD",
      error: error.message,
    });
  }
};

// Move PRD to Trash
exports.moveToTrash = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const prd = await PRD.findById(id);
    if (!prd || prd.status === "deleted") {
      return res.status(404).json({ success: false, message: "PRD not found" });
    }

    // Verify project membership
    const project = await Project.findOne({ _id: prd.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Associated project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    prd.status = "trash";
    prd.deletedAt = new Date();
    await prd.save();

    return res.status(200).json({
      success: true,
      message: "PRD successfully moved to trash",
      data: prd,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to move PRD to trash",
      error: error.message,
    });
  }
};

// Restore PRD from Trash
exports.restoreFromTrash = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const prd = await PRD.findById(id);
    if (!prd || prd.status !== "trash") {
      return res.status(400).json({ success: false, message: "PRD not in trash" });
    }

    // Verify project membership
    const project = await Project.findOne({ _id: prd.projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Associated project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    prd.status = "active";
    prd.deletedAt = null;
    await prd.save();

    return res.status(200).json({
      success: true,
      message: "PRD successfully restored from trash",
      data: prd,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to restore PRD from trash",
      error: error.message,
    });
  }
};

// Get PRDs by Project ID
exports.getPRDsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status = "active", page = 1, limit = 20 } = req.query;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Verify project access
    const project = await Project.findOne({ _id: projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied to project" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { projectId, status };

    const prds = await PRD.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    const total = await PRD.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: prds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve PRDs by project ID",
      error: error.message,
    });
  }
};

