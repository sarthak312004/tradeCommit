import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

const app = express()
app.use(cors({
    origin: process.env.CORS_ORIGIN
}))

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended: true, limit:"16kb"})) 
app.use(express.static("public")) 
app.use(cookieParser())

app.get('/api/user',(req, res, next)=>{
    const user = {
        name:"Sarthak Mahamuni",
        age:21,
        email:"sarthak@gmail.com"
    }
    res.json(user)
})

export {app}