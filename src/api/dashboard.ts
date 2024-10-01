import express from 'express';
import {User} from '../models/userModel';
import {Bot, iBot} from '../models/botModel';
import {getProfitPerBot, getTotalStakedAmount} from "../services/botService";
import {getBalance} from '../services/balanceService';

// Express 모듈과 MongoDB 모델, 그리고 서비스 함수를 import합니다.

const router = express.Router();
// Express 라우터 객체를 생성하여 API 라우트를 처리할 준비를 합니다.

interface QueryParams {
    user_id?: string;
    token?: string;
}
// 쿼리 매개변수 타입 정의. user_id와 token이 있을 수 있음.

const NTRNUSDT = 0.35;// NTRN 토큰의 USDT 환산율을 상수로 정의.
const domesticRage = 10.3; // 예시에서 요구한 USD/token 값을 상수로 정의.


router.get('/yucca/dashboard', async (req, res) => {
    try {
        const { user_id, token }: QueryParams = req.query;
        // 요청 쿼리에서 user_id와 token 값을 추출.

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        // user_id가 없으면 400 상태 코드와 함께 오류 메시지 반환.

        const user = await User.findOne({ user_id: user_id });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // MongoDB에서 user_id를 사용해 유저 정보를 조회하고, 유저가 없으면 404 오류 반환.

        const bots: iBot[] = await Bot.find({}).exec();
        const botIds = bots.map(bot => bot.bot_id);
        // Bot 모델에서 모든 봇 데이터를 조회하고, 각 봇의 bot_id를 추출해 배열로 만듦.

        const botDataMap = new Map<string, any>();
        // 봇 데이터를 저장할 맵(Map) 객체를 생성.

        let totalBalance = 0;
        let totalProfit = 0;
        // 총 밸런스와 총 수익을 계산하기 위한 변수를 초기화.

        for (let botId of botIds) {
            const bot: iBot | null = await Bot.findOne({ bot_id: botId }).exec();
            if (!bot) {
                return res.status(404).json({ success: false, message: 'Bot not found' });
            }
            // bot_id로 봇을 조회하고, 해당 봇이 없으면 404 오류 반환.

            const latestBalance = await getBalance(bot.address);
            const totalStakedAmount = await getTotalStakedAmount(botId, user_id);
            // 각 봇의 최신 밸런스와 특정 유저가 스테이킹한 총 금액을 가져옴.

            if (bot && latestBalance && totalStakedAmount) {
                const totalProfitPerBot = await getProfitPerBot(botId, user_id);
                const dailyProfitPerBot = await getProfitPerBot(botId, undefined, true);
                // 봇별로 총 수익과 일일 수익을 가져옴.

                totalProfit += totalProfitPerBot * totalStakedAmount;
                totalBalance += totalStakedAmount;
                // 각 봇의 수익과 스테이킹 금액을 총합에 더함.

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
        // Map 객체에 저장된 봇 데이터를 배열로 변환.

        const dashboardData = {
            total_balance: totalBalance,
            total_profit: totalProfit,
            total_balance_usdt: totalBalance * NTRNUSDT,
            total_profit_usdt: totalProfit * NTRNUSDT,
            domesticRage: domesticRage, // 응답에 domesticRage 추가
            bots: botsData,
        };
        // 총 밸런스, 총 수익, 이를 USDT로 환산한 값, 그리고 봇 정보를 포함한 대시보드 데이터를 생성.

        console.log(dashboardData);
        // 대시보드 데이터를 콘솔에 출력.

        res.json(dashboardData);
        // 생성된 대시보드 데이터를 JSON 형태로 클라이언트에 응답.

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
        // 에러가 발생하면 500 상태 코드와 함께 오류 메시지를 반환.
    }
});

export default router;
// 라우터 모듈을 익스포트.