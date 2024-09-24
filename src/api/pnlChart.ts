import express from 'express';
import {Bot, iBot} from "../models/botModel";
import {getProfitPerBot} from "../services/botService";

const router = express.Router();

interface QueryParams {
    bot_id?: string;
    timeframe?: string;
}

interface BotDetailInformation {
    apy: number;
    winRate: number;
    mdd: number;
}

router.get('/yucca/PnLChart', async (req, res) => {
    const { bot_id, timeframe }: QueryParams = req.query;

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
            mdd: 11
        };

        const dailyPNL: number = await getProfitPerBot(bot.bot_id, undefined, true);

        const pnlData = await Promise.all(
            Array.from({ length: timeframeNumber }, (_, index) => {
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - index);
                
                return getProfitPerBot(bot.bot_id, undefined, false, endDate);
            })
        );

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

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

export default router;