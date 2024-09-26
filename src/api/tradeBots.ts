import express from 'express';
import {Bot, iBot} from '../models/botModel';
import {Balance, iBalance} from '../models/balanceModel';
import {getProfitPerBot} from "../services/botService";
// 봇(Bot), 밸런스(Balance), 봇 수익을 가져오는 서비스(getProfitPerBot) 등의 필요한 모듈과 서비스를 import.

const router = express.Router();
// Express 라우터 객체 생성.

const APY = 15.5;
// APY (Annual Percentage Yield)를 15.5로 고정하여 상수로 정의.

type SortKeys = 'bot_id' | 'name' | 'subscriber' | 'total_profits' | 'apy' | 'runtime' | 'tvl' | 'chain';
// 정렬에 사용할 수 있는 키의 타입 정의. 봇 ID, 이름, 구독자 수, 총 수익, APY, 실행 시간(runtime), 총 가치(TVL), 체인 등이 포함됨.

interface QueryParams {
    sort?: SortKeys;
    order?: string;
    search?: string;
}
// 쿼리 파라미터에 들어올 수 있는 sort, order, search 필드를 정의.

router.get('/yucca/trade-bots', async (req, res) => {
// GET 요청을 '/yucca/trade-bots' 경로에서 처리하는 라우트 정의.
    const { sort = 'total_profits', order = 'desc', search = '' }: QueryParams = req.query;
    // 쿼리 파라미터에서 sort, order, search를 추출하고 기본값을 설정.
    const sortOrder = order === 'asc' ? 1 : -1;
    // 오름차순이면 1, 내림차순이면 -1로 설정.

    try {
        const bots: iBot[] = await Bot.find({ name: { $regex: search, $options: 'i' } }).exec();
        // 봇 목록을 검색어(search)로 필터링한 후, 대소문자를 구분하지 않고(i 옵션) 데이터베이스에서 가져옴.

        const botsWithCalculatedData = await Promise.all(
            bots.map(async (bot) => {
                const firstBalance: iBalance | null = await Balance.findOne({ bot_id: bot.bot_id }).exec();
                // 봇의 첫 번째 밸런스 데이터를 가져옴. 없다면 에러 발생.
                if (!firstBalance) {
                    throw new Error(`No balance data found for bot ${bot.bot_id}`);
                    // 밸런스 데이터를 찾을 수 없으면 에러 발생.
                }

                const totalProfits = await getProfitPerBot(bot.bot_id);
                // 해당 봇의 총 수익을 가져옴.
                const runtime = Math.floor((Date.now() - bot.created_at.getTime()) / (1000 * 60 * 60 * 24));
                // 봇이 생성된 이후의 실행 시간을 일(day) 단위로 계산.
                console.log(totalProfits);

                return {
                    bot_id: bot.bot_id,
                    name: bot.name,
                    subscriber: bot.subscriber,
                    total_profits: totalProfits.toFixed(2),
                    // 수익을 소수점 2자리까지 표현.
                    apy: APY,
                    // APY는 상수로 정의된 15.5를 반환.
                    runtime: runtime,
                    // 봇의 실행 시간을 일 단위로 반환.
                    tvl: bot.investAmount,
                    // 총 가치(Total Value Locked).
                    chain: bot.chain,
                    // 체인 정보.
                };
            })
        );
        // 각 봇에 대한 데이터를 처리하고 수익, 구독자 수, 총 가치 등을 반환.

        const sortedBots = botsWithCalculatedData.sort((a, b) => {
            if (a[sort] < b[sort]) return -sortOrder;
            if (a[sort] > b[sort]) return sortOrder;
            return 0;
        });
        // 정렬 기준(sort)에 따라 봇 목록을 오름차순 또는 내림차순으로 정렬.

        res.json(sortedBots);
        // 정렬된 봇 목록을 JSON 형태로 클라이언트에게 반환.
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
        // 에러가 발생하면 500 상태 코드와 함께 서버 에러 메시지를 반환.
    }
});

export default router;
// 모듈을 익스포트하여 다른 파일에서 사용할 수 있도록 함.
