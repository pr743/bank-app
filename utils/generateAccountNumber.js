
const crypto = require("crypto");

const generateAccountNumber = () => {
    // Generate a cryptographically secure 10-digit number.
    const number = crypto.randomInt(1000000000, 10000000000);

    return number.toString();
};

module.exports = generateAccountNumber;
