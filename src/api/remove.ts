import express from 'express';
import {iUser, User} from '../models/userModel';
import {Bot, iBot} from '../models/botModel';
import {iStakeInfo, StakeInfo} from '../models/stakeInfoModel';
import {sendTokens} from "../services/balanceService";
import {validateUnstakableDate} from "../services/stakingService";
// 필요한 모델과 서비스들을 import함. 유저(User), 봇(Bot), 스테이크 정보(StakeInfo) 및 관련 서비스.

const router = express.Router();
// Express 라우터 객체 생성.

router.post('/yucca/remove', async (req, res) => {
// POST 요청을 '/yucca/remove' 경로에서 처리하는 라우트 정의.
    const { user_id, bot_id } = req.body;
    // 클라이언트로부터 요청된 body에서 user_id와 bot_id를 추출.

    try {
        const bot: iBot | null = await Bot.findOne({ bot_id: bot_id }).exec();
        // bot_id로 봇을 찾음. 없다면 에러 반환.
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
            // 봇을 찾지 못하면 404 상태 코드와 에러 메시지를 반환.
        }
        let user = await User.findOne({ user_id: user_id }).exec();
        // user_id로 유저를 찾음. 없다면 에러 반환.
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
            // 유저를 찾지 못하면 404 상태 코드와 에러 메시지를 반환.
        }

        const stakeInfos: iStakeInfo[] = await StakeInfo.find({
            bot_id: bot_id,
            user_id: user_id
        }).sort({ timestamp: -1 }).exec();
        // 해당 봇과 유저의 스테이크 정보(stakeInfo)를 시간순으로 정렬하여 가져옴.

        if (stakeInfos.length === 0) {
            return res.status(404).json({ success: false, message: 'No stakes found for this user and bot' });
            // 스테이크 정보가 없으면 404 상태 코드와 메시지 반환.
        }

        validateUnstakableDate(stakeInfos[0]);
        // 첫 번째 스테이크의 unstake 가능한 날짜를 검증. 검증에 실패하면 에러 반환.

        await StakeInfo.deleteMany({
            bot_id: bot_id,
            user_id: user_id
        }).exec();
        // 해당 봇과 유저의 모든 스테이크 정보를 삭제.

        const totalAmount = stakeInfos.reduce((sum, stakeInfo) => sum + stakeInfo.amount, 0);
        // 모든 스테이크의 금액을 더해 totalAmount를 계산.
        await subtractUserStakeAmount(user, totalAmount);
        // 유저의 스테이크 금액을 차감하는 비동기 함수 호출.
        // await subtractBotBalance(bot_id, totalAmount);
        await sendTokens("neutron1exd2u2rqse7tp3teq5kv0d7nuu8acyr0527fqx", user_id, totalAmount);
        // 유저에게 토큰 전송.

        await updateBotInfo(bot, totalAmount);
        // 봇 정보를 업데이트. 구독자 수와 투자 금액을 차감.

        return res.json({ success: true, balance: user.stakeAmount });
        // 작업 완료 후 성공 메시지와 유저의 남은 스테이크 금액을 반환.
    } catch (error: any) {
        console.error('An error occurred:', error.message);
        console.error('Stack trace:', error.stack);
        return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
        // 에러가 발생하면 에러 메시지와 스택 추적을 콘솔에 출력하고, 500 상태 코드와 함께 에러를 반환.
    }
});

const subtractUserStakeAmount = async (user: iUser, amount: number) => {
// 유저의 스테이크 금액을 차감하는 비동기 함수.
    user.stakeAmount = Math.max(0, user.stakeAmount - amount);
    // 유저의 스테이크 금액에서 차감, 음수가 되지 않도록 보장.
    await user.save();
    // 유저 정보 저장.
}

const updateBotInfo = async (bot: iBot, amount: number) => {
// 봇의 구독자 수와 투자 금액을 업데이트하는 비동기 함수.
    bot.subscriber = Math.max(0, bot.subscriber - 1);
    // 봇의 구독자 수를 1 감소, 음수가 되지 않도록 보장.
    bot.investAmount = Math.max(0, bot.investAmount - amount);
    // 봇의 투자 금액에서 해당 금액 차감, 음수가 되지 않도록 보장.
    await bot.save();
    // 봇 정보 저장.
}

export default router;
// 모듈을 익스포트하여 다른 파일에서 사용할 수 있도록 함.
