// const db =
//     require("../config/db");



// const createBeneficiary =
//     async ({
//         user_id,
//         beneficiary_name,
//         beneficiary_account_number,
//         bank_name,
//         ifsc_code,
//         nickname
//     }) => {

//         const [result] =
//             await db.query(
//                 `
//                 INSERT INTO beneficiaries
//                 (
//                     user_id,
//                     beneficiary_name,
//                     beneficiary_account_number,
//                     bank_name,
//                     ifsc_code,
//                     nickname
//                 )
//                 VALUES (?, ?, ?, ?, ?, ?)
//                 `,
//                 [
//                     user_id,
//                     beneficiary_name,
//                     beneficiary_account_number,
//                     bank_name,
//                     ifsc_code,
//                     nickname || null
//                 ]
//             );

//         return result.insertId;
//     };



// const findAccountByNumber =
//     async (accountNumber) => {

//         const [rows] =
//             await db.query(
//                 `
//             SELECT
//                 ba.account_number,
//                 u.full_name,

//                 b.bank_name,
//                 b.ifsc_prefix

//             FROM bank_accounts ba

//             JOIN users u
//             ON ba.user_id = u.id

//             JOIN banks b
//             ON ba.bank_id = b.id

//             WHERE ba.account_number = ?
//             `,
//                 [accountNumber]
//             );

//         return rows;
//     };


// const findBeneficiaryByAccount =
//     async (
//         user_id,
//         account_number
//     ) => {

//         const [rows] =
//             await db.query(
//                 `
//                 SELECT *
//                 FROM beneficiaries
//                 WHERE
//                     user_id = ?
//                 AND
//                     beneficiary_account_number = ?
//                 `,
//                 [
//                     user_id,
//                     account_number
//                 ]
//             );

//         return rows;
//     };



// const getBeneficiaries =
//     async (user_id) => {

//         const [rows] =
//             await db.query(
//                 `
//                 SELECT *
//                 FROM beneficiaries
//                 WHERE user_id = ?
//                 ORDER BY created_at DESC
//                 `,
//                 [user_id]
//             );

//         return rows;
//     };



// const deleteBeneficiary =
//     async (
//         id,
//         user_id
//     ) => {

//         return await db.query(
//             `
//             DELETE FROM beneficiaries
//             WHERE
//                 id = ?
//             AND
//                 user_id = ?
//             `,
//             [
//                 id,
//                 user_id
//             ]
//         );
//     };



// module.exports = {
//     createBeneficiary,
//     findBeneficiaryByAccount,
//     getBeneficiaries,
//     deleteBeneficiary,
//     findAccountByNumber
// };







const db = require("../config/db");



const createBeneficiary = async ({
    user_id,
    beneficiary_name,
    beneficiary_account_number,
    bank_name,
    ifsc_code,
    nickname
}) => {

    const [result] = await db.query(
        `
        INSERT INTO beneficiaries
        (
            user_id,
            beneficiary_name,
            beneficiary_account_number,
            bank_name,
            ifsc_code,
            nickname
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            user_id,
            beneficiary_name,
            beneficiary_account_number,
            bank_name,
            ifsc_code,
            nickname || null
        ]
    );

    return result.insertId;
};



const findAccountByNumber = async (
    accountNumber
) => {

    const [rows] = await db.query(
        `
        SELECT
            ba.id AS account_id,
            ba.account_number,
            ba.user_id,

            u.full_name,

            b.bank_name,
            b.ifsc_prefix

        FROM bank_accounts ba

        INNER JOIN users u
            ON ba.user_id = u.id

        INNER JOIN banks b
            ON ba.bank_id = b.id

        WHERE ba.account_number = ?

        LIMIT 1
        `,
        [
            accountNumber
        ]
    );

    return rows;
};



const findBeneficiaryByAccount = async (
    user_id,
    account_number
) => {

    const [rows] = await db.query(
        `
        SELECT
            id,
            user_id,
            beneficiary_name,
            beneficiary_account_number,
            bank_name,
            ifsc_code,
            nickname,
            is_favorite,
            status,
            created_at

        FROM beneficiaries

        WHERE
            user_id = ?
        AND
            beneficiary_account_number = ?

        LIMIT 1
        `,
        [
            user_id,
            account_number
        ]
    );

    return rows;
};



const getBeneficiaries = async (
    user_id
) => {

    const [rows] = await db.query(
        `
        SELECT
            id,
            beneficiary_name,
            beneficiary_account_number,
            bank_name,
            ifsc_code,
            nickname,
            is_favorite,
            status,
            created_at

        FROM beneficiaries

        WHERE user_id = ?

        ORDER BY
            is_favorite DESC,
            created_at DESC
        `,
        [
            user_id
        ]
    );

    return rows;
};



const deleteBeneficiary = async (
    id,
    user_id
) => {

    const [result] = await db.query(
        `
        DELETE FROM beneficiaries

        WHERE
            id = ?
        AND
            user_id = ?
        `,
        [
            id,
            user_id
        ]
    );

    return result;
};


module.exports = {
    createBeneficiary,
    findAccountByNumber,
    findBeneficiaryByAccount,
    getBeneficiaries,
    deleteBeneficiary
};