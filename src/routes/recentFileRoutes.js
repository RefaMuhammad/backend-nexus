const express = require("express");
const router = express.Router();
const recentFileController = require("../controllers/recentFileController");
const { protect } = require("../middleware/authMiddleware");

// All recent files routes require authentication
router.use(protect);

router.get("/", recentFileController.getRecentFiles);

module.exports = router;
