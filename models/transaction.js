
const db = require("../config/db");


const normalizeMoney = (amount) => {
    const value = String(amount ?? "").trim();

    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
        throw new Error(
            "Invalid amount. Maximum 2 decimal places allowed."
        );
    }

    const [whole, decimal = ""] = value.split(".");

    const cents =
        BigInt(whole) * 100n +
        BigInt(decimal.padEnd(2, "0"));

    if (cents <= 0n || cents > 999999999999n) {
        throw new Error("Invalid transaction amount.");
    }

    return `${whole}.${decimal.padEnd(2, "0")}`;
};



const validateConnection = (connection) => {
    if (!connection || typeof connection.query !== "function") {
        throw new Error("Valid database connection is required");
    }
};



const validateAccountId = (accountId) => {
    const id = Number(accountId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error("Valid account ID is required");
    }

    return id;
};



const saveTransaction = async (
    connection,
    sender_account_id,
    receiver_account_id,
    amount,
    transaction_type
) => {
    validateConnection(connection);

    const validTypes = ["transfer", "deposit", "withdraw"];

    if (!validTypes.includes(transaction_type)) {
        throw new Error("Invalid transaction type");
    }

    const normalizedAmount = normalizeMoney(amount);

    const senderId = sender_account_id == null
        ? null
        : validateAccountId(sender_account_id);

    const receiverId = receiver_account_id == null
        ? null
        : validateAccountId(receiver_account_id);

    if (transaction_type === "transfer") {
        if (!senderId || !receiverId || senderId === receiverId) {
            throw new Error("Valid sender and receiver accounts are required");
        }
    }

    if (transaction_type === "deposit" && !receiverId) {
        throw new Error("Receiver account is required for a deposit");
    }

    if (transaction_type === "withdraw" && !senderId) {
        throw new Error("Sender account is required for a withdrawal");
    }

    const [result] = await connection.query(
        `
        INSERT INTO transactions (
            sender_account_id,
            receiver_account_id,
            amount,
            transaction_type
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            senderId,
            receiverId,
            normalizedAmount,
            transaction_type
        ]
    );

    return result;
};


const getTodayWithdrawAmount = async (
    accountId,
    connection = db,
    startOfDay = null,
    endOfDay = null
) => {
    const id = validateAccountId(accountId);

    validateConnection(connection);

    let query;
    let params;

    if (startOfDay && endOfDay) {
        query = `
            SELECT COALESCE(SUM(amount), 0.00) AS total
            FROM transactions
            WHERE sender_account_id = ?
              AND transaction_type = 'withdraw'
              AND created_at >= ?
              AND created_at < ?
        `;

        params = [id, startOfDay, endOfDay];

    } else {
        query = `
            SELECT COALESCE(SUM(amount), 0.00) AS total
            FROM transactions
            WHERE sender_account_id = ?
              AND transaction_type = 'withdraw'
              AND created_at >= CURDATE()
              AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        `;

        params = [id];
    }

    const [rows] = await connection.query(query, params);

    return String(rows[0]?.total ?? "0.00");
};



const getRecentWithdraws = async (
    accountId,
    connection = db
) => {
    const id = validateAccountId(accountId);

    validateConnection(connection);

    const [rows] = await connection.query(
        `
        SELECT
            id,
            amount,
            transaction_type,
            created_at
        FROM transactions
        WHERE sender_account_id = ?
          AND transaction_type = 'withdraw'
        ORDER BY created_at DESC, id DESC
        LIMIT 5
        `,
        [id]
    );

    return rows;
};


const getTransactionsByAccountId = async (
    accountId,
    connection = db
) => {
    const id = validateAccountId(accountId);

    validateConnection(connection);

    const [rows] = await connection.query(
        `
        SELECT
            t.id,
            t.sender_account_id,
            t.receiver_account_id,
            t.amount,
            t.transaction_type,
            t.created_at,
            sender_user.full_name AS sender_name,
            receiver_user.full_name AS receiver_name
        FROM transactions t

        LEFT JOIN bank_accounts sender_acc
            ON t.sender_account_id = sender_acc.id

        LEFT JOIN users sender_user
            ON sender_acc.user_id = sender_user.id

        LEFT JOIN bank_accounts receiver_acc
            ON t.receiver_account_id = receiver_acc.id

        LEFT JOIN users receiver_user
            ON receiver_acc.user_id = receiver_user.id

        WHERE t.sender_account_id = ?
           OR t.receiver_account_id = ?

        ORDER BY t.created_at DESC, t.id DESC
        `,
        [id, id]
    );

    return rows;
};


const getTransactionsByAccountIds = async (
    accountIds,
    connection = db
) => {
    validateConnection(connection);

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
        return [];
    }

    const validAccountIds = [
        ...new Set(
            accountIds
                .map(Number)
                .filter(id => Number.isSafeInteger(id) && id > 0)
        )
    ];

    if (validAccountIds.length === 0) {
        return [];
    }

    const placeholders = validAccountIds
        .map(() => "?")
        .join(", ");

    const query = `
        SELECT
            t.id,
            t.sender_account_id,
            t.receiver_account_id,
            t.amount,
            t.transaction_type,
            t.created_at,
            sender_user.full_name AS sender_name,
            receiver_user.full_name AS receiver_name
        FROM transactions t

        LEFT JOIN bank_accounts sender_acc
            ON t.sender_account_id = sender_acc.id

        LEFT JOIN users sender_user
            ON sender_acc.user_id = sender_user.id

        LEFT JOIN bank_accounts receiver_acc
            ON t.receiver_account_id = receiver_acc.id

        LEFT JOIN users receiver_user
            ON receiver_acc.user_id = receiver_user.id

        WHERE
            t.sender_account_id IN (${placeholders})
            OR t.receiver_account_id IN (${placeholders})

        ORDER BY t.created_at DESC, t.id DESC
    `;

    const [rows] = await connection.query(query, [
        ...validAccountIds,
        ...validAccountIds
    ]);

    return rows;
};


const getMonthlyTransactions = async (
    accountId,
    month,
    year,
    connection = db
) => {
    const id = validateAccountId(accountId);

    validateConnection(connection);

    const numericMonth = Number(month);
    const numericYear = Number(year);

    if (
        !Number.isInteger(numericMonth) ||
        numericMonth < 1 ||
        numericMonth > 12 ||
        !Number.isInteger(numericYear) ||
        numericYear < 2000 ||
        numericYear > 9998
    ) {
        throw new Error("Invalid month or year");
    }

    const startDate =
        `${numericYear}-${String(numericMonth).padStart(2, "0")}-01`;

    const endDate =
        numericMonth === 12
            ? `${numericYear + 1}-01-01`
            : `${numericYear}-${String(numericMonth + 1).padStart(2, "0")}-01`;

    const [rows] = await connection.query(
        `
        SELECT
            id,
            sender_account_id,
            receiver_account_id,
            amount,
            transaction_type,
            created_at
        FROM transactions
        WHERE (
            sender_account_id = ?
            OR receiver_account_id = ?
        )
          AND created_at >= ?
          AND created_at < ?
        ORDER BY created_at DESC, id DESC
        `,
        [
            id,
            id,
            startDate,
            endDate
        ]
    );

    return rows;
};


module.exports = {
    saveTransaction,
    getTransactionsByAccountId,
    getTransactionsByAccountIds,
    getMonthlyTransactions,
    getTodayWithdrawAmount,
    getRecentWithdraws
};
