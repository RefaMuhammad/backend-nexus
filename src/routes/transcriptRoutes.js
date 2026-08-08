const express = require("express");
const router = express.Router();
const {
  createTranscript,
  getTranscriptByFileId,
  getTranscriptsByProject,
  getTranscriptById,
  updateTranscript,
  exportTranscriptToTxt,
} = require("../controllers/transcriptController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

// Specific routes before /:id to avoid param conflicts
router.get("/file/:fileId", getTranscriptByFileId);
router.get("/project/:projectId", getTranscriptsByProject);
router.get("/:id/export/txt", exportTranscriptToTxt);

router.post("/", createTranscript);
router.get("/:id", getTranscriptById);
router.put("/:id", updateTranscript);

module.exports = router;
