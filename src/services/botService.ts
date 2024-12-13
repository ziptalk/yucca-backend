import { Bot, iBot } from "../models/botModel";
import {Balance, iBalance} from "../models/balanceModel";
import {iStakeInfo, StakeInfo} from "../models/stakeInfoModel";

export const getTotalInvestAmount = async (): Promise<number> => {
    const totalInvestAmount = await Bot.aggregate([
        {
            $group: {
                _id: null,
                total_invest_amount: { $sum: "$investAmount" }
            }
        }
    ]);
    return totalInvestAmount[0]?.total_invest_amount || 0;
}

export const getProfitPerBot = async (botId: string, userId?: string, endDate?: Date): Promise<number> => {
    const bot: iBot | null = await Bot.findOne({ bot_id: botId }).exec();
    if (!bot) {
        throw new Error('Bot not found');
    }

    let startDate: Date;
    const actualEndDate = endDate || new Date();

    if (userId) {
        const firstStake = await StakeInfo.findOne({ bot_id: botId, user_id: userId, status:0 }).sort({ timestamp: 1 }).exec();
        startDate = firstStake ? firstStake.timestamp : new Date(0);
    } else {
        const firstBalance = await Balance.findOne({ bot_id: botId }).sort({ timestamp: 1 }).exec();
        startDate = firstBalance ? firstBalance.timestamp : new Date(0);
    }

    const stakeInfoQuery: any = { 
        bot_id: botId, 
        timestamp: { $gte: startDate, $lte: actualEndDate } 
    };

    const balanceInfoQuery: any = {
        bot_id: botId,
        timestamp: { $gte: startDate, $lte: actualEndDate },
    };

    const stakeInfos = await StakeInfo.find(stakeInfoQuery).sort({ timestamp: 1 }).exec();
    const balacneInfos = await Balance.find(balanceInfoQuery).sort({ timestamp: 1 }).exec();
    const filteredStakeInfos = userId ? stakeInfos.slice(1) : stakeInfos;
    return calculatePnlRate(botId, balacneInfos, filteredStakeInfos, userId);
};

async function calculatePnlRate(botId: string, balacneInfos: iBalance[], stakeInfos: iStakeInfo[], userId?: string): Promise<number> {

    if(balacneInfos.length === 0 ) return 0
    const lastBalance = balacneInfos[balacneInfos.length-1]
    let totalPnlRate = 1;
    let prevBalance = balacneInfos[0];

    for (const stakeInfo of stakeInfos) {
        try {
            const balanceBeforeStake = await Balance.findOne({
                bot_id: botId,
                timestamp: { $lt: stakeInfo.timestamp }
            }).sort({ timestamp: -1 }).exec();

            const balanceAfterStake = await Balance.findOne({
                bot_id: botId,
                timestamp: { $gt: stakeInfo.timestamp }
            }).sort({ timestamp: 1 }).exec();

            console.log('balanceBeforeStake:', balanceBeforeStake, 'balanceAfterStake:', balanceAfterStake);

            if (balanceBeforeStake && balanceAfterStake && prevBalance.balanceRate !== 0) {
                const pnlRateBeforeStake = (balanceBeforeStake.balanceRate - prevBalance.balanceRate) / prevBalance.balanceRate;
                if (userId) {
                    const userStakeRatio = stakeInfo.amount / balanceBeforeStake.balance;
                    totalPnlRate *= (1 + pnlRateBeforeStake * userStakeRatio);
                } else {
                    totalPnlRate *= (1 + pnlRateBeforeStake);
                }
                prevBalance = balanceAfterStake;
            }
            console.log('totalPnlRate:', totalPnlRate);
        } catch (error) {
            console.error('Error in calculatePnlRate loop:', error);
        }
    }

    if (prevBalance.balanceRate !== 0) {
        const finalPnlRate = (lastBalance.balanceRate - prevBalance.balanceRate) / prevBalance.balanceRate;
        // 사용자별 계산인 경우, 마지막 스테이킹 비율에 따라 최종 PNL 조정
        if (userId && stakeInfos.length > 0) {
            const lastStakeInfo = stakeInfos[stakeInfos.length - 1];
            const userStakeRatio = lastStakeInfo.amount / prevBalance.balance;
            totalPnlRate *= (1 + finalPnlRate * userStakeRatio);
        } else {
            totalPnlRate *= (1 + finalPnlRate);
        }
    }

    console.log(`Total PNL Rate: ${totalPnlRate - 1}`);
    return (totalPnlRate - 1) * 100;
}

export const getTotalStakedAmount = async (bot_id: string, user_id?: string): Promise<number> => {
    let stakeInfos: iStakeInfo[];
    if (user_id) {
        stakeInfos = await StakeInfo.find({ user_id: user_id, bot_id: bot_id, status: 0 }).exec();
    } else {
        stakeInfos = await StakeInfo.find({ bot_id: bot_id, status: 0 }).exec();
    }
    return stakeInfos.reduce((sum, stakeInfo) => sum + stakeInfo.amount, 0);
}
