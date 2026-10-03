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

import { userRouter } from './routes/user.routes.js'
import { journalRouter } from './routes/journal.routes.js'
import { tradeRouter } from './routes/trade.routes.js'
import { plannerRouter } from './routes/planner.routes.js'

app.use("/api/v1/auth", userRouter)
app.use("/api/v1/journals", journalRouter)
app.use("/api/v1/journals/:journalId/trades", tradeRouter)
app.use("/api/v1/planners", plannerRouter)

app.use((error, req, res, next) => {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500
    if (statusCode >= 500) console.error(error)

    return res.status(statusCode).json({
        statusCode,
        success: false,
        message: error.message || "Internal server error",
        errors: error.errors ?? [],
    })
})

export {app}