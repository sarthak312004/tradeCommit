import mongoose from "mongoose";

const tradeSchema = new mongoose.Schema(
    {
        assetName:{
            type:String,
            required:[true, "Asset name is required"],
            trim:true
        },
        date:{
            type:Date,
            required:true
        },
        segment:{
            type:String,
            trim:true
        },
        entryPrice:{
            type:Number,
            required:[true, "Entry price is required"]
        },
        exitPrice:{
            type:Number
        },
        analysis:{
            type: String
        },
        images:[
            {
                type:String
            }
        ],
        owner:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        },
        journal:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Journal"
        }

    },{timestamps:true}
)

export const Trade = model("Trade", tradeSchema) 