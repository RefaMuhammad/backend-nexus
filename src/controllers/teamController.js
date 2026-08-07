const User = require("../models/User");
const Project = require("../models/Projects");

// 1. GET /api/users/search?email=xxx (Protected)
exports.searchUsersByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email query parameter is required" });
    }

    const users = await User.find({ email: { $regex: email, $options: "i" } })
      .select("_id email profile.fullName profile.avatarUrl")
      .limit(5);

    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to check project access
const checkProjectAccess = (project, userId) => {
  return (
    project.createdBy.toString() === userId ||
    project.members.some((m) => m.userId.toString() === userId)
  );
};

// 2. GET /api/projects/:projectId/members (Protected)
exports.getProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const project = await Project.findOne({ _id: projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (!checkProjectAccess(project, userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Retrieve and populate members
    const populatedProject = await Project.findById(projectId).populate(
      "members.userId",
      "email profile.fullName profile.avatarUrl"
    );

    return res.status(200).json({ success: true, data: populatedProject.members });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. POST /api/projects/:projectId/members (Protected)
exports.addProjectMember = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const project = await Project.findOne({ _id: projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (!checkProjectAccess(project, userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // a. Cek apakah email user terdaftar di DB
    const targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // b. Cek apakah user sudah ada di project.members
    const isAlreadyMember = project.members.some(
      (member) => member.userId.toString() === targetUser._id.toString()
    );
    if (isAlreadyMember) {
      return res.status(400).json({ success: false, message: "User is already a member" });
    }

    // c. BATAS MAKSIMAL ANGGOTA (NEX-051): Cek jumlah project.members.length. Jika sudah mencapai 5, return error 400
    if (project.members.length >= 5) {
      return res.status(400).json({
        success: false,
        message: "Project has reached maximum limit of 5 members",
      });
    }

    // Push new member and save
    project.members.push({
      userId: targetUser._id,
      role: "editor",
      status: "pending",
      joinedAt: new Date()
    });
    await project.save();

    // Populate saved members for response
    const updatedProject = await Project.findById(projectId).populate(
      "members.userId",
      "email profile.fullName profile.avatarUrl"
    );

    return res.status(200).json({
      success: true,
      message: "Member added successfully",
      data: updatedProject.members,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. DELETE /api/projects/:projectId/members/:userId (Protected)
exports.removeProjectMember = async (req, res) => {
  try {
    const { projectId, userId: targetUserId } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const project = await Project.findOne({ _id: projectId, isDeleted: false });
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (!checkProjectAccess(project, userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Remove element from project.members array
    const originalLength = project.members.length;
    project.members = project.members.filter(
      (member) => member.userId.toString() !== targetUserId.toString()
    );

    if (project.members.length === originalLength) {
      return res.status(404).json({ success: false, message: "Member not found in this project" });
    }

    await project.save();

    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
