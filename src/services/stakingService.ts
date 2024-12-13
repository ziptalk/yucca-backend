import { iStakeInfo, StakeInfo } from "../models/stakeInfoModel";
import { Bot, iBot } from "../models/botModel";
import { User } from "../models/userModel";
import { sendTokens } from "./balanceService";
import {getProfitPerBot, getTotalStakedAmount} from "./botService";

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

export async function calculateUnstackingAmount(user_id: string): Promise<[number, number]> {
    const bots: iBot[] = await Bot.find({}).exec();
    const botIds = bots.map(bot => bot.bot_id);

    let totalProfitAmount = 0;
    let totalInvestedAmount = 0;

    for (let botId of botIds) {
        const bot: iBot | null = await Bot.findOne({ bot_id: botId }).exec();
        if (!bot) {
            console.error("Bot not found");
            continue;
        }
        const totalStakedAmount = await getTotalStakedAmount(botId, user_id);

        if (!totalStakedAmount) {
            continue;
        }

        const totalProfitPerBotPercentage = await getProfitPerBot(botId, user_id);
        const totalProfitPerBot = totalProfitPerBotPercentage / 100;
        const profitAmount = totalStakedAmount * totalProfitPerBot;

        totalInvestedAmount += totalStakedAmount;
        totalProfitAmount += profitAmount;
    }
    totalProfitAmount *= 0.8

    return [totalInvestedAmount, totalInvestedAmount + totalProfitAmount];
}

async function updateBotInfo(bot: iBot, amount: number) {
    bot.subscriber = Math.max(0, bot.subscriber - 1);
    bot.investAmount = Math.max(0, bot.investAmount - amount);
    await bot.save();
}

async function updateStakeStatus(activeStakes: iStakeInfo[], unstakedAmount:number) {
    await Promise.all(activeStakes.map(async (stakeInfo) => {
        stakeInfo.status = 1;
        stakeInfo.unstakedAmount = unstakedAmount;
        stakeInfo.unstakedAt = new Date();
        await stakeInfo.save();
    }));
}

export async function processUnstaking(totalStakedAmount: number, totalUnstakeAmount: number, eligibleStakes: iStakeInfo[], bot: iBot, user_id: string,) {
    try {
        await sendTokens(totalUnstakeAmount, user_id);
        await updateStakeStatus(eligibleStakes, totalUnstakeAmount);
        await updateBotInfo(bot, totalStakedAmount);
    } catch (error) {
        console.error(`Error during unstaking process for user_id: ${user_id}`, error);
        throw error;
    }
}
