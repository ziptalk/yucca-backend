import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import onboarding from "./api/onboarding";
import tradeBots from "./api/tradeBots";
import PnlChart from "./api/pnlChart";
import deposit from "./api/deposit";
import dashboard from "./api/dashboard";
import remove from "./api/remove";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// 환경 변수에서 DB 연결 문자열을 가져옵니다.
const dbConnectionString = process.env.DB_SERVER;

// DB 연결 문자열이 없으면 서버를 종료합니다.
if (!dbConnectionString) {
    console.error('DB_SERVER 환경 변수가 설정되지 않았습니다.');
    process.exit(1); // 환경 변수가 없을 경우 서버 종료
}

// 기존의 데이터베이스 연결을 종료하고 새로운 연결을 설정합니다.
mongoose.disconnect().then(() => {
    console.log('Existing database connection closed');

    // 새로운 연결을 설정합니다.
    mongoose.connect(dbConnectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }).then(() => console.log('Database connected'))
        .catch((error) => console.error('Database connection error:', error));
}).catch((error) => console.error('Error disconnecting existing connection:', error));

// API 엔드포인트 설정
app.use(onboarding);
app.use(tradeBots);
app.use(PnlChart);
app.use(deposit);
app.use(remove);
app.use(dashboard);

export default app;
