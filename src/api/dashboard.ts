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

router.get('/yucca/dashboard', async (req, res) => {
    try {
        // 요청 쿼리에서 user_id와 token 값을 추출.
        const { user_id, token }: QueryParams = req.query;

        // user_id 로그 출력
        console.log("받은 user_id:", user_id);

        if (!user_id) {
            // user_id가 없으면 오류 로그 출력
            console.error('User ID가 제공되지 않았습니다.');
            return res.status(400).json({ error: 'User ID is required' });
        }

        // MongoDB에서 유저 정보 조회
        console.log("MongoDB에서 찾을 user_id:", user_id);
        const user = await User.findOne({user_id: user_id}).exec();
        console.log("MongoDB 조회 결과:", user);


        if (!user) {
            // 유저가 없으면 로그 출력 후 오류 반환
            console.error(`유저를 찾을 수 없음 : user_id=${user_id}`);
            return res.status(404).json({ error: 'User not found' });
        }

        // Bot 모델에서 모든 봇 데이터를 조회
        const bots: iBot[] = await Bot.find({}).exec();
        console.log("조회된 봇들:", bots);

        // 각 봇의 ID 배열을 생성
        const botIds = bots.map(bot => bot.bot_id);

        const botDataMap = new Map<string, any>();
        let totalBalance = 0;
        let totalProfit = 0;

        // 각 봇에 대한 데이터를 순회하며 처리
        for (let botId of botIds) {
            // 봇 정보 조회
            const bot: iBot | null = await Bot.findOne({ bot_id: botId }).exec();
            console.log(`조회된 봇: ${botId}`, bot);

            if (!bot) {
                // 봇이 없으면 오류 로그 출력
                console.error(`Bot not found: bot_id=${botId}`);
                return res.status(404).json({ success: false, message: 'Bot not found' });
            }

            // 봇의 최신 잔액 조회
            const latestBalance = await getBalance(bot.address);
            console.log(`봇 ${botId}의 최신 잔액:`, latestBalance);

            // 해당 유저가 스테이킹한 총 금액 조회
            const totalStakedAmount = await getTotalStakedAmount(botId, user_id);
            console.log(`봇 ${botId}의 총 스테이킹 금액:`, totalStakedAmount);

            // 총 수익 및 일일 수익 계산
            if (bot && latestBalance && totalStakedAmount) {
                const totalProfitPerBot = await getProfitPerBot(botId, user_id);
                const dailyProfitPerBot = await getProfitPerBot(botId, undefined, true);
                console.log(`봇 ${botId}의 총 수익:`, totalProfitPerBot);
                console.log(`봇 ${botId}의 일일 수익:`, dailyProfitPerBot);

                totalProfit += totalProfitPerBot * totalStakedAmount;
                totalBalance += totalStakedAmount;

                // token 조건이 맞는 경우 봇 데이터를 저장
                if (!token || (token && bot.chain === token)) {
                    botDataMap.set(botId, {
                        bot_id: bot.bot_id,
                        bot_address: bot.address,
                        bot_name: bot.name,
                        total_investment: totalStakedAmount,
                        current_value: totalStakedAmount * (1 + totalProfitPerBot),
                        daily_pnl: dailyProfitPerBot * totalStakedAmount,
                        total_profit: totalProfitPerBot * totalStakedAmount
                    });
                }
            }
        }

        // Map에 저장된 봇 데이터를 배열로 변환
        const botsData = Array.from(botDataMap.values());

        // 대시보드 데이터 생성
        const dashboardData = {
            total_balance: totalBalance,
            total_profit: totalProfit,
            total_balance_usdt: totalBalance * NTRNUSDT,
            total_profit_usdt: totalProfit * NTRNUSDT,
            bots: botsData
        };

        // 대시보드 데이터 로그 출력
        console.log("생성된 대시보드 데이터:", dashboardData);

        // 클라이언트에 응답
        res.json(dashboardData);

    } catch (error) {
        // 오류가 발생한 경우 로그 출력 후 오류 메시지 반환
        console.error("서버 내부 오류 발생:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
