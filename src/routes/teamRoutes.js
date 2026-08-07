const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const { protect } = require("../middleware/authMiddleware");

// semua routes secara otomatis ter-protect
router.use(protect);

router.get("/users/search", teamController.searchUsersByEmail);
router.get("/projects/:projectId/members", teamController.getProjectMembers);
router.post("/projects/:projectId/members", teamController.addProjectMember);
router.delete("/projects/:projectId/members/:userId", teamController.removeProjectMember);

module.exports = router;
