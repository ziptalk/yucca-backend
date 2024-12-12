import express from 'express';
import {iStakeInfo, StakeInfo} from '../models/stakeInfoModel';
import {User} from '../models/userModel';
import {Bot, iBot} from '../models/botModel';

// 필요한 모듈과 데이터 모델을 import.

const router = express.Router();
// Express 라우터 객체를 생성하여 API 요청을 처리할 준비를 함.

router.post('/yucca/deposit', async (req, res) => {
// POST 요청을 '/yucca/deposit' 경로로 처리하는 API를 정의. 유저가 특정 봇에 금액을 입금하는 로직을 처리.

    const { user_id, bot_id, amount } = req.body;
    // 요청의 body에서 user_id, bot_id, amount를 추출.

    try {
        if (amount < 10) {
            return res.status(400).json({ success: false, message: 'Amount must be at least 10' });
        }
        // 입금 금액이 10 미만일 경우, 오류 메시지를 반환.

        const bot: iBot | null = await Bot.findOne({ bot_id: bot_id }).exec();
        if (!bot) {
            return res.status(404).json({ success: false, message: 'Bot not found' });
        }
        // bot_id로 해당 봇을 찾고, 봇이 존재하지 않으면 404 오류를 반환.

        bot.subscriber += 1;
        bot.investAmount += amount;
        await bot.save();
        // 해당 봇의 구독자 수를 1 증가시키고, 투자 금액을 추가한 뒤 저장.

        const user = await User.findOneAndUpdate(
            { user_id: user_id },
            { $inc: { stakeAmount: amount } },
            { new: true, upsert: true }
        );
        // 유저의 스테이킹 금액을 업데이트하고, 유저가 없으면 새로운 유저를 생성(upsert).

        const newStakeInfo: iStakeInfo = new StakeInfo({
            user_id,
            bot_id,
            timestamp: new Date(),
            amount,
            status: 0,
        });
        // 새로운 스테이킹 정보를 생성. 이 정보는 유저 ID, 봇 ID, 스테이킹 시간, 스테이킹 금액을 포함.

        await newStakeInfo.save();
        // 생성된 스테이킹 정보를 데이터베이스에 저장.

        res.json({ success: true, balance: user.stakeAmount });
        // 성공적으로 처리된 경우 유저의 현재 스테이킹 잔액을 반환.

    } catch (error: any) {
        console.error('An error occurred:', error.message);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
        // 에러가 발생하면 500 상태 코드와 함께 서버 오류 메시지를 반환.
    }
});

export default router;
// 모듈을 익스포트하여 다른 파일에서 사용할 수 있도록 함.
