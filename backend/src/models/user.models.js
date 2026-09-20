import mongoose, {model} from 'mongoose'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const userSchema = new mongoose.Schema(
    {
        username:{
            type:String,
            required: true,
            unique:true,
            trim:true
        },
        email:{
            type:String,
            required: true,
            unique:true,
            trim:true
        },
        fullname:{
            type:String,
            required:true,
            trim:true
        },
        password:{
            type:String,
            required:[true, "Password is required"]
        },
        refreshToken:{
            type: String
        }

    },{ timestamps: true }
)
//Middleware to hash password just before save to db
userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next()
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

//Instance methods
userSchema.methods.isPasswordCorrect = async function(password){
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
        process.env.ACCESS_TOKEN_SECRETE,
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
        process.env.REFRESH_TOKEN_SECRETE,
        {
            expiresIn:REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = model("User", userSchema)
