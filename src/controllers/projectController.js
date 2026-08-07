const Project = require("../models/Projects");
const Folder = require("../models/Folder");
const File = require("../models/File");

exports.createProject = async (req, res) => {
  try {
    const { name, description, createdBy, members } = req.body;
    const creatorId = req.user?.id || req.user?._id || createdBy;

    if (!creatorId) {
      return res.status(401).json({
        success: false,
        message: "Unauthenticated user (Please include a JWT Token in the Header or createdBy in the Body)",
      });
    }

    // Pengecekan nama unik per user
    const existingProject = await Project.findOne({
      createdBy: creatorId,
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      isDeleted: false,
    });

    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: "You already have an active project with this name",
      });
    }

    const defaultMembers = members && members.length > 0
      ? members
      : [{ userId: creatorId, role: "owner", joinedAt: new Date() }];

    const project = new Project({
      name,
      description,
      createdBy: creatorId,
      members: defaultMembers,
    });

    await project.save();
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You already have an active project with this name",
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all active projects (Excludes soft-deleted ones)
exports.getProjects = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const projects = await Project.find({
      isDeleted: false,
      $or: [
        { createdBy: userId },
        { "members.userId": userId }
      ]
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("members.userId", "name email");

    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Project by ID
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const project = await Project.findOne({ _id: id, isDeleted: false })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("members.userId", "name email");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId?._id?.toString() === userId || m.userId?.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Project (Soft Delete — cascades to Folders and Files)
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const now = new Date();
    project.status = "deleted";
    project.isDeleted = true;
    project.deletedAt = now;
    project.updatedBy = userId;
    await project.save();

    // Cascade: soft-delete all folders and files that belong to this project
    await Folder.updateMany(
      { projectId: id },
      { status: "deleted", deletedAt: now }
    );
    await File.updateMany(
      { projectId: id },
      { status: "deleted", deletedAt: now }
    );

    res.status(200).json({
      success: true,
      message: "Project, folders, and files have been deleted",
      data: project,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Project (Rename & Update details)
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const isMember =
      project.createdBy.toString() === userId ||
      project.members.some((m) => m.userId.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    project.updatedBy = userId;

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;

    await project.save();
    res.status(200).json({
      success: true,
      message: "Project successfully updated",
      data: project,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "You already have an active project with this name" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
