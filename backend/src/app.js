import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import { rateLimit } from './middlewares/rateLimit.middleware.js'

const app = express()

app.disable('x-powered-by')
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
}

const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)

if (allowedOrigins.length > 0) {
    app.use(cors({
        origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
        credentials: true,
    }))
}

app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended: true, limit:"16kb"})) 
app.use(cookieParser())

app.get('/api/health', (req, res) => {
    const dbReady = mongoose.connection.readyState === 1
    res.status(dbReady ? 200 : 503).json({
        status: dbReady ? 'ok' : 'degraded',
        db: dbReady,
    })
})

import { userRouter } from './routes/user.routes.js'
import { journalRouter } from './routes/journal.routes.js'
import { tradeRouter } from './routes/trade.routes.js'
import { plannerRouter } from './routes/planner.routes.js'

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 })
app.use("/api/v1/auth/login", authLimiter)
app.use("/api/v1/auth/register", authLimiter)
app.use("/api/v1/auth/google", authLimiter)

// Signup code endpoints: per-email limits also apply; this caps raw volume per IP.
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 })
app.use("/api/v1/auth/signup", otpLimiter)

// Password change codes: per-user cooldown/attempt limits also apply; this caps raw volume per IP.
const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 })
app.use("/api/v1/auth/password", passwordLimiter)

app.use("/api/v1/auth", userRouter)
app.use("/api/v1/journals", journalRouter)
app.use("/api/v1/journals/:journalId/trades", tradeRouter)
app.use("/api/v1/planners", plannerRouter)

app.use("/api", (req, res) => {
    res.status(404).json({ statusCode: 404, success: false, message: "Route not found", errors: [] })
})

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '../../frontend/dist')
if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y' }))
    app.use(express.static(distDir, { index: false, maxAge: '1h' }))
    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        res.setHeader('Cache-Control', 'no-cache')
        res.sendFile(path.join(distDir, 'index.html'))
    })
}

app.use((error, req, res, next) => {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500
    if (statusCode >= 500) console.error(error)

    return res.status(statusCode).json({
        statusCode,
        success: false,
        message: statusCode >= 500 && process.env.NODE_ENV === 'production'
            ? "Internal server error"
            : (error.message || "Internal server error"),
        errors: error.errors ?? [],
    })
})

export {app}