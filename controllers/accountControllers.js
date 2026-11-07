
const db = require("../config/db");
const generateAccountNumber = require("../utils/generateAccountNumber");

const {
    createBankAccount,
    getAccountByAccountNumber,
    updateAccountStatus,
} = require("../models/Account");



const createAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { account_type } = req.body;

        if (!["savings", "current"].includes(account_type)) {
            return res.status(400).json({
                success: false,
                message: "Account type must be savings or current",
            });
        }

        let result;
        let accountNumber;

        const maxAttempts = 3;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            accountNumber = generateAccountNumber();

            try {
                result = await createBankAccount(
                    userId,
                    accountNumber,
                    account_type
                );

                break;
            } catch (error) {
                if (
                    error.code === "ER_DUP_ENTRY" &&
                    attempt < maxAttempts - 1
                ) {
                    continue;
                }

                throw error;
            }
        }

        if (!result) {
            return res.status(500).json({
                success: false,
                message: "Unable to create bank account",
            });
        }

        return res.status(201).json({
            success: true,
            message: "Bank account created successfully",
            account: {
                id: result.insertId,
                account_number: accountNumber,
                account_type,
                balance: 0,
                status: "active",
            },
        });

    } catch (error) {
        console.error(
            "Create account failed:",
            error.code || error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to create bank account",
        });
    }
};


const getMyAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        const [accounts] = await db.query(
            `
            SELECT
                id,
                account_number,
                account_type,
                balance,
                status
            FROM bank_accounts
            WHERE user_id = ?
            ORDER BY id DESC
            `,
            [userId]
        );

        const [balanceRows] = await db.query(
            `
            SELECT COALESCE(SUM(balance), 0) AS balance
            FROM bank_accounts
            WHERE user_id = ?
            `,
            [userId]
        );

        const [transactions] = await db.query(
            `
            SELECT
                t.id,
                t.amount,
                t.transaction_type,
                t.created_at,
                CASE
                    WHEN sender.user_id = ? THEN 'debit'
                    WHEN receiver.user_id = ? THEN 'credit'
                    ELSE t.transaction_type
                END AS type,
                CASE
                    WHEN sender.user_id = ? THEN 'Money sent'
                    WHEN receiver.user_id = ? THEN 'Money received'
                    WHEN t.transaction_type = 'deposit' THEN 'Deposit'
                    WHEN t.transaction_type = 'withdraw' THEN 'Withdrawal'
                    ELSE 'Transaction'
                END AS description
            FROM transactions t
            LEFT JOIN bank_accounts sender
                ON sender.id = t.sender_account_id
            LEFT JOIN bank_accounts receiver
                ON receiver.id = t.receiver_account_id
            WHERE sender.user_id = ?
               OR receiver.user_id = ?
            ORDER BY t.created_at DESC, t.id DESC
            LIMIT 10
            `,
            [
                userId,
                userId,
                userId,
                userId,
                userId,
                userId,
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Dashboard data fetched successfully",
            balance: Number(balanceRows[0]?.balance ?? 0),
            accounts,
            transactions,
        });

    } catch (error) {
        console.error(
            "Dashboard request failed:",
            error.code || error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to fetch dashboard data",
        });
    }
};


const freezeAccount = async (req, res) => {
    try {
        const { account_number } = req.body;

        if (
            typeof account_number !== "string" ||
            !/^\d{10}$/.test(account_number)
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid 10-digit account number is required",
            });
        }

        const accounts = await getAccountByAccountNumber(account_number);
        const account = accounts?.[0];

        if (
            !account ||
            Number(account.user_id) !== Number(req.user.id)
        ) {
            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }

        if (account.status === "frozen") {
            return res.status(200).json({
                success: true,
                message: "Account is already frozen",
            });
        }

        if (account.status !== "active") {
            return res.status(409).json({
                success: false,
                message: "Only active accounts can be frozen",
            });
        }

        const result = await updateAccountStatus(
            account.id,
            "frozen"
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                success: false,
                message: "Account status was not changed",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Account frozen successfully",
        });

    } catch (error) {
        console.error(
            "Freeze account failed:",
            error.code || error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to freeze account",
        });
    }
};


const unfreezeAccount = async (req, res) => {
    try {
        const { account_number } = req.body;

        if (
            typeof account_number !== "string" ||
            !/^\d{10}$/.test(account_number)
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid 10-digit account number is required",
            });
        }

        const accounts = await getAccountByAccountNumber(account_number);
        const account = accounts?.[0];

        if (
            !account ||
            Number(account.user_id) !== Number(req.user.id)
        ) {
            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }

        if (account.status === "active") {
            return res.status(200).json({
                success: true,
                message: "Account is already active",
            });
        }

        if (account.status !== "frozen") {
            return res.status(409).json({
                success: false,
                message: "Only frozen accounts can be unfrozen",
            });
        }

        const result = await updateAccountStatus(
            account.id,
            "active"
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                success: false,
                message: "Account status was not changed",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Account unfrozen successfully",
        });

    } catch (error) {
        console.error(
            "Unfreeze account failed:",
            error.code || error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to unfreeze account",
        });
    }
};


const deleteAccount = async (req, res) => {
    let connection;

    try {
        const targetId = Number(req.params.id);
        const userId = Number(req.user.id);

        if (
            !Number.isSafeInteger(targetId) ||
            targetId <= 0 ||
            !Number.isSafeInteger(userId) ||
            userId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid account ID is required",
            });
        }

        connection = await db.getConnection();

        await connection.beginTransaction();

        const [accounts] = await connection.query(
            `
            SELECT id, balance
            FROM bank_accounts
            WHERE id = ?
              AND user_id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [targetId, userId]
        );

        if (accounts.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }

        if (Number(accounts[0].balance) !== 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Only accounts with a zero balance can be closed",
            });
        }

        const [result] = await connection.query(
            `
            DELETE FROM bank_accounts
            WHERE id = ?
              AND user_id = ?
              AND balance = 0
            `,
            [targetId, userId]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "Account could not be deleted",
            });
        }

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "Account deleted successfully",
        });

    } catch (error) {
        if (connection) {
            await connection.rollback().catch(() => { });
        }

        console.error(
            "Delete account failed:",
            error.code || error.name
        );

        return res.status(500).json({
            success: false,
            message: "Unable to delete bank account",
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};


module.exports = {
    createAccount,
    getMyAccount,
    freezeAccount,
    unfreezeAccount,
    deleteAccount,
};
