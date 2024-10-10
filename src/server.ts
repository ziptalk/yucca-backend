import app from './app';
import fs from "fs";
import https from "https";
import {scheduleJob} from 'node-schedule';
import {saveBotBalance} from './services/balanceService';

const HTTP_PORT = process.env.HTTP_PORT;
const HTTPS_PORT = process.env.HTTPS_PORT;

app.listen(HTTP_PORT, () => {
    console.log(`Server running on port ${HTTP_PORT}`);
    scheduleJob('0 * * * *', async function () {
        await saveBotBalance();
    });
});
