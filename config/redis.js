
const { createClient } = require("redis");

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.REDIS_URL) {
    throw new Error("REDIS_URL is missing in production");
}

const redisUrl = process.env.REDIS_URL;

if (isProduction && !redisUrl.startsWith("rediss://")) {
    throw new Error("Production Redis must use TLS (rediss://)");
}

const client = createClient({
    url: redisUrl,

    socket: {
        connectTimeout: 15000,

        reconnectStrategy: (retries) => {
            if (retries > 10) {
                return new Error("Redis reconnection limit reached");
            }

            return Math.min(retries * 500, 3000);
        },
    },
});

client.on("connect", () => {
    console.log("Redis connecting...");
});

client.on("ready", () => {
    console.log("Redis ready");
});

client.on("error", (err) => {
    console.error("Redis Error:", err.message);
});

client.on("reconnecting", () => {
    console.log("Redis reconnecting...");
});

const connectRedis = async () => {
    if (!client.isOpen) {
        await client.connect();
    }

    const result = await client.ping();

    if (result !== "PONG") {
        throw new Error("Redis PING verification failed");
    }

    console.log("Redis connected successfully:", result);
};

module.exports = {
    client,
    connectRedis,
};
