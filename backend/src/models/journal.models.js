import mongoose, { model } from "mongoose";

const journalSchema = new mongoose.Schema(
    {
        journalName:{
            type: String,
            required:true,
            trim:true
        },
        owner:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        },
        trades:{
            types:mongoose.Schema.types.ObjectId,
            ref:"Trades"
        }
    },{timestamps:true}
)

export const Journal = model("Journal", journalSchema)