import { iStakeInfo, StakeInfo } from "../models/stakeInfoModel";
import { Bot, iBot } from "../models/botModel";
import { User } from "../models/userModel";
import { sendTokens } from "./balanceService";

export const isStakeUnstakable = (stakeInfo: iStakeInfo): boolean => {
    const stakeDate = new Date(stakeInfo.timestamp);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return stakeDate <= threeDaysAgo;
};

export const filterEligibleStakes = (stakes: iStakeInfo[]): iStakeInfo[] => {
    return stakes.filter(isStakeUnstakable);
};

export async function calculateEligibleUnstakingAmount(stakes: iStakeInfo[]): Promise<[number, number]> {
    const eligibleStakes = filterEligibleStakes(stakes);
    if (eligibleStakes.length === 0) {
        throw { status: 400, message: "No eligible stakes to unstake." };
    }

    const totalStakedAmount = eligibleStakes.reduce((sum, stake) => sum + stake.amount, 0);
    const totalUnstakeAmount = totalStakedAmount * 0.95; // 예: 5% 수수료 적용
    return [totalStakedAmount, totalUnstakeAmount];
}

export const validateAllStakesUnstakable = (stakes: iStakeInfo[]): void => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    for (const stake of stakes) {
        const stakeDate = new Date(stake.timestamp);
        if (stakeDate > threeDaysAgo) {
            throw {
                status: 400,
                message: "Unstaking not allowed. No eligible stakes found (must be older than 3 days)."
            };
        }
    }
};

export async function getBotAndActiveStakes(bot_id: string, user_id: string) {
    const bot: iBot | null = await Bot.findOne({ bot_id }).exec();
    if (!bot) {
        throw { status: 404, message: "Bot not found" };
    }

    const activeStakes: iStakeInfo[] = await StakeInfo.find({ bot_id, user_id, status: 0 }).sort({ timestamp: -1 }).exec();
    if (activeStakes.length === 0) {
        throw { status: 404, message: "No active stakes found" };
    }

    return { bot, activeStakes };
}

export async function calculateUnstakingAmount(user_id: string): Promise<[number, number]> {
    const stakes = await StakeInfo.find({ user_id }).exec();
    if (!stakes || stakes.length === 0) {
        throw { status: 404, message: "No stakes found" };
    }

    const totalStakedAmount = stakes.reduce((sum, stake) => sum + stake.amount, 0);
    const totalUnstakeAmount = totalStakedAmount * 0.95; // 예: 5% 수수료 적용
    return [totalStakedAmount, totalUnstakeAmount];
}

export async function processUnstaking(totalStakedAmount: number, totalUnstakeAmount: number, eligibleStakes: iStakeInfo[], bot: iBot, user_id: string,) {
    try {
        const user = await User.findOneAndUpdate(
            { user_id: user_id },
            { $inc: { stakeAmount: -totalStakedAmount } },
            { new: true }
        ).exec();

        if (!user) {
            throw { status: 404, message: "User not found" };
        }

        if (user.stakeAmount < 0) {
            user.stakeAmount = 0;
            await user.save();
        }

        bot.investAmount = Math.max(0, bot.investAmount - totalStakedAmount);
        bot.subscriber = Math.max(0, bot.subscriber - 1);
        await bot.save();

        for (const stake of eligibleStakes) {
            stake.status = 1;
            stake.unstakedAt = new Date();
            stake.unstakedAmount = totalStakedAmount;
            await stake.save();
        }

        if (!user_id) {
            throw { status: 400, message: "Receive address is not provided." };
        }

        await sendTokens(totalUnstakeAmount, user_id);

    } catch (error) {
        console.error(`Error during unstaking process for user_id: ${user_id}`, error);
        throw error;
    }
}
