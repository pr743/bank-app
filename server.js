require("dotenv").config();

const express = require("express");
const cors = require("cors");

const db = require("./config/db");
const { connectRedis } = require("./config/redis");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoute");
const accountRoutes = require("./routes/accountRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const beneficiaryRoutes = require("./routes/beneficiaryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const aiRouter = require("./routes/ai.routes");

const app = express();

app.disable("x-powered-by");

const PORT = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === "production";


const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map(origin => origin.trim()).filter(Boolean)
    : [];

if (isProduction && allowedOrigins.length === 0) {
    throw new Error("FRONTEND_URL must be configured in production.");
}

app.use(
    cors({
        origin(origin, callback) {

            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Origin not allowed by CORS"));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json({ limit: "1mb" }));


app.get("/", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "FinBank Digital Banking API is running",
    });
});


app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/beneficiaries", beneficiaryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRouter);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found",
    });
});


app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err.message === "Origin not allowed by CORS") {
        return res.status(403).json({
            success: false,
            message: "Request origin is not allowed",
        });
    }

    console.error("API error:", err.message);

    return res.status(err.status || 500).json({
        success: false,
        message:
            isProduction && (err.status || 500) >= 500
                ? "Internal server error"
                : err.message || "Something went wrong",
    });
});

let server;

async function startServer() {
    try {

        await db.query("SELECT 1");
        console.log("MySQL connection verified");


        await connectRedis();

        server = app.listen(PORT, () => {
            console.log(`FinBank API listening on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
        });
    } catch (error) {
        console.error("FinBank startup failed:", error.message);
        process.exitCode = 1;
    }
}

async function shutdown(signal) {
    console.log(`${signal} received. Shutting down...`);

    if (server) {
        server.close(async () => {
            try {
                const { client } = require("./config/redis");

                if (client.isOpen) {
                    await client.quit();
                }

                await db.end();
                process.exit(0);
            } catch (error) {
                console.error("Shutdown error:", error.message);
                process.exit(1);
            }
        });
    } else {
        process.exit(0);
    }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

startServer();
