import mongoose, {Document, Schema} from 'mongoose';

export interface iUser extends Document {
    user_id: string;
    stakeAmount: number;
}

const UserSchema = new Schema<iUser>({
    user_id: String,
    stakeAmount: Number,
},{collection : 'user'});

export const User = mongoose.model<iUser>('user', UserSchema);