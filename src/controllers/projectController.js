const Project = require("../models/Projects");

exports.createProject = async (req, res) => {
  try {
    const { name, description, ownerId, members } = req.body;

    const project = new Project({
      name,
      description,
      ownerId,
      members: members || [{ userId: ownerId, role: "owner", joinedAt: new Date() }],
    });

    await project.save();
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all active projects (Excludes soft-deleted ones)
exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ isDeleted: false })
      .populate("ownerId", "name email")
      .populate("members.userId", "name email");

    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Soft Delete Project
exports.softDeleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    res.status(200).json({ success: true, message: "Project successfully deleted", data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Project (Rename & Update details)
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;

    await project.save();
    res.status(200).json({ success: true, message: "Project successfully updated", data: project });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "A project with this name already exists for this owner" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};