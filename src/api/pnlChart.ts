import express from 'express';
import {Bot, iBot} from "../models/botModel";
import {getProfitPerBot} from "../services/botService";
// Express와 필요한 모델 및 서비스 모듈을 import. Bot 모델과 getProfitPerBot 함수는 봇의 수익률을 계산하는 데 사용됨.

const router = express.Router();
// Express 라우터 객체를 생성하여 API 요청을 처리할 준비를 함.

interface QueryParams {
    bot_id?: string;
    timeframe?: string;
}
// QueryParams 인터페이스 정의: bot_id와 timeframe을 쿼리 파라미터로 받을 수 있음.

interface BotDetailInformation {
    apy: number;
    winRate: number;
    mdd: number;
}
// BotDetailInformation 인터페이스 정의: 봇의 APY, 승률(winRate), MDD를 포함한 세부 정보.

router.get('/yucca/PnLChart', async (req, res) => {
// GET 요청을 '/yucca/PnLChart' 경로로 처리하는 API 정의. 손익 차트 데이터를 반환함.
    const { bot_id, timeframe }: QueryParams = req.query;

    if (!bot_id || !timeframe) {
        return res.status(400).json({ error: 'bot_id and timeframe are required' });
        // bot_id와 timeframe 쿼리 파라미터가 없으면 400 상태 코드와 에러 메시지 반환.
    }

    try {
        const bot: iBot | null = await Bot.findOne({ bot_id }).exec();
        // 주어진 bot_id로 봇을 데이터베이스에서 찾음. 없으면 에러를 반환.
        if (!bot) {
            return res.status(404).json({ error: 'Bot not found' });
            // 봇이 없을 경우 404 상태 코드와 에러 메시지 반환.
        }

        const timeframeNumber = parseInt(timeframe as string, 10);
        // timeframe 쿼리 파라미터를 숫자로 변환.

        const botDetailInformation: BotDetailInformation = {
            apy: 15.5,
            winRate: 70,
            mdd: 11
        };
        // 봇의 세부 정보를 하드코딩된 값으로 정의(APY, 승률, MDD).

        const dailyPNL: number = await getProfitPerBot(bot.bot_id, undefined, true);
        // 봇의 하루 손익률(daily PnL)을 계산하기 위해 getProfitPerBot 호출.

        const pnlData = await Promise.all(
            Array.from({ length: timeframeNumber }, (_, index) => {
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - index);
                // 날짜를 index만큼 줄여서 timeframe에 따른 일별 손익 데이터를 생성.
                return getProfitPerBot(bot.bot_id, undefined, false, endDate);
            })
        );
        // 손익 데이터를 비동기적으로 모두 처리(Promise.all)하여 배열에 저장.

        const response = {
            bot_id: bot.bot_id,
            bot_name: bot.name,
            timeframe: timeframeNumber,
            daily_PnL: dailyPNL.toFixed(2),
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
