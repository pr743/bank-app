const db = require("../config/db");
const { client } = require("../config/redis");

const {
    getAccountByAccountNumber,
    updateAccountBalance,
    getAccountByUserId,
    getAccountsByIdsForUpdate
} = require("../models/Account");

const {
    saveTransaction,
    getTransactionsByAccountId,
    getMonthlyTransactions,
    getTodayWithdrawAmount,
    getRecentWithdraws
} = require("../models/transaction");

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const { createNotification } = require("../models/notification");
const { findUserByUpiId } = require("../models/user");




const normalizeAmount = (value) => {
    const amount = String(value ?? "").trim();

    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
        return null;
    }

    const [rupees, paise = ""] = amount.split(".");

    const cents =
        BigInt(rupees) * 100n +
        BigInt(paise.padEnd(2, "0"));

    if (cents <= 0n || cents > 999999999999n) {
        return null;
    }

    return cents;
};

const formatAmount = (cents) => {
    const rupees = cents / 100n;
    const paise = String(cents % 100n).padStart(2, "0");

    return `${rupees}.${paise}`;
};



const transferMoney = async (req, res) => {
    const { receiver_upi, amount } = req.body;
    const sender_user_id = req.user.id;

    const amountCents = normalizeAmount(amount);

    if (amountCents === null) {
        return res.status(400).json({
            message: "Invalid amount. Enter a positive amount with up to 2 decimal places."
        });
    }

    if (!receiver_upi || typeof receiver_upi !== "string") {
        return res.status(400).json({
            message: "Receiver UPI ID is required"
        });
    }

    let connection;
    let transactionStarted = false;

    try {
        connection = await db.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const senderAccounts = await getAccountByUserId(
            sender_user_id
        );

        if (!senderAccounts?.length) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: "Sender account not found"
            });
        }

        const receiverUsers = await findUserByUpiId(
            receiver_upi
        );

        if (!receiverUsers?.length) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: "Receiver UPI ID not found"
            });
        }

        const receiver_user_id = receiverUsers[0].id;

        if (
            Number(sender_user_id) ===
            Number(receiver_user_id)
        ) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: "Cannot transfer to your own account"
            });
        }

        const receiverAccounts = await getAccountByUserId(
            receiver_user_id
        );

        if (!receiverAccounts?.length) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: "Receiver account not found"
            });
        }


        const lockedAccounts = await getAccountsByIdsForUpdate(
            connection,
            [
                senderAccounts[0].id,
                receiverAccounts[0].id
            ]
        );

        const sender = lockedAccounts.find(
            account =>
                Number(account.id) ===
                Number(senderAccounts[0].id)
        );

        const receiver = lockedAccounts.find(
            account =>
                Number(account.id) ===
                Number(receiverAccounts[0].id)
        );

        if (!sender || !receiver) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                message: "Account not found"
            });
        }

        if (sender.status !== "active") {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: "Sender account is not active"
            });
        }

        if (receiver.status !== "active") {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: "Receiver account is not active"
            });
        }

        const senderBalance = normalizeAmount(sender.balance);
        const receiverBalance = normalizeAmount(receiver.balance);

        if (
            senderBalance === null ||
            receiverBalance === null
        ) {
            throw new Error("Invalid account balance in database");
        }

        if (senderBalance < amountCents) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: "Insufficient funds"
            });
        }

        const newSenderBalance =
            senderBalance - amountCents;

        const newReceiverBalance =
            receiverBalance + amountCents;

        await updateAccountBalance(
            connection,
            sender.id,
            formatAmount(newSenderBalance)
        );

        await updateAccountBalance(
            connection,
            receiver.id,
            formatAmount(newReceiverBalance)
        );

        await saveTransaction(
            connection,
            sender.id,
            receiver.id,
            formatAmount(amountCents),
            "transfer"
        );

        await connection.commit();
        transactionStarted = false;


        try {
            await createNotification(
                sender.user_id,
                `₹${formatAmount(amountCents)} transferred successfully`
            );

            await createNotification(
                receiver.user_id,
                `₹${formatAmount(amountCents)} received successfully`
            );
        } catch (notificationError) {
            console.error(
                "Transfer notification error:",
                notificationError
            );
        }

        return res.status(200).json({
            message: "Transfer successful",
            receiver_name: receiverUsers[0].full_name
        });

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "Transfer rollback error:",
                    rollbackError
                );
            }
        }

        console.error("Transfer Error:", error);

        return res.status(500).json({
            message: "Transfer failed"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};


const depositMoney = async (req, res) => {
    const { account_number, amount } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const accountRows = await getAccountByAccountNumber(
            account_number
        );

        if (!accountRows.length) {
            await connection.rollback();

            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account = accountRows[0];

        const newBalance =
            Number(account.balance) + Number(amount);

        await updateAccountBalance(
            connection,
            account.id,
            newBalance
        );

        await saveTransaction(
            connection,
            null,
            account.id,
            amount,
            "deposit"
        );

        await connection.commit();

        await client.del(
            `withdraw_limit:${account_number}`
        );

        return res.status(200).json({
            message: "Deposit successful",
            balance: newBalance
        });

    } catch (error) {
        await connection.rollback();

        console.error("Deposit Error:", error);

        return res.status(500).json({
            message: "Deposit failed",
            error: error.message
        });

    } finally {
        connection.release();
    }
};



const withdrawMoney = async (req, res) => {
    const { account_number, amount } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const accountRows = await getAccountByAccountNumber(
            account_number
        );

        if (!accountRows?.length) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account = accountRows[0];
        const amt = Number(amount);

        if (!amt || amt <= 0) {
            return res.status(400).json({
                message: "Invalid amount"
            });
        }

        if (account.status === "frozen") {
            return res.status(400).json({
                message: "Account is frozen"
            });
        }

        if (Number(account.balance) < amt) {
            return res.status(400).json({
                message: "Insufficient funds"
            });
        }

        const transactions = await getTransactionsByAccountId(
            account.id
        );

        const today = new Date().toISOString().split("T")[0];

        let usedToday = 0;

        transactions.forEach((transaction) => {
            if (!transaction?.created_at) return;

            const date = new Date(transaction.created_at);

            if (isNaN(date.getTime())) return;

            const transactionDate = date
                .toISOString()
                .split("T")[0];

            if (
                transaction.transaction_type === "withdraw" &&
                transactionDate === today
            ) {
                usedToday += Number(transaction.amount || 0);
            }
        });

        const DAILY_LIMIT = 50000;

        if (usedToday + amt > DAILY_LIMIT) {
            return res.status(400).json({
                message: "Daily withdrawal limit exceeded"
            });
        }

        const newBalance =
            Number(account.balance) - amt;

        await updateAccountBalance(
            connection,
            account.id,
            newBalance
        );

        await saveTransaction(
            connection,
            account.id,
            null,
            amt,
            "withdraw"
        );

        await connection.commit();

        try {
            await createNotification(
                account.user_id,
                `₹${amt} withdrawn successfully`
            );
        } catch (notificationError) {
            console.error(
                "Withdraw notification error:",
                notificationError
            );
        }

        return res.status(200).json({
            message: "Withdraw successful",
            data: {
                balance: newBalance,
                withdrawn_amount: amt
            }
        });

    } catch (error) {
        await connection.rollback();

        console.error("Withdraw Error:", error);

        return res.status(500).json({
            message: "Withdraw failed",
            error: error.message
        });

    } finally {
        connection.release();
    }
};


const withdrawPreview = async (req, res) => {
    try {
        const { amount } = req.body;

        const amt = Number(amount);

        if (!amt || amt <= 0) {
            return res.status(400).json({
                message: "Invalid amount"
            });
        }

        const fee = Math.max(
            10,
            Math.round(amt * 0.01)
        );

        const total_impact = amt + fee;

        let remaining = amt;

        const notes = [500, 200, 100];
        const breakdown = [];

        for (const note of notes) {
            const count = Math.floor(remaining / note);

            if (count > 0) {
                breakdown.push({
                    note,
                    count
                });

                remaining %= note;
            }
        }

        return res.status(200).json({
            data: {
                fee,
                total_impact,
                cash_breakdown: breakdown
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};


const getWithdrawLimit = async (req, res) => {
    try {
        const { account_number } = req.params;

        const cacheKey =
            `withdraw_limit:${account_number}`;

        const cached = await client.get(cacheKey);

        if (cached) {
            return res.status(200).json({
                data: JSON.parse(cached)
            });
        }

        const accountRows = await getAccountByAccountNumber(
            account_number
        );

        if (!accountRows.length) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account = accountRows[0];

        const usedToday = await getTodayWithdrawAmount(
            account.id
        );

        const result = {
            daily_limit: 50000,
            used: usedToday,
            remaining: Math.max(
                0,
                50000 - Number(usedToday)
            )
        };

        await client.setEx(
            cacheKey,
            300,
            JSON.stringify(result)
        );

        return res.status(200).json({
            data: result
        });

    } catch (error) {
        console.error("Withdraw limit error:", error);

        return res.status(500).json({
            message: "Unable to fetch withdrawal limit"
        });
    }
};


const getWithdrawHistory = async (req, res) => {
    try {
        const { account_number } = req.params;

        const accountRows = await getAccountByAccountNumber(
            account_number
        );

        if (!accountRows.length) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account = accountRows[0];

        const withdraws = await getRecentWithdraws(
            account.id
        );

        return res.status(200).json({
            data: withdraws
        });

    } catch (error) {
        console.error("Withdraw history error:", error);

        return res.status(500).json({
            message: "Unable to fetch withdrawal history"
        });
    }
};


const getTransactionHistory = async (req, res) => {
    try {
        const { account_number } = req.params;

        const accountRows = await getAccountByAccountNumber(
            account_number
        );

        if (!accountRows?.length) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account = accountRows[0];

        const transactions = await getTransactionsByAccountId(
            account.id
        );

        return res.status(200).json({
            message: "Transaction history fetched successfully",
            data: transactions
        });

    } catch (error) {
        console.error("Transaction History Error:", error);

        return res.status(500).json({
            message: "Error fetching transactions"
        });
    }
};


const getMonthlyStatement = async (req, res) => {
    try {
        const {
            account_number,
            month,
            year
        } = req.params;

        const accountRows = await getAccountByAccountNumber(
            account_number
        );

        if (!accountRows?.length) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account = accountRows[0];

        const transactions = await getMonthlyTransactions(
            account.id,
            month,
            year
        );

        return res.status(200).json({
            message: "Monthly statement fetched successfully",
            total_transactions: transactions.length,
            data: transactions
        });

    } catch (error) {
        console.error("Monthly Statement Error:", error);

        return res.status(500).json({
            message: "Error fetching monthly statement"
        });
    }
};


const downloadStatementPDF = async (req, res) => {
    try {
        const { account_number } = req.params;

        const accountRows = await getAccountByAccountNumber(
            account_number
        );

        if (!accountRows?.length) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account = accountRows[0];

        const transactions = await getTransactionsByAccountId(
            account.id
        );

        const doc = new PDFDocument();

        const fileName =
            `statement-${account_number}.pdf`;

        const pdfDirectory = path.join(
            __dirname,
            "../pdfs"
        );

        fs.mkdirSync(pdfDirectory, {
            recursive: true
        });

        const filePath = path.join(
            pdfDirectory,
            fileName
        );

        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        doc.fontSize(20).text(
            "Bank Statement",
            {
                align: "center"
            }
        );

        doc.moveDown();

        doc.fontSize(14).text(
            `Account Number: ${account_number}`
        );

        doc.moveDown();

        transactions.forEach((transaction) => {
            doc.text(
                `Type: ${transaction.transaction_type}\n` +
                `Amount: ₹${transaction.amount}\n` +
                `Date: ${transaction.created_at}`
            );

            doc.moveDown();
        });

        doc.end();

        stream.on("finish", () => {
            res.download(filePath);
        });

        stream.on("error", (error) => {
            console.error("PDF stream error:", error);

            if (!res.headersSent) {
                res.status(500).json({
                    message: "Error generating PDF"
                });
            }
        });

    } catch (error) {
        console.error("PDF Statement Error:", error);

        if (!res.headersSent) {
            return res.status(500).json({
                message: "Error generating PDF"
            });
        }
    }
};


module.exports = {
    transferMoney,
    depositMoney,
    withdrawMoney,
    getTransactionHistory,
    getMonthlyStatement,
    downloadStatementPDF,
    withdrawPreview,
    getWithdrawLimit,
    getWithdrawHistory
};