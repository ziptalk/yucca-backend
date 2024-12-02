// services/stakingService.ts
import { iStakeInfo, StakeInfo } from "../models/stakeInfoModel";
import { Bot, iBot } from "../models/botModel";
import { User, iUser } from "../models/userModel";
import { sendTokens } from "./balanceService";

// 스테이크가 언스테이킹 가능한지 여부를 반환하는 함수
export const isStakeUnstakable = (stakeInfo: iStakeInfo): boolean => {
    const stakeDate = new Date(stakeInfo.timestamp);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return stakeDate <= threeDaysAgo;
};

// 유효한 스테이크만 필터링하는 함수
export const filterEligibleStakes = (stakes: iStakeInfo[]): iStakeInfo[] => {
    return stakes.filter(isStakeUnstakable);
};

// 유효한 스테이크의 총 금액과 언스테이킹 금액을 계산하는 함수
export async function calculateEligibleUnstakingAmount(stakes: iStakeInfo[]): Promise<[number, number]> {
    const eligibleStakes = filterEligibleStakes(stakes);
    if (eligibleStakes.length === 0) {
        throw { status: 400, message: "No eligible stakes to unstake." };
    }

    const totalStakedAmount = eligibleStakes.reduce((sum, stake) => sum + stake.amount, 0);
    const totalUnstakeAmount = totalStakedAmount * 0.95; // 예: 5% 수수료 적용
    return [totalStakedAmount, totalUnstakeAmount];
}

// Validate unstakable date
// export const validateUnstakableDate = (lastStakeInfo: iStakeInfo): void => {
//     const lastStakeDate = new Date(lastStakeInfo.timestamp);
//     const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
//     if (lastStakeDate > threeDaysAgo) {
//         throw { status: 400, message: "Unstaking not allowed. Last stake was less than 3 days ago." };
//     }
// };

// new validation function
export const validateAllStakesUnstakable = (stakes: iStakeInfo[]): void => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    for (const stake of stakes) {
        const stakeDate = new Date(stake.timestamp);
        if (stakeDate > threeDaysAgo) {
            throw {
                status: 400,
                message: "Unstaking not allowed. No eligible stakes found (must be older than 3 days)."
            };
        }
    }
};

// Get bot and active stake information
export async function getBotAndActiveStakes(bot_id: string, user_id: string) {
    const bot: iBot | null = await Bot.findOne({ bot_id }).exec();
    if (!bot) {
        throw { status: 404, message: "Bot not found" };
    }

    const activeStakes: iStakeInfo[] = await StakeInfo.find({ bot_id, user_id }).sort({ timestamp: -1 }).exec();
    if (activeStakes.length === 0) {
        throw { status: 404, message: "No active stakes found" };
    }

    return { bot, activeStakes };
}

// Calculate unstaking amount
export async function calculateUnstakingAmount(user_id: string): Promise<[number, number]> {
    const stakes = await StakeInfo.find({ user_id }).exec();
    if (!stakes || stakes.length === 0) {
        throw { status: 404, message: "No stakes found" };
    }

    const totalStakedAmount = stakes.reduce((sum, stake) => sum + stake.amount, 0);
    const totalUnstakeAmount = totalStakedAmount * 0.95; // 예: 5% 수수료 적용
    return [totalStakedAmount, totalUnstakeAmount];
}

// 언스테이킹 처리 함수 (트랜잭션 제거)
export async function processUnstaking(
    totalStakedAmount: number,
    totalUnstakeAmount: number,
    eligibleStakes: iStakeInfo[],
    bot: iBot,
    user_id: string,
) {
    console.log(`Processing unstaking for user_id: ${user_id}`);

    try {
        // 1. 사용자 데이터 업데이트
        const user = await User.findOneAndUpdate(
            { user_id: user_id },
            { $inc: { stakeAmount: -totalStakedAmount } },
            { new: true }
        ).exec();

        if (!user) {
            throw { status: 404, message: "User not found" };
        }

        // stakeAmount이 음수가 되지 않도록
        if (user.stakeAmount < 0) {
            user.stakeAmount = 0;
            await user.save();
        }

        console.log(user);

        // 2. Bot 데이터 업데이트
        bot.investAmount = Math.max(0, bot.investAmount - totalStakedAmount);
        bot.subscriber = Math.max(0, bot.subscriber - 1); // 필요에 따라 조정
        await bot.save();

        // 3. 스테이크 데이터 삭제 (필터링된 것만)
        const stakeIdsToDelete = eligibleStakes.map(stake => stake._id);
        await StakeInfo.deleteMany({ _id: { $in: stakeIdsToDelete } }).exec();

        // 4. 사용자에게 토큰 전송
        if (!user_id) {
            throw { status: 400, message: "Receive address is not provided." };
        }

        await sendTokens(totalUnstakeAmount, user_id);

        console.log(`Unstaking process completed for user_id: ${user_id}`);
    } catch (error) {
        console.error(`Error during unstaking process for user_id: ${user_id}`, error);
        throw error;
    }
}
