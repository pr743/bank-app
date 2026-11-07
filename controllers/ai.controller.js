const { generateAIResponse } = require("../services/ai/gemini.service");

const {
    getRecentTransactions,
    getTransactionsByMonth,
    getMonthlySpending,
    getMonthlyDeposits,
    getYearlyTransfers,
    getYearlyDeposits,
    getMonthlyWithdrawals,
    getYearlyWithdrawals,
    getAccountOverview,
} = require("../services/ai/banking-tools.service");


const extractTransactionLimit = (message) => {
    const match = message.match(
        /\b(?:last|latest|recent)\s+(\d+)\s+(?:transactions|payments|records)\b/i
    );

    if (!match) return 5;

    const requestedLimit = Number(match[1]);

    return Math.min(Math.max(requestedLimit, 1), 50);
};


const extractSpendingPeriod = (message) => {
    const now = new Date();

    const monthNames = [
        "january", "february", "march", "april",
        "may", "june", "july", "august",
        "september", "october", "november", "december",
    ];

    const currentParts = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "numeric",
    }).formatToParts(now);

    const currentYear = Number(
        currentParts.find((part) => part.type === "year").value
    );

    const currentMonth = Number(
        currentParts.find((part) => part.type === "month").value
    );

    const monthMatch = message.match(
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})?\b/i
    );

    if (monthMatch) {
        return {
            year: monthMatch[2]
                ? Number(monthMatch[2])
                : currentYear,

            month:
                monthNames.indexOf(
                    monthMatch[1].toLowerCase()
                ) + 1,
        };
    }

    if (/\bthis month\b/i.test(message)) {
        return {
            year: currentYear,
            month: currentMonth,
        };
    }

    if (/\blast month\b/i.test(message)) {
        let year = currentYear;
        let month = currentMonth - 1;

        if (month === 0) {
            month = 12;
            year--;
        }

        return { year, month };
    }

    return null;
};


const extractYear = (message) => {
    const match = message.match(/\b(20\d{2})\b/);

    return match ? Number(match[1]) : null;
};


const formatTransactionsForResponse = (transactions = []) => {
    return transactions.map((transaction) => {
        const transactionType = String(
            transaction.transaction_type || ""
        ).toLowerCase();

        let type = "Not available";

        let amount =
            transaction.formattedAmount ||
            "Amount not available";

        if (transactionType === "deposit") {
            type = "Deposit";
            amount = `+${amount}`;
        } else if (transactionType === "withdraw") {
            type = "Withdrawal";
            amount = `-${amount}`;
        } else if (transactionType === "transfer") {
            type = "Transfer";
        }

        return {
            id: transaction.id,
            type,
            amount,
            date: transaction.formattedDate || "Date not available",
            from: transaction.sender_name || null,
            to: transaction.receiver_name || null,

            receivedBy:
                transactionType === "deposit"
                    ? transaction.receiver_name || null
                    : null,

            withdrawnFrom:
                transactionType === "withdraw"
                    ? transaction.sender_name || null
                    : null,
        };
    });
};


const formatAccountOverviewForResponse = (data) => {
    if (!data) return null;

    return {
        reportType: "account_overview",
        hasAccounts: Boolean(data.hasAccounts),
        totalAccounts: data.totalAccounts ?? 0,
        totalBalance: data.totalBalance ?? 0,
        formattedTotalBalance:
            data.formattedTotalBalance || "₹0.00",

        highestBalanceAccount: data.highestBalanceAccount
            ? {
                id: data.highestBalanceAccount.id,
                accountType: data.highestBalanceAccount.accountType,
                balance: data.highestBalanceAccount.balance,
                status: data.highestBalanceAccount.status,
            }
            : null,

        accounts: (data.accounts || []).map((account) => ({
            id: account.id,
            accountType: account.accountType,
            balance: account.balance,
            status: account.status,
        })),
    };
};

const chatWithAI = async (req, res) => {
    try {

        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const { message } = req.body || {};


        if (
            !message ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a message",
            });
        }

        if (message.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Message cannot exceed 1000 characters",
            });
        }

        const userMessage = message.trim();
        const userId = req.user.id;

        let bankingData = null;


        const spendingKeywords =
            /\b(spend|spending|spent|expense|expenses)\b/i.test(
                userMessage
            );

        const isDepositQuestion =
            /\b(deposit|deposits|received|receive|income|credited)\b/i.test(
                userMessage
            );

        const isTransactionQuestion =
            /\b(transaction|transactions|payment|payments|transfer|transfers)\b/i.test(
                userMessage
            );

        const isTransferQuestion =
            /\b(transfers?|sent|send|money sent)\b/i.test(
                userMessage
            );

        const isWithdrawalQuestion =
            /\b(withdrawals?|withdrawn|withdrew|cash withdrawal)\b/i.test(
                userMessage
            );

        const isAccountOverviewQuestion =
            /\b(account overview|account summary|my accounts|all my accounts|total account balance|total balance|account details|current account balance|account balance|my balance)\b/i.test(
                userMessage
            );

        const spendingPeriod =
            extractSpendingPeriod(userMessage);

        const requestedYear =
            extractYear(userMessage);

        const isSpendingQuestion =
            spendingKeywords && spendingPeriod !== null;


        if (isAccountOverviewQuestion) {
            const result = await getAccountOverview(userId);

            bankingData = {
                reportType: "account_overview",
                ...result,
            };
        }

        else if (isWithdrawalQuestion && spendingPeriod) {
            const result = await getMonthlyWithdrawals(
                userId,
                spendingPeriod.year,
                spendingPeriod.month
            );

            bankingData = {
                reportType: "monthly_withdrawals",
                ...result,
            };
        }

        else if (
            isWithdrawalQuestion &&
            requestedYear &&
            !spendingPeriod
        ) {
            const result = await getYearlyWithdrawals(
                userId,
                requestedYear
            );

            bankingData = {
                reportType: "yearly_withdrawals",
                ...result,
            };
        }

        else if (isDepositQuestion && spendingPeriod) {
            const result = await getMonthlyDeposits(
                userId,
                spendingPeriod.year,
                spendingPeriod.month
            );

            bankingData = {
                reportType: "monthly_deposits",
                ...result,
            };
        }

        else if (
            isDepositQuestion &&
            requestedYear &&
            !spendingPeriod
        ) {
            const result = await getYearlyDeposits(
                userId,
                requestedYear
            );

            bankingData = {
                reportType: "yearly_deposits",
                ...result,
            };
        }

        else if (
            isTransferQuestion &&
            requestedYear &&
            !spendingPeriod
        ) {
            const result = await getYearlyTransfers(
                userId,
                requestedYear
            );

            bankingData = {
                reportType: "yearly_transfers",
                ...result,
            };
        }

        else if (isSpendingQuestion) {
            const result = await getMonthlySpending(
                userId,
                spendingPeriod.year,
                spendingPeriod.month
            );

            bankingData = {
                reportType: "monthly_spending",
                ...result,
            };
        }

        else if (isTransactionQuestion) {
            if (spendingPeriod) {
                bankingData = await getTransactionsByMonth(
                    userId,
                    spendingPeriod.year,
                    spendingPeriod.month
                );
            } else {
                const limit =
                    extractTransactionLimit(userMessage);

                bankingData = await getRecentTransactions(
                    userId,
                    limit
                );
            }
        }


        const aiResponse = await generateAIResponse(
            userMessage,
            bankingData
        );


        const formattedTransactions =
            bankingData?.transactions
                ? formatTransactionsForResponse(
                    bankingData.transactions
                )
                : [];

        const accountOverview =
            bankingData?.reportType === "account_overview"
                ? formatAccountOverviewForResponse(bankingData)
                : null;

        return res.status(200).json({
            success: true,
            message: "AI response generated successfully",

            data: {
                question: userMessage,
                answer: aiResponse,
                transactions: formattedTransactions,
                bankingData: accountOverview,
            },
        });

    } catch (error) {
        console.error("FinBank AI Error:", {
            message: error.message,
            status: error.status || error.code || "UNKNOWN",
        });

        const status = Number(
            error.status || error.code || 0
        );

        if ([408, 429, 503, 504].includes(status)) {
            return res.status(503).json({
                success: false,
                message: "FinBank AI is temporarily unavailable. Please try again.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to process your request right now",
        });
    }
};

module.exports = { chatWithAI };
