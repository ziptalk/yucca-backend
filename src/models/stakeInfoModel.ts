import mongoose, { Schema, Document } from 'mongoose';

export interface iStakeInfo extends Document{
    status: number;
    unstakedAt: Date;
    unstakedAmount: number;
    bot_id: string;
    user_id: string;
    timestamp: Date;
    amount: number;
}

const StakeInfoSchema = new Schema<iStakeInfo>({
    bot_id: String,
    user_id: String,
    timestamp: Date,
    amount: Number,
    status: Number,
    unstakedAt: Date,
    unstakingAmount: Number,
});

export const StakeInfo = mongoose.model<iStakeInfo>('StakeInfo', StakeInfoSchema);