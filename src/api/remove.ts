import express from 'express';
import { User } from '../models/userModel';
import {
    // validateUnstakableDate,
    getBotAndActiveStakes,
    calculateUnstackingAmount,
    processUnstaking,
    calculateEligibleUnstakingAmount, validateAllStakesUnstakable
} from "../services/stakingService";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();
const rpcEndpoint = process.env.RPC_ENDPOINT || "";
// Private key of the Kaiya wallet
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// Contract
const QVE_TOKEN_ADDRESS = process.env.QVE_TOKEN_ADDRESS || ""; // qveToken
const TOKEN_VAULT_ADDRESS = process.env.TOKEN_VAULT_ADDRESS || ""; // tokenVault
const Wklay_ADDRESS = process.env.Wklay_ADDRESS || ""; // Wklay

const ERC20_ABI = [
    {
        "constant": false,
        "inputs": [
            { "name": "_spender", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "success", "type": "bool" }],
        "type": "function"
    }
];

const router = express.Router();

// Unstaking amount calculation API
router.post('/yucca/remove/calculate', async (req, res) => {
    const { user_id, bot_id } = req.body;

    try {
        const { activeStakes, bot } = await getBotAndActiveStakes(bot_id, user_id);
        if (activeStakes.length === 0) {
            return res.status(404).json({ success: false, message: 'No active stakes found.' });
        }
        validateAllStakesUnstakable(activeStakes);

        const [totalStakedAmount, totalUnstakeAmount] = await calculateUnstackingAmount(user_id);
        const adjustedUnstakeAmount = parseFloat(totalUnstakeAmount.toFixed(6));

        // approve request
        const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(Wklay_ADDRESS, ERC20_ABI, wallet); // wKLAY 주소 사용

        const approveTx = await contract.approve(
            TOKEN_VAULT_ADDRESS, // TokenVault 주소
            ethers.utils.parseUnits(String(adjustedUnstakeAmount), "ether")
        );
        await approveTx.wait();

        return res.json({
            success: true,
            unstakedAmount: adjustedUnstakeAmount,
            totalStakedAmount: totalStakedAmount,
            totalUnstakeAmount: totalUnstakeAmount,
            message: 'Approval request sent successfully.',
        });
    } catch (error: any) {
        console.error('Error occurred:', error.message);
        console.error('Stack trace:', error.stack);
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ success: false, message: error.message || 'Server Error' });
    }
});

// Unstaking final processing API
router.post('/yucca/remove/final', async (req, res) => {
    const { user_id, bot_id } = req.body;

    try {
        const { bot, activeStakes } = await getBotAndActiveStakes(bot_id, user_id);
        if (activeStakes.length === 0) {
            return res.status(404).json({ success: false, message: 'No active stakes found.' });
        }
        // 단 하나라도 날짜가 성립하지 않는 경우 에러 발생
        validateAllStakesUnstakable(activeStakes);
        const [totalStakedAmount, totalUnstakeAmount] = await calculateUnstackingAmount(user_id);
        const adjustedUnstakeAmount = parseFloat(totalUnstakeAmount.toFixed(6));

        await processUnstaking(totalStakedAmount, adjustedUnstakeAmount, activeStakes, bot, user_id);

        return res.json({ success: true, message: "Remove Successfully"});
    } catch (error: any) {
        console.error('Error occurred:', error.message);
        console.error('Stack trace:', error.stack);
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ success: false, message: error.message || 'Server error' });
    }
});

export default router;
