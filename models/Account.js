
const db = require("../config/db");


const createBankAccount = async (
    user_id,
    account_number,
    account_type
) => {
    const query = `
        INSERT INTO bank_accounts (
            user_id,
            account_number,
            account_type
        )
        VALUES (?, ?, ?)
    `;

    const [result] = await db.query(query, [
        user_id,
        account_number,
        account_type
    ]);

    return result;
};



const getAccountByUserId = async (user_id) => {
    const [rows] = await db.query(
        `
        SELECT
            id,
            user_id,
            account_number,
            account_type,
            balance,
            status
        FROM bank_accounts
        WHERE user_id = ?
        ORDER BY id DESC
        `,
        [user_id]
    );

    return rows;
};



const getAccountByAccountNumber = async (account_number) => {
    const [rows] = await db.query(
        `
        SELECT
            id,
            user_id,
            account_number,
            account_type,
            balance,
            status
        FROM bank_accounts
        WHERE account_number = ?
        LIMIT 1
        `,
        [account_number]
    );

    return rows;
};


const getAccountsByIdsForUpdate = async (connection, accountIds) => {
    if (!connection || typeof connection.query !== "function") {
        throw new Error("Valid database connection is required");
    }

    if (!Array.isArray(accountIds)) {
        throw new Error("Account IDs must be an array");
    }

    const ids = [
        ...new Set(
            accountIds
                .map(Number)
                .filter(id => Number.isSafeInteger(id) && id > 0)
        )
    ].sort((a, b) => a - b);

    if (ids.length === 0) {
        return [];
    }

    const placeholders = ids.map(() => "?").join(",");

    const [rows] = await connection.query(
        `
        SELECT
            id,
            user_id,
            account_number,
            account_type,
            balance,
            status
        FROM bank_accounts
        WHERE id IN (${placeholders})
        ORDER BY id ASC
        FOR UPDATE
        `,
        ids
    );

    return rows;
};


const getAccountByAccountNumberForUserForUpdate = async (
    connection,
    account_number,
    user_id
) => {
    if (!connection || typeof connection.query !== "function") {
        throw new Error("Valid database connection is required");
    }

    const [rows] = await connection.query(
        `
        SELECT
            id,
            user_id,
            account_number,
            account_type,
            balance,
            status
        FROM bank_accounts
        WHERE account_number = ?
          AND user_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [account_number, user_id]
    );

    return rows;
};

const updateAccountBalance = async (
    connection,
    accountId,
    newBalance
) => {
    if (!connection || typeof connection.query !== "function") {
        throw new Error("Valid database connection is required");
    }

    if (!Number.isSafeInteger(Number(accountId)) || Number(accountId) <= 0) {
        throw new Error("Invalid account ID");
    }

    if (!Number.isFinite(Number(newBalance)) || Number(newBalance) < 0) {
        throw new Error("Invalid account balance");
    }

    const [result] = await connection.query(
        `
        UPDATE bank_accounts
        SET balance = ?
        WHERE id = ?
        `,
        [newBalance, accountId]
    );

    return result;
};

const updateAccountStatus = async (accountId, status) => {
    if (!["active", "frozen"].includes(status)) {
        throw new Error("Invalid account status");
    }

    const [result] = await db.query(
        `
        UPDATE bank_accounts
        SET status = ?
        WHERE id = ?
        `,
        [status, accountId]
    );

    return result;
};


const deleteBankAccount = async (accountId, userId) => {
    const [result] = await db.query(
        `
        DELETE FROM bank_accounts
        WHERE id = ?
          AND user_id = ?
          AND balance = 0
        `,
        [accountId, userId]
    );

    return result;
};


module.exports = {
    createBankAccount,
    getAccountByUserId,
    getAccountByAccountNumber,
    getAccountsByIdsForUpdate,
    getAccountByAccountNumberForUserForUpdate,
    updateAccountBalance,
    updateAccountStatus,
    deleteBankAccount
};
