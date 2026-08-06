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
    const projects = await Project.find({ isDeleted: false })
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
    const project = await Project.findOne({ _id: id, isDeleted: false })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .populate("members.userId", "name email");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Move Project to Trash (Cascades to Folders and Files)
exports.moveToTrash = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const project = await Project.findByIdAndUpdate(
      id,
      { status: "trash", isDeleted: true, deletedAt: now },
      { new: true }
    );

    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    // Cascading update: Ubah status folder dan file di bawah project ini menjadi 'trash'
    await Folder.updateMany(
      { projectId: id },
      { status: "trash", deletedAt: now }
    );
    await File.updateMany(
      { projectId: id },
      { status: "trash", deletedAt: now }
    );

    res.status(200).json({ success: true, message: "Project, folders, and files moved to trash", data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Restore Project from Trash (Cascades to Folders and Files)
exports.restoreProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByIdAndUpdate(
      id,
      { status: "active", isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    // Cascading restore: Restore status folder dan file di bawah project ini menjadi 'active'
    await Folder.updateMany(
      { projectId: id },
      { status: "active", deletedAt: null }
    );
    await File.updateMany(
      { projectId: id },
      { status: "active", deletedAt: null }
    );

    res.status(200).json({ success: true, message: "Project, folders, and files successfully restored", data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Permanently Delete Project (Cascades to Folders and Files)
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const project = await Project.findByIdAndUpdate(
      id,
      { status: "deleted", isDeleted: true, deletedAt: now },
      { new: true }
    );

    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    // Cascading hard delete/mark status: Set status folder dan file di bawah project menjadi 'deleted'
    await Folder.updateMany(
      { projectId: id },
      { status: "deleted", deletedAt: now }
    );
    await File.updateMany(
      { projectId: id },
      { status: "deleted", deletedAt: now }
    );

    res.status(200).json({ success: true, message: "Project, folders, and files permanently deleted", data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Project (Rename & Update details)
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, updatedBy } = req.body;

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Set updatedBy with the user who performed the update
    const updaterId = req.user?.id || req.user?._id || updatedBy;
    if (updaterId) {
      project.updatedBy = updaterId;
    }

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
