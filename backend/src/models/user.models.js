import 'dotenv/config'
import mongoose, {model} from 'mongoose'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const otpSchema = new mongoose.Schema(
    {
        hash:String,
        expiresAt:Date,
        attempts:{ type:Number, default:0 },
        sentAt:Date
    },{ _id:false }
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
        fullname:{
            type:String,
            required:true,
            trim:true
        },
        password:{
            type:String,
            required:[function(){ return !this.googleId }, "Password is required"]
        },
        googleId:{
            type:String,
            unique:true,
            sparse:true
        },
        // Accounts created before email verification existed count as verified (default true);
        // the register flow explicitly creates new password accounts as false.
        emailVerified:{
            type:Boolean,
            default:true
        },
        emailOtp:{
            type:otpSchema,
            select:false
        },
        refreshToken:{
            type: String
        }

    },{ timestamps: true }
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
