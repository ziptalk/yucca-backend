import express from 'express';
import { iUser, User } from '../models/userModel';
import { Bot, iBot } from '../models/botModel';
import {
    // validateUnstakableDate,
    getBotAndActiveStakes,
    calculateUnstakingAmount,
    processUnstaking,
    calculateEligibleUnstakingAmount, validateAllStakesUnstakable
} from "../services/stakingService";

const router = express.Router();

// Unstaking amount calculation API
router.post('/api/remove/calculate', async (req, res) => {
    const { user_id, bot_id } = req.body;


    // Test log
    const user: iUser[] | null = await User.find({}).exec();
    const bot: iBot[] = await Bot.find({}).exec();
    console.log("User test log");
    console.log(user);
    console.log("Bot test log");
    console.log(bot);

    try {
        const { activeStakes } = await getBotAndActiveStakes(bot_id, user_id);
        if (activeStakes.length === 0) {
            return res.status(404).json({ success: false, message: 'No active stakes found.' });
        }
        validateAllStakesUnstakable(activeStakes);

        const [totalStakedAmount, totalUnstakeAmount] = await calculateUnstakingAmount(user_id);
        const adjustedUnstakeAmount = parseFloat(totalUnstakeAmount.toFixed(6));

        return res.json({
            success: true,
            unstakedAmount: adjustedUnstakeAmount,
            totalStakedAmount: totalStakedAmount,
            totalUnstakeAmount: totalUnstakeAmount
        });
    } catch (error: any) {
        console.error('Error occurred:', error.message);
        console.error('Stack trace:', error.stack);
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ success: false, message: error.message || 'Server Error' });
    }
});

// Unstaking final processing API
router.post('/api/remove/final', async (req, res) => {
    const { user_id, bot_id } = req.body;

    try {
        const { bot, activeStakes } = await getBotAndActiveStakes(bot_id, user_id);
        if (activeStakes.length === 0) {
            return res.status(404).json({ success: false, message: 'No active stakes found.' });
        }
        validateAllStakesUnstakable(activeStakes);

        //validateUnstakableDate(activeStakes[activeStakes.length - 1]);

        const [totalStakedAmount, totalUnstakeAmount] = await calculateEligibleUnstakingAmount(activeStakes);
        const adjustedUnstakeAmount = parseFloat(totalUnstakeAmount.toFixed(6));

        //filtering validate stakes
        const eligibleStakes = activeStakes.filter(stake => {
            const stakeDate = new Date(stake.timestamp);
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            return stakeDate <= threeDaysAgo;
        });

        if (eligibleStakes.length === 0) {
            return res.status(400).json({ success: false, message: 'Unstaking not allowed. No eligible stakes found (must be older than 3 days).' });
        }

        // Process unstaking
        await processUnstaking(totalStakedAmount, adjustedUnstakeAmount, eligibleStakes, bot, user_id);

        // Retrieve user information again (including updated stakeAmount)
        const user = await User.findOne({ user_id: user_id }).exec();
        if (!user) {
            throw { status: 404, message: "User not found after unstaking." };
        }

        return res.json({ success: true, message: "Successfully Unstaking", balance: user.stakeAmount });
    } catch (error: any) {
        console.error('Error occurred:', error.message);
        console.error('Stack trace:', error.stack);
        const statusCode = error.status || 500;
        return res.status(statusCode).json({ success: false, message: error.message || 'Server error' });
    }
});

export default router;
