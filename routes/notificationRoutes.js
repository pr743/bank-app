const express = require("express");
const verifyToken = require("../middlewares/auth");

const {
    getMyNotifications,
    readNotification,
} = require("../controllers/notificationControllers");

const router = express.Router();


router.use(verifyToken);

router.get("/", getMyNotifications);
router.put("/read/:id", readNotification);

module.exports = router;
