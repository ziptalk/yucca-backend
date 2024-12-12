import express from 'express';
import { User } from '../models/userModel';
import { Bot, iBot } from '../models/botModel';
import { getProfitPerBot, getTotalStakedAmount } from "../services/botService";
import {getBalance, getPrice} from '../services/balanceService';
import { StakeInfo } from '../models/stakeInfoModel';

const router = express.Router();

interface QueryParams {
    user_id?: string;
    token?: string;
}

router.get('/yucca/dashboard', async (req, res) => {
    try {
        const { user_id, token }: QueryParams = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const user = await User.findOne({ user_id: user_id }).exec();
        console.log("MongoDB 조회 결과:", user);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const bots: iBot[] = await Bot.find({}).exec();
        const botDataMap = new Map<string, any>();
        let totalProfit = 0;
        let totalInvestedAmount = 0;

        for (const bot of bots) {
            const totalStakedAmount = await getTotalStakedAmount(bot.bot_id, user_id);
            const latestBalance = await getBalance(bot.address);

            if (bot && latestBalance && totalStakedAmount) {
                const totalProfitPerBotPercentage = await getProfitPerBot(bot.bot_id, user_id);
                const totalProfitPerBot = totalProfitPerBotPercentage / 100;
                const profitAmount = totalStakedAmount * totalProfitPerBot;

                totalInvestedAmount += totalStakedAmount;
                totalProfit += profitAmount;

                //const firstStake = await StakeInfo.findOne({ user_id, bot_id: bot.bot_id, status: 0 }).sort({ timestamp: 1 }).exec();
                const firstStake = await StakeInfo.findOne({ user_id, bot_id: bot.bot_id }).sort({ timestamp: 1 }).exec();
                if (!firstStake) {
                    console.log('No stake info found for user:', user_id);
                    return res.status(404).json({ error: 'No stake info found for user' });
                }

                const timeframeNumber = calculateTimeframe(firstStake.timestamp);
                const pnlData = await generatePnlData(bot.bot_id, user_id, timeframeNumber);

                if (!token || (token && bot.chain === token)) {
                    botDataMap.set(bot.bot_id, {
                        bot_id: bot.bot_id,
                        bot_name: bot.name,
                        total_investment: totalStakedAmount,
                        current_value: totalStakedAmount + profitAmount,
                        total_profit: profitAmount,
                        pnlData: pnlData.map(data => ({
                            createdAt: data.date,
                            pnlRate: data.pnlRate
                        })).reverse(),
                    });
                }
            }
        }

        const botsData = Array.from(botDataMap.values());
        const domesticRate = await getPrice("BTCUSDT");
        const dashboardData = formatDashboardData(totalProfit, domesticRate, totalInvestedAmount, botsData);

        console.log("생성된 대시보드 데이터:", dashboardData);
        res.json(dashboardData);

    } catch (error) {
        console.error("서버 내부 오류 발생:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function calculateTimeframe(stakeTimestamp: Date, maxDays: number = 10): number {
    const daysSinceStake = Math.ceil((new Date().getTime() - stakeTimestamp.getTime()) / (1000 * 3600 * 24));
    return Math.min(daysSinceStake, maxDays);
}

function formatDashboardData(totalProfit: number, domesticRate: number, totalInvestedAmount: number, botsData: any[]) {
    const totalPnl = totalInvestedAmount > 0 ? (totalProfit / totalInvestedAmount) * 100 : 0;
    const formattedTotalPnl = totalPnl.toFixed(2);
    const totalAmount = totalInvestedAmount + totalProfit;

    return {
        total_balance: totalInvestedAmount,
        total_amount: totalAmount,
        domesticRate: (1 / domesticRate).toFixed(2),
        total_pnl: formattedTotalPnl,
        bots: botsData
    };
}

async function generatePnlData(botId: string, userId: string, timeframeNumber: number): Promise<{ date: Date, pnlRate: number }[]> {
    return await Promise.all(
        Array.from({ length: timeframeNumber }, async (_, index) => {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - index);
            const pnlRate = await getProfitPerBot(botId, userId,  endDate);
            return {
                date: endDate,
                pnlRate: pnlRate
            };
        })
    );
}

export default router;
