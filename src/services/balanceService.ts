import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { coins } from "@cosmjs/launchpad";
import {assertIsDeliverTxSuccess, SigningStargateClient} from "@cosmjs/stargate";
import dotenv from "dotenv";
import { Bot, iBot } from "../models/botModel";
import { Balance, iBalance } from "../models/balanceModel";
import {getTotalStakedAmount} from "./botService";
import {BasicSymbolParam, USDMClient} from "binance"
import { ethers } from "ethers";

dotenv.config();
const rpcEndpoint = process.env.RPC_ENDPOINT || "";
const mnemonic = process.env.MNEMONIC || "";
// Private key of the Kaiya wallet
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

export async function sendTokens(amount: number, user_id: string) {
    try {
        // 1. Provider 생성
        const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);

        // 2. Wallet 객체 생성
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        // 3. 송신 트랜잭션 생성
        const tx = {
            to: user_id,
            value: ethers.utils.parseEther(String(amount)), // Amount to send (in ETH)
            gasLimit: 21000, // Basic gas limit
            gasPrice: await provider.getGasPrice(), // Current gas price of the network
        };

        console.log("Preparing transaction:", tx);

        // 4. Sign and send transaction
        const transaction = await wallet.sendTransaction(tx);
        console.log("Transaction sent successfully. Transaction hash:", transaction.hash);

        // 5. Confirm transaction mining
        const receipt = await transaction.wait();
        console.log("Transaction successful. Block number:", receipt.blockNumber);

        return receipt;
    } catch (error) {
        console.error("Transaction failed:", error);
        throw error;
    }
}

// Previous sendTokens code
// export async function sendTokens(senderAddress: string, recipientAddress: string, amountToSend: number) {
//     let client;
//     try {
//         const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
//             prefix: "neutron",
//         });
//
//         client = await SigningStargateClient.connectWithSigner(
//             rpcEndpoint,
//             wallet
//         );
//         const adjustedAmount = amountToSend * 10 ** 6;
//
//         const amount = coins(adjustedAmount.toString(), "untrn");
//
//         const fee = {
//             amount: coins(887, "untrn"), // 수수료
//             gas: "139400", // 가스 비용
//         };
//
//         const result = await client.sendTokens(senderAddress, recipientAddress, amount, fee);
//
//         assertIsDeliverTxSuccess(result);
//         console.log("Transaction successful:", result.transactionHash);
//
//     } catch (error) {
//         console.error("Failed to send transaction:", error);
//     } finally {
//         if (client) {
//             client.disconnect();
//         }
//     }
// }

export async function getBalance(address: string):Promise<number>{
    const client = await SigningStargateClient.connect(rpcEndpoint);

    const balance = await client.getBalance(address, "untrn");

    if(!balance){
        throw new Error(`Failed to get balance for address ${address}`);
    }
    client.disconnect();

    return Number(balance.amount) / 10 ** 6;
}

export async function saveBotBalance(){
    try {

        const bots: iBot[] = await Bot.find().exec();

        for (const bot of bots){

            const latestBalance = await getBalance(bot.address);
            const stakeAmount = await getTotalStakedAmount(bot.bot_id)

            const balance: iBalance = new Balance({
                bot_id: bot.bot_id,
                timestamp: new Date(),
                balance: latestBalance,
                balanceRate: latestBalance / stakeAmount,
            });

            await balance.save();
        }
    } catch (error) {
        console.error(`Failed to save balance:`, error);
    }
}

export async function getPrice(symbol: string): Promise<any> {
    const client = new USDMClient({});

    try {
        const data : BasicSymbolParam = {
            symbol: symbol
        }
        const response = await client.getMarkPrice(data);
        return response.markPrice
    } catch (error) {
        console.error('선물 가격을 가져오는 중 오류 발생:', error);
        throw error;
    }
}

async function displayDomesticRate() {
    const domesticRate = await getPrice('BTCUSDT');
    console.log(1 / domesticRate);
}
