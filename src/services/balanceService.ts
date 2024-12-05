
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
        const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        const tx = {
            to: user_id,
            value: ethers.utils.parseEther(String(amount)), // Amount to send (in ETH)
            gasLimit: 21000, // Basic gas limit
            gasPrice: await provider.getGasPrice(), // Current gas price of the network
        };

        const transaction = await wallet.sendTransaction(tx);
        const receipt = await transaction.wait();

        return receipt;
    } catch (error) {
        console.error("Transaction failed:", error);
        throw error;
    }
}

export async function getBalance(address: string): Promise<number> {
    try {
        const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint, {
            name: "kaia",
            chainId: 8217,
        });

        // wei
        const balanceInWei = await provider.getBalance(address);

        // wei to KAIA
        const balanceInKaia = parseFloat(ethers.utils.formatEther(balanceInWei));

        return balanceInKaia;
    } catch (error) {
        console.error(`Failed to fetch balance for address ${address}:`, error);
        throw error;
    }
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
