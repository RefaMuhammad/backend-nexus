const express = require("express");
const router = express.Router();
const {
  getMyNotifications,
  getNotificationById,
  createNotification,
  markAsRead,
  respondToNotification,
  deleteNotification,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", getMyNotifications);
router.get("/:id", getNotificationById);
router.post("/", createNotification);
router.patch("/:id/read", markAsRead);
router.patch("/:id/respond", respondToNotification);
router.delete("/:id", deleteNotification);

module.exports = router;
