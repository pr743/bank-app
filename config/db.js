
const mysql = require("mysql2");

const requiredEnv = [
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
    }
}

if (process.env.DB_SSL !== "true") {
    throw new Error("TiDB production SSL must be enabled");
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 15000,

    ssl: {
        minVersion: "TLSv1.2",
    },
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error("TiDB connection failed:", err.message);
        return;
    }

    console.log("TiDB production database connected!");

    connection.release();
});

module.exports = pool.promise();
