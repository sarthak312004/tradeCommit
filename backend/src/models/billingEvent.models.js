import mongoose, { model } from 'mongoose'

// One row per payment-provider webhook we have handled. It makes retries harmless (an event id is processed once) and
// lets refund / dispute events, which may not carry our user id, be traced back through the payment they belong to.
// Only ids and the event type are stored: never the payload, never card or customer details.
const billingEventSchema = new mongoose.Schema(
    {
        eventId:{ type:String, required:true, unique:true },
        type:{ type:String, required:true },
        userId:{ type:mongoose.Schema.Types.ObjectId, ref:'User', default:null },
        paymentId:{ type:String, default:null, index:true },
        subscriptionId:{ type:String, default:null },
        state:{ type:String, enum:['processing','processed'], default:'processed' },
        claimToken:{ type:String, default:null },
        leaseUntil:{ type:Date, default:null },
        processedAt:{ type:Date, default:null },
        // Rows expire after 90 days: retries never come that late.
        createdAt:{ type:Date, default:Date.now, expires:60 * 60 * 24 * 90 }
    },
    { versionKey:false }
)

export const BillingEvent = model('BillingEvent', billingEventSchema)
