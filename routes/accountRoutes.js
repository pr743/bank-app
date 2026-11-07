const express = require("express");
const verifyToken = require("../middlewares/auth");

const {
    createAccount,
    getMyAccount,
    freezeAccount,
    unfreezeAccount,
    deleteAccount,
} = require("../controllers/accountControllers");

const router = express.Router();


router.use(verifyToken);

router.post("/create", createAccount);
router.get("/my-account", getMyAccount);
router.put("/freeze", freezeAccount);
router.put("/unfreeze", unfreezeAccount);
router.delete("/delete/:id", deleteAccount);

module.exports = router;
