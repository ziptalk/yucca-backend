import express from 'express';
import {getTotalInvestAmount} from "../services/botService";
// Express와 필요한 서비스 모듈을 import. getTotalInvestAmount 함수는 모든 봇의 총 투자 금액을 가져오는 함수.

const router = express.Router();
// Express 라우터 객체를 생성하여 API 요청을 처리할 준비를 함.

router.get('/yucca/onboarding', async (req, res) => {
// GET 요청을 '/yucca/onboarding' 경로로 처리하는 API를 정의. 전체 투자 금액(TVL: Total Value Locked)을 반환.

    try {
        const totalInvestAmount = await getTotalInvestAmount();
        // 비동기 함수로 getTotalInvestAmount를 호출하여 모든 봇의 총 투자 금액을 가져옴.

        res.json({ total_value_locked: totalInvestAmount });
        // 성공적으로 데이터를 가져오면, 'total_value_locked'라는 키로 JSON 형식으로 응답을 보냄.
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
        // 에러가 발생하면 500 상태 코드와 함께 'Server Error' 메시지를 반환.
    }
});

export default router;
// 모듈을 익스포트하여 다른 파일에서 사용할 수 있도록 함.
