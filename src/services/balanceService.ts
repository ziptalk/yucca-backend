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
        // 1. Create Provider
        const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);

        // 2. Create Wallet Object
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        // 3. Create Send Transaction
        const tx = {
            to: user_id,
            value: ethers.utils.parseEther(String(amount)), // Amount to send (in ETH)
            gasLimit: 21000, // Basic gas limit
            gasPrice: await provider.getGasPrice(), // Current gas price of the network
        };

        // 4. Sign and send transaction
        const transaction = await wallet.sendTransaction(tx);

        // 5. Confirm transaction mining
        const receipt = await transaction.wait();

        return receipt;
    } catch (error) {
        console.error("Transaction failed:", error);
        throw error;
    }
}

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
        console.error('Error occurred while fetching the futures price:', error);
        throw error;
    }
}

async function displayDomesticRate() {
    const domesticRate = await getPrice('BTCUSDT');
    console.log(1 / domesticRate);
}
