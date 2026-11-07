const {
    createBeneficiary,
    findBeneficiaryByAccount,
    getBeneficiaries,
    deleteBeneficiary,
    findAccountByNumber
} = require("../models/beneficiary");



const addBeneficiary = async (
    req,
    res
) => {

    try {

        const user_id =
            req.user.id;

        const {
            beneficiary_name,
            beneficiary_account_number,
            bank_name,
            ifsc_code,
            nickname
        } = req.body;



        if (
            !beneficiary_name ||
            !beneficiary_account_number ||
            !bank_name ||
            !ifsc_code
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Beneficiary name, account number, bank name and IFSC code are required"
            });
        }



        const accountRows =
            await findAccountByNumber(
                beneficiary_account_number
            );


        if (
            !accountRows ||
            accountRows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Bank account not found"
            });
        }


        const account =
            accountRows[0];



        if (
            Number(account.user_id) ===
            Number(user_id)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "You cannot add your own account as beneficiary"
            });
        }



        const exists =
            await findBeneficiaryByAccount(
                user_id,
                beneficiary_account_number
            );


        if (
            exists &&
            exists.length > 0
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "This account is already added as beneficiary"
            });
        }



        const verifiedBankName =
            account.bank_name;

        const verifiedIfsc =
            account.ifsc_prefix;



        const beneficiaryId =
            await createBeneficiary({

                user_id,

                beneficiary_name:
                    account.full_name,

                beneficiary_account_number:
                    account.account_number,

                bank_name:
                    verifiedBankName,

                ifsc_code:
                    verifiedIfsc,

                nickname:
                    nickname?.trim() || null
            });


        return res.status(201).json({

            success: true,

            message:
                "Beneficiary added successfully",

            data: {
                id:
                    beneficiaryId,

                beneficiary_name:
                    account.full_name,

                beneficiary_account_number:
                    account.account_number,

                bank_name:
                    verifiedBankName,

                ifsc_code:
                    verifiedIfsc,

                nickname:
                    nickname?.trim() || null
            }
        });


    } catch (error) {

        console.error(
            "Add Beneficiary Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Error adding beneficiary",

            error:
                error.message
        });
    }
};




const verifyBeneficiaryAccount = async (
    req,
    res
) => {

    try {

        const {
            account_number
        } = req.params;



        if (
            !account_number ||
            !account_number.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Account number is required"
            });
        }



        const accountRows =
            await findAccountByNumber(
                account_number.trim()
            );


        if (
            !accountRows ||
            accountRows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Bank account not found"
            });
        }


        const account =
            accountRows[0];



        return res.status(200).json({

            success: true,

            message:
                "Account verified successfully",

            data: {

                full_name:
                    account.full_name,

                account_number:
                    account.account_number,

                bank_name:
                    account.bank_name,

                ifsc_code:
                    account.ifsc_prefix
            }
        });


    } catch (error) {

        console.error(
            "Verify Beneficiary Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Error verifying bank account",

            error:
                error.message
        });
    }
};




const getMyBeneficiaries = async (
    req,
    res
) => {

    try {

        const user_id =
            req.user.id;


        const beneficiaries =
            await getBeneficiaries(
                user_id
            );


        return res.status(200).json({

            success: true,

            message:
                "Beneficiaries fetched successfully",

            data:
                beneficiaries || []
        });


    } catch (error) {

        console.error(
            "Get Beneficiaries Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Error fetching beneficiaries",

            error:
                error.message
        });
    }
};




const removeBeneficiary = async (
    req,
    res
) => {

    try {

        const user_id =
            req.user.id;

        const {
            id
        } = req.params;


        if (!id) {

            return res.status(400).json({
                success: false,
                message:
                    "Beneficiary ID is required"
            });
        }


        const result =
            await deleteBeneficiary(
                id,
                user_id
            );



        if (
            result.affectedRows === 0
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Beneficiary not found"
            });
        }


        return res.status(200).json({

            success: true,

            message:
                "Beneficiary removed successfully"
        });


    } catch (error) {

        console.error(
            "Delete Beneficiary Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Error deleting beneficiary",

            error:
                error.message
        });
    }
};




module.exports = {

    addBeneficiary,

    getMyBeneficiaries,

    removeBeneficiary,

    verifyBeneficiaryAccount
};