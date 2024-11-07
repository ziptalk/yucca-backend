import express from 'express';
import {Bot, iBot} from "../models/botModel";
import {getProfitPerBot} from "../services/botService";
import {getPrice} from "../services/balanceService";
// Express와 필요한 모델 및 서비스 모듈을 import. Bot 모델과 getProfitPerBot 함수는 봇의 수익률을 계산하는 데 사용됨.

const router = express.Router();
// Express 라우터 객체를 생성하여 API 요청을 처리할 준비를 함.

interface QueryParams {
    bot_id?: string;
    timeframe?: string;
    user_id?: string
}
// QueryParams 인터페이스 정의: bot_id와 timeframe을 쿼리 파라미터로 받을 수 있음.

interface BotDetailInformation {
    apy: number;
    winRate: number;
    mdd: number;
    healthyFactor: number;
}
// BotDetailInformation 인터페이스 정의: 봇의 APY, 승률(winRate), MDD를 포함한 세부 정보.

router.get('/yucca/PnLChart', async (req, res) => {
    const { bot_id, timeframe, user_id }: QueryParams = req.query;

    if (!bot_id || !timeframe) {
        return res.status(400).json({ error: 'bot_id and timeframe are required' });
    }

    try {
        const bot: iBot | null = await Bot.findOne({ bot_id }).exec();
        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        const timeframeNumber = parseInt(timeframe as string, 10);

        const botDetailInformation: BotDetailInformation = {
            apy: 15.5,
            winRate: 70,
            mdd: 11,
            healthyFactor: 0.5
        };

        const dailyPNL: number = await getProfitPerBot(bot.bot_id, user_id, true);

        const pnlData = await Promise.all(
            Array.from({ length: timeframeNumber }, (_, index) => {
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - index);
                return getProfitPerBot(bot.bot_id, user_id, false, endDate);
            })
        );

        const domesticRate=await getPrice("BTCUSDT")

        const response = {
            bot_id: bot.bot_id,
            bot_name: bot.name,
            timeframe: timeframeNumber,
            daily_PnL: dailyPNL.toFixed(2),
            domesticRate: 1 / domesticRate,
            data: pnlData.map((pnlRate, index) => {
                const date = new Date();
                date.setDate(date.getDate() - index);
                return {
                    createdAt: date,
                    pnlRate: pnlRate
                };
            }).reverse(),
            detailInformation: botDetailInformation,
        };
        // 봇의 손익 데이터를 정리하고, 일별 손익 데이터를 배열에 저장 후 응답으로 반환.

        res.json(response);
        // JSON 형태로 결과를 응답.
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
        // 에러가 발생하면 500 상태 코드와 함께 서버 에러를 반환.
    }
});

export default router;
// 모듈을 익스포트하여 다른 파일에서 사용할 수 있도록 함.
