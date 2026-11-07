import 'dotenv/config'
import mongoose, {model} from 'mongoose'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { HEADER_BACKDROP_MODES } from '../constants/headerBackdrop.js'

const otpSchema = new mongoose.Schema(
    {
        hash:String,
        expiresAt:Date,
        attempts:{ type:Number, default:0 },
        sentAt:Date
    },{ _id:false }
)

// Password change by an already logged-in user: code -> proof token -> new password.
const passwordResetSchema = new mongoose.Schema(
    {
        hash:String,            // HMAC of the emailed code (cleared once accepted)
        expiresAt:Date,         // when the code stops working
        attempts:{ type:Number, default:0 },
        sentAt:Date,
        verifiedAt:Date,        // set when the right code was entered
        tokenHash:String,       // sha256 of the one-time token handed to the browser at that moment
        tokenExpiresAt:Date
    },{ _id:false }
)

const onboardingGuideSchema = new mongoose.Schema(
    {
        guideStatus:{
            type:String,
            enum:["pending","in_progress","completed","skipped"],
            required:true
        },
        step:{
            type:String,
            enum:["planner","create-journal","journal-context","journal-execution","ai-mentor"],
            default:"planner"
        },
        actions:{
            type:[String],
            enum:["journal_created","journal_context_saved","plan_created","planner_connected","trade_logged","mentor_review_created"],
            default:[]
        },
        workflowCompletedAt:{
            type:Date,
            default:null
        },
        updatedAt:{
            type:Date,
            default:Date.now
        }
    },
    { _id:false }
)

const plannerWalkthroughSchema = new mongoose.Schema(
    {
        status:{
            type:String,
            enum:["pending","in_progress","completed","skipped"],
            required:true
        },
        step:{
            type:String,
            enum:["connection","open-plan","deep-mode","quick-plan","full-editor"],
            default:"connection"
        },
        planner:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Planner",
            required:true
        },
        updatedAt:{
            type:Date,
            default:Date.now
        }
    },
    { _id:false }
)

const demoFlywheelSchema = new mongoose.Schema(
    {
        status:{
            type:String,
            enum:["pending","active","completed","skipped"],
            required:true
        },
        step:{
            type:String,
            enum:["journal","context","planner","ai-mentor","next-plan","finish"],
            default:"journal"
        },
        updatedAt:{
            type:Date,
            default:Date.now
        }
    },
    { _id:false }
)

const userSchema = new mongoose.Schema(
    {
        username:{
            type:String,
            required: true,
            unique:true,
            trim:true,
            lowercase:true
        },
        email:{
            type:String,
            required: true,
            unique:true,
            trim:true,
            lowercase:true
        },
        // Optional: email-code sign-ups start with no name; the user can add it in the Profile section.
        fullname:{
            type:String,
            trim:true,
            default:""
        },
        // Optional: email-code (passwordless) accounts have none until the user sets one in the Profile section.
        password:{
            type:String
        },
        googleId:{
            type:String,
            unique:true,
            sparse:true
        },
        // Accounts created before email verification existed count as verified (default true);
        // new accounts are only created after the emailed code was accepted, so they are always true.
        emailVerified:{
            type:Boolean,
            default:true
        },
        emailOtp:{
            type:otpSchema,
            select:false
        },
        passwordReset:{
            type:passwordResetSchema,
            select:false
        },
        // One-time email code used to log in without a password (see loginOtp.controller.js)
        loginOtp:{
            type:otpSchema,
            select:false
        },
        // sessions issued before this moment are rejected (see verifyJWT), so a password change logs out other devices
        // Existing accounts are considered onboarded; new email sign-ups explicitly set this false.
        onboardingCompleted:{
            type:Boolean,
            default:true
        },
        onboardingTradingStyle:{
            type:String,
            enum:["intraday","swing","position","hybrid"],
            default:null
        },
        // Created only when a new user completes onboarding; existing accounts remain unqueued.
        onboardingGuide:{
            type:onboardingGuideSchema,
            default:null
        },
        // Created atomically only for a user's first Planner; independent of the main guide.
        plannerWalkthrough:{
            type:plannerWalkthroughSchema,
            default:null
        },
        // Created only when a new user completes onboarding; existing accounts remain unqueued.
        demoFlywheel:{
            type:demoFlywheelSchema,
            default:null
        },
        passwordChangedAt:{
            type:Date
        },
        // true once the automatic "how are we doing?" popup was answered or dismissed, so it only ever shows once
        feedbackPromptHandled:{
            type:Boolean,
            default:false
        },
        // Picture behind the page header: nothing, one of the built-in SVG scenes, or the user's own image
        // (a Cloudinary URL, see profile.controller.js). Only the fields of the active mode are filled.
        headerBackdrop:{
            mode:{ type:String, enum:HEADER_BACKDROP_MODES, default:"none" },
            scene:{ type:String, default:null },
            imageUrl:{ type:String, default:null }
        },
        focusPreferences:{
            spotifyUrl:{ type:String, default:"" },
            musicProvider:{ type:String, enum:["","spotify","youtube"], default:"" },
            youtubeUrl:{ type:String, default:"" },
            focusTheme:{ type:String, enum:["sage","ocean","amber"], default:"sage" }
        },
        refreshToken:{
            type: String
        },

        // ---- Plan / billing state. Defaults mean "free"; see utils/entitlements.js for how it is read. ----
        // Only server code (payment webhooks) may write these; no client-facing endpoint accepts them.
        planStatus:{
            type:String,
            enum:["none","active","cancelling","past_due","expired"],
            default:"none"
        },
        // Pro access runs until this moment (+ grace days); webhooks move it, nothing else grants Pro
        planAccessUntil:{
            type:Date,
            default:null
        },
        planInterval:{
            type:String,
            enum:["monthly","yearly"],
            default:null
        },
        // Payment-provider ids: never selected by default and never serialized (see toJSON below)
        billingCustomerId:{
            type:String,
            default:null,
            select:false
        },
        billingSubscriptionId:{
            type:String,
            default:null,
            select:false
        },
        cancelAtPeriodEnd:{
            type:Boolean,
            default:false
        },
        // Pro granted outside billing (e.g. early users) until this moment
        legacyProUntil:{
            type:Date,
            default:null
        },
        // When the newest billing webhook we applied happened: an older, late-arriving event never overwrites a newer one
        billingLastEventAt:{
            type:Date,
            default:null,
            select:false
        },
        // Per-user entitlement overrides, merged on top of the plan (never serialized, never client-writable)
        entitlementOverrides:{
            type:mongoose.Schema.Types.Mixed,
            default:() => ({})
        }

    },{
        timestamps: true,
        toJSON:{
            // Anything that sends a user document to a client (e.g. the login response) leaves these out
            transform(doc, ret){
                delete ret.billingCustomerId
                delete ret.billingSubscriptionId
                delete ret.billingLastEventAt
                delete ret.entitlementOverrides
                return ret
            }
        }
    }
)
//Middleware to hash password just before save to db
userSchema.pre("save", async function () {
    if(!this.password || !this.isModified("password")) return ;
    this.password = await bcrypt.hash(this.password, 10)
})

//Instance methods
userSchema.methods.isPasswordCorrect = async function(password){
    if(!this.password) return false
    const isPasswordValid = await bcrypt.compare(password, this.password)
    return isPasswordValid
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id:this._id,
            email:this.email,
            username:this.username
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id:this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = model("User", userSchema)
