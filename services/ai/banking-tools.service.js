const {
    getAccountByUserId,
} = require("../../models/Account");

const {
    getTransactionsByAccountIds,
} = require("../../models/transaction");



const formatTransactionDate = (date) => {
    if (!date) return "Date unavailable";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "Date unavailable";
    }

    return (
        new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(parsedDate) + " IST"
    );
};



const formatTransactionAmount = (amount) => {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
    }).format(Number(amount || 0));
};


const validateYearMonth = (year, month) => {
    const numericYear = Number(year);
    const numericMonth = Number(month);

    if (
        !Number.isInteger(numericYear) ||
        numericYear < 1 ||
        !Number.isInteger(numericMonth) ||
        numericMonth < 1 ||
        numericMonth > 12
    ) {
        throw new Error("Invalid year or month");
    }

    return {
        year: numericYear,
        month: numericMonth,
    };
};



const validateYear = (year) => {
    const numericYear = Number(year);

    if (
        !Number.isInteger(numericYear) ||
        numericYear < 1
    ) {
        throw new Error("Invalid year");
    }

    return numericYear;
};


const getTransactionDateParts = (date) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    const parts = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "numeric",
    }).formatToParts(parsedDate);

    return {
        year: Number(
            parts.find((part) => part.type === "year")?.value
        ),
        month: Number(
            parts.find((part) => part.type === "month")?.value
        ),
    };
};


const sortTransactions = (transactions) => {
    return transactions.sort(
        (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
    );
};


const getAllUserTransactions = async (userId) => {
    const accounts = await getAccountByUserId(userId);

    if (!accounts || accounts.length === 0) {
        return {
            accounts: [],
            transactions: [],
        };
    }

    const accountIds = accounts.map((account) => account.id);

    const transactions = await getTransactionsByAccountIds(accountIds);

    return {
        accounts,
        transactions,
    };
};



const addTransactionFormatting = (transaction) => {
    return {
        ...transaction,
        formattedDate: formatTransactionDate(transaction.created_at),
        formattedAmount: formatTransactionAmount(transaction.amount),
    };
};


const getAccountBalance = async (userId) => {
    const accounts = await getAccountByUserId(userId);

    if (!accounts || accounts.length === 0) {
        return {
            totalBalance: 0,
            formattedBalance: formatTransactionAmount(0),
            accounts: [],
        };
    }

    const totalBalance = accounts.reduce(
        (total, account) =>
            total + Number(account.balance || 0),
        0
    );

    return {
        totalBalance,
        formattedBalance: formatTransactionAmount(totalBalance),
        accounts: accounts.map((account) => ({
            id: account.id,
            account_type: account.account_type,
            balance: Number(account.balance || 0),
            status: account.status,
        })),
    };
};



const getRecentTransactions = async (userId, limit = 5) => {
    const { transactions } = await getAllUserTransactions(userId);

    const safeLimit = Math.min(
        50,
        Math.max(1, Number(limit) || 5)
    );

    const sortedTransactions = sortTransactions(transactions)
        .slice(0, safeLimit);

    return {
        totalReturned: sortedTransactions.length,
        transactions: sortedTransactions.map(addTransactionFormatting),
    };
};



const getTransactionsByMonth = async (userId, year, month) => {
    const validated = validateYearMonth(year, month);

    year = validated.year;
    month = validated.month;

    const { accounts, transactions } =
        await getAllUserTransactions(userId);

    if (!accounts.length) {
        return {
            hasAccounts: false,
            year,
            month,
            totalReturned: 0,
            transactions: [],
        };
    }

    const monthlyTransactions = transactions.filter((transaction) => {
        const dateParts = getTransactionDateParts(
            transaction.created_at
        );

        return (
            dateParts &&
            dateParts.year === year &&
            dateParts.month === month
        );
    });

    const sortedTransactions = sortTransactions(monthlyTransactions);

    return {
        hasAccounts: true,
        year,
        month,
        totalReturned: sortedTransactions.length,
        transactions: sortedTransactions.map(addTransactionFormatting),
    };
};


const getMonthlySpending = async (userId, year, month) => {
    const validated = validateYearMonth(year, month);

    year = validated.year;
    month = validated.month;

    const { accounts, transactions } =
        await getAllUserTransactions(userId);

    if (!accounts.length) {
        return {
            hasAccounts: false,
            year,
            month,
            totalSpending: 0,
            formattedTotalSpending: formatTransactionAmount(0),
            transactionCount: 0,
            transactions: [],
        };
    }

    const userAccountIds = new Set(
        accounts.map((account) => Number(account.id))
    );

    const monthlyTransactions = transactions.filter((transaction) => {
        const dateParts = getTransactionDateParts(
            transaction.created_at
        );

        if (
            !dateParts ||
            dateParts.year !== year ||
            dateParts.month !== month
        ) {
            return false;
        }

        const transactionType = String(
            transaction.transaction_type || ""
        ).toLowerCase();

        const isWithdrawal = transactionType === "withdraw";

        const isOutgoingTransfer =
            transactionType === "transfer" &&
            userAccountIds.has(
                Number(transaction.sender_account_id)
            );

        return isWithdrawal || isOutgoingTransfer;
    });

    const totalSpending = monthlyTransactions.reduce(
        (total, transaction) =>
            total + Number(transaction.amount || 0),
        0
    );

    const sortedTransactions = sortTransactions(monthlyTransactions);

    return {
        hasAccounts: true,
        year,
        month,
        totalSpending,
        formattedTotalSpending: formatTransactionAmount(totalSpending),
        transactionCount: sortedTransactions.length,
        transactions: sortedTransactions.map(addTransactionFormatting),
    };
};


const getMonthlyDeposits = async (userId, year, month) => {
    const validated = validateYearMonth(year, month);

    year = validated.year;
    month = validated.month;

    const { accounts, transactions } =
        await getAllUserTransactions(userId);

    const monthlyDeposits = transactions.filter((transaction) => {
        const dateParts = getTransactionDateParts(
            transaction.created_at
        );

        return (
            dateParts &&
            dateParts.year === year &&
            dateParts.month === month &&
            String(transaction.transaction_type || "").toLowerCase() === "deposit"
        );
    });

    const totalDeposits = monthlyDeposits.reduce(
        (total, transaction) =>
            total + Number(transaction.amount || 0),
        0
    );

    const sortedTransactions = sortTransactions(monthlyDeposits);

    return {
        hasAccounts: accounts.length > 0,
        year,
        month,
        totalDeposits,
        formattedTotalDeposits: formatTransactionAmount(totalDeposits),
        transactionCount: sortedTransactions.length,
        transactions: sortedTransactions.map(addTransactionFormatting),
    };
};


const getYearlyTransfers = async (userId, year) => {
    const selectedYear = validateYear(year);

    const { accounts, transactions } =
        await getAllUserTransactions(userId);

    const userAccountIds = new Set(
        accounts.map((account) => Number(account.id))
    );

    const yearlyTransfers = transactions.filter((transaction) => {
        if (
            String(transaction.transaction_type || "").toLowerCase() !== "transfer" ||
            !userAccountIds.has(Number(transaction.sender_account_id))
        ) {
            return false;
        }

        const dateParts = getTransactionDateParts(
            transaction.created_at
        );

        return dateParts && dateParts.year === selectedYear;
    });

    const totalTransfers = yearlyTransfers.reduce(
        (total, transaction) =>
            total + Number(transaction.amount || 0),
        0
    );

    const sortedTransactions = sortTransactions(yearlyTransfers);

    return {
        hasAccounts: accounts.length > 0,
        year: selectedYear,
        totalTransfers,
        formattedTotalTransfers: formatTransactionAmount(totalTransfers),
        transactionCount: sortedTransactions.length,
        transactions: sortedTransactions.map(addTransactionFormatting),
    };
};


const getYearlyDeposits = async (userId, year) => {
    const selectedYear = validateYear(year);

    const { accounts, transactions } =
        await getAllUserTransactions(userId);

    if (!accounts.length) {
        return {
            hasAccounts: false,
            year: selectedYear,
            totalDeposits: 0,
            formattedTotalDeposits: formatTransactionAmount(0),
            transactionCount: 0,
            transactions: [],
        };
    }

    const yearlyDeposits = transactions.filter((transaction) => {
        if (
            String(transaction.transaction_type || "").toLowerCase() !== "deposit"
        ) {
            return false;
        }

        const dateParts = getTransactionDateParts(
            transaction.created_at
        );

        return dateParts && dateParts.year === selectedYear;
    });

    const totalDeposits = yearlyDeposits.reduce(
        (total, transaction) =>
            total + Number(transaction.amount || 0),
        0
    );

    const sortedTransactions = sortTransactions(yearlyDeposits);

    return {
        hasAccounts: true,
        year: selectedYear,
        totalDeposits,
        formattedTotalDeposits: formatTransactionAmount(totalDeposits),
        transactionCount: sortedTransactions.length,
        transactions: sortedTransactions.map(addTransactionFormatting),
    };
};


const getMonthlyWithdrawals = async (userId, year, month) => {
    const validated = validateYearMonth(year, month);

    year = validated.year;
    month = validated.month;

    const { accounts, transactions } =
        await getAllUserTransactions(userId);

    if (!accounts.length) {
        return {
            hasAccounts: false,
            year,
            month,
            totalWithdrawals: 0,
            formattedTotalWithdrawals: formatTransactionAmount(0),
            transactionCount: 0,
            transactions: [],
        };
    }

    const monthlyWithdrawals = transactions.filter((transaction) => {
        if (
            String(transaction.transaction_type || "").toLowerCase() !== "withdraw"
        ) {
            return false;
        }

        const dateParts = getTransactionDateParts(
            transaction.created_at
        );

        return (
            dateParts &&
            dateParts.year === year &&
            dateParts.month === month
        );
    });

    const totalWithdrawals = monthlyWithdrawals.reduce(
        (total, transaction) =>
            total + Number(transaction.amount || 0),
        0
    );

    const sortedTransactions = sortTransactions(monthlyWithdrawals);

    return {
        hasAccounts: true,
        year,
        month,
        totalWithdrawals,
        formattedTotalWithdrawals:
            formatTransactionAmount(totalWithdrawals),
        transactionCount: sortedTransactions.length,
        transactions: sortedTransactions.map(addTransactionFormatting),
    };
};


const getYearlyWithdrawals = async (userId, year) => {
    const selectedYear = validateYear(year);

    const { accounts, transactions } =
        await getAllUserTransactions(userId);

    if (!accounts.length) {
        return {
            hasAccounts: false,
            year: selectedYear,
            totalWithdrawals: 0,
            formattedTotalWithdrawals: formatTransactionAmount(0),
            transactionCount: 0,
            transactions: [],
        };
    }

    const yearlyWithdrawals = transactions.filter((transaction) => {
        if (
            String(transaction.transaction_type || "").toLowerCase() !== "withdraw"
        ) {
            return false;
        }

        const dateParts = getTransactionDateParts(
            transaction.created_at
        );

        return dateParts && dateParts.year === selectedYear;
    });

    const totalWithdrawals = yearlyWithdrawals.reduce(
        (total, transaction) =>
            total + Number(transaction.amount || 0),
        0
    );

    const sortedTransactions = sortTransactions(yearlyWithdrawals);

    return {
        hasAccounts: true,
        year: selectedYear,
        totalWithdrawals,
        formattedTotalWithdrawals:
            formatTransactionAmount(totalWithdrawals),
        transactionCount: sortedTransactions.length,
        transactions: sortedTransactions.map(addTransactionFormatting),
    };
};

const getAccountOverview = async (userId) => {
    const accounts = await getAccountByUserId(userId);

    if (!accounts || accounts.length === 0) {
        return {
            hasAccounts: false,
            totalAccounts: 0,
            totalBalance: 0,
            formattedTotalBalance: formatTransactionAmount(0),
            highestBalanceAccount: null,
            accounts: [],
        };
    }

    const totalBalance = accounts.reduce(
        (total, account) =>
            total + Number(account.balance || 0),
        0
    );

    const highestBalanceAccount = accounts.reduce(
        (highest, account) =>
            Number(account.balance || 0) >
                Number(highest.balance || 0)
                ? account
                : highest,
        accounts[0]
    );

    return {
        hasAccounts: true,
        totalAccounts: accounts.length,
        totalBalance,
        formattedTotalBalance: formatTransactionAmount(totalBalance),

        highestBalanceAccount: {
            id: highestBalanceAccount.id,
            accountType: highestBalanceAccount.account_type,
            balance: Number(highestBalanceAccount.balance || 0),
            status: highestBalanceAccount.status,
        },

        accounts: accounts.map((account) => ({
            id: account.id,
            accountType: account.account_type,
            balance: Number(account.balance || 0),
            status: account.status,
        })),
    };
};


module.exports = {
    getAccountBalance,
    getRecentTransactions,
    getTransactionsByMonth,
    getMonthlySpending,
    getMonthlyDeposits,
    getYearlyTransfers,
    getYearlyDeposits,
    getMonthlyWithdrawals,
    getYearlyWithdrawals,
    getAccountOverview,
};
