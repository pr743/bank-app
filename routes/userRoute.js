
const express = require("express");
const verifyToken = require("../middlewares/auth");

const {
    getProfile,
    getUserByUPi,
    searchUser,
} = require("../controllers/userController");

const router = express.Router();


router.use(verifyToken);

router.get("/profile", getProfile);
router.get("/upi/:upiId", getUserByUPi);
router.get("/search", searchUser);

module.exports = router;
