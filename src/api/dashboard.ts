import express from 'express';
import {User} from '../models/userModel';
import {Bot, iBot} from '../models/botModel';
import {getProfitPerBot, getTotalStakedAmount} from "../services/botService";
import {getBalance} from '../services/balanceService';

const router = express.Router();

interface QueryParams {
    user_id?: string;
    token?: string;
}

const NTRNUSDT = 0.35;
const domesticRage = 10.3;

router.get('/yucca/dashboard', async (req, res) => {
    try {
        const { user_id, token }: QueryParams = req.query;

        console.log("받은 user_id:", user_id);

        if (!user_id) {
            return res.status(400).json({ error: '유저 ID가 필요합니다.' });
        }

        const user = await User.findOne({ user_id: user_id });
        console.log("조회된 유저 정보: ", user);

        if (!user) {
            return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
        }

        const bots: iBot[] = await Bot.find({}).exec();
        console.log("조회된 봇들: ", bots);

        if (bots.length === 0) {
            return res.status(404).json({ error: '유저에게 할당된 봇이 없습니다.' });
        }

        const botIds = bots.map(bot => bot.bot_id);
        const botDataMap = new Map<string, any>();

        let totalBalance = 0;
        let totalProfit = 0;

        for (let botId of botIds) {
            const bot: iBot | null = await Bot.findOne({ bot_id: botId }).exec();
            if (!bot) {
                console.log(`봇 ${botId}를 찾을 수 없습니다.`);
                continue; // 봇을 찾지 못하면 다음으로 넘어갑니다.
            }

            let latestBalance;
            let totalStakedAmount;

            try {
                latestBalance = await getBalance(bot.address);
                console.log(`봇 ${bot.bot_id}의 최신 잔액:`, latestBalance);
            } catch (error) {
                console.error(`봇 ${bot.bot_id}의 잔액 조회 중 오류 발생:`, error);
                continue; // 잔액 조회 중 오류가 나면 이 봇은 스킵합니다.
            }

            try {
                totalStakedAmount = await getTotalStakedAmount(botId, user_id);
                console.log(`봇 ${bot.bot_id}의 총 스테이킹 금액:`, totalStakedAmount);
            } catch (error) {
                console.error(`봇 ${bot.bot_id}의 스테이킹 금액 조회 중 오류 발생:`, error);
                continue; // 스테이킹 금액 조회 중 오류가 나면 이 봇은 스킵합니다.
            }

            if (latestBalance && totalStakedAmount) {
                let totalProfitPerBot, dailyProfitPerBot;

                try {
                    totalProfitPerBot = await getProfitPerBot(botId, user_id);
                    console.log(`봇 ${bot.bot_id}의 총 수익:`, totalProfitPerBot);
                } catch (error) {
                    console.error(`봇 ${bot.bot_id}의 수익 조회 중 오류 발생:`, error);
                    continue;
                }

                try {
                    dailyProfitPerBot = await getProfitPerBot(botId, undefined, true);
                    console.log(`봇 ${bot.bot_id}의 일일 수익:`, dailyProfitPerBot);
                } catch (error) {
                    console.error(`봇 ${bot.bot_id}의 일일 수익 조회 중 오류 발생:`, error);
                    continue;
                }

                totalProfit += totalProfitPerBot * totalStakedAmount;
                totalBalance += totalStakedAmount;

                if (!token || (token && bot.chain === token)) {
                    botDataMap.set(botId, {
                        bot_id: bot.bot_id,
                        bot_name: bot.name,
                        total_investment: totalStakedAmount,
                        current_value: totalStakedAmount * (1 + totalProfitPerBot),
                        daily_pnl: dailyProfitPerBot * totalStakedAmount,
                        total_profit: totalProfitPerBot * totalStakedAmount,
                    });
                }
            }
        }

        const botsData = Array.from(botDataMap.values());

        if (botsData.length === 0) {
            return res.status(404).json({ error: '조회된 봇 정보가 없습니다.' });
        }

        const dashboardData = {
            total_balance: totalBalance,
            total_profit: totalProfit,
            total_balance_usdt: totalBalance * NTRNUSDT,
            total_profit_usdt: totalProfit * NTRNUSDT,
            domesticRage: domesticRage,
            bots: botsData,
        };

        console.log("대시보드 데이터:", dashboardData);

        res.json(dashboardData);

    } catch (error) {
        console.error("오류 발생:", error);
        res.status(500).json({ error: '서버 내부 오류' });
    }
});

export default router;
