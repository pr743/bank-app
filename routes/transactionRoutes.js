const express = require("express");
const verifyToken = require("../middlewares/auth");

const {
    transferMoney,
    depositMoney,
    withdrawMoney,
    getTransactionHistory,
    getMonthlyStatement,
    downloadStatementPDF,
    withdrawPreview,
    getWithdrawLimit,
    getWithdrawHistory,
} = require("../controllers/transactionControllers");

const router = express.Router();


router.use(verifyToken);


router.post("/transfer", transferMoney);
router.post("/deposit", depositMoney);
router.post("/withdraw", withdrawMoney);


router.post("/withdraw-preview", withdrawPreview);
router.get("/withdraw-limit/:account_number", getWithdrawLimit);
router.get("/withdraw-history/:account_number", getWithdrawHistory);


router.get("/history/:account_number", getTransactionHistory);
router.get(
    "/statement/:account_number/:month/:year",
    getMonthlyStatement
);
router.get("/statement/pdf/:account_number", downloadStatementPDF);

module.exports = router;
