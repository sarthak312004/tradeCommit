import 'dotenv/config'
import mongoose from 'mongoose'
import { app } from './app.js'
import { dbConnection } from './db/dbConnection.js'

const requiredEnv = [
    'MONGODB_CONNECTION_URL',
    'ACCESS_TOKEN_SECRET',
    'ACCESS_TOKEN_EXPIRY',
    'REFRESH_TOKEN_SECRET',
    'REFRESH_TOKEN_EXPIRY',
]
const missingEnv = requiredEnv.filter((name) => !process.env[name])
if (missingEnv.length > 0) {
    console.error(`Missing required environment variables: ${missingEnv.join(', ')}`)
    process.exit(1)
}

if (process.env.NODE_ENV === 'production') {
    const weakSecrets = ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET']
        .filter((name) => process.env[name].length < 32)
    if (weakSecrets.length > 0) {
        console.error(`Production secrets must be at least 32 characters: ${weakSecrets.join(', ')}`)
        process.exit(1)
    }
}

const missingCloudinary = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .filter((name) => !process.env[name])
if (missingCloudinary.length > 0) {
    console.warn(`Cloudinary is not configured (${missingCloudinary.join(', ')}); image uploads will fail.`)
}

if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM_EMAIL) {
    console.warn(process.env.NODE_ENV === 'production'
        ? 'BREVO_API_KEY / MAIL_FROM_EMAIL are not set: sign-up and password-reset codes CANNOT be emailed.'
        : 'Brevo is not configured; email codes will be printed in this console instead.')
}

if (!process.env.GEMINI_API_KEY?.trim()) {
    console.warn('GEMINI_API_KEY is not set: AI mentor reviews will be unavailable.')
}

const port = Number(process.env.PORT) || 3000

try {
    await dbConnection()
    const server = app.listen(port, () => {
        console.log(`Server is listening on port ${port}`)
    })

    const shutdown = (signal) => {
        console.log(`${signal} received; shutting down`)
        server.close((error) => {
            if (error) {
                console.error('HTTP server shutdown failed', error)
                process.exit(1)
            }
            mongoose.connection.close()
                .then(() => process.exit(0))
                .catch((closeError) => {
                    console.error('MongoDB shutdown failed', closeError)
                    process.exit(1)
                })
        })
        setTimeout(() => process.exit(1), 10000).unref()
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
} catch (error) {
    console.error('Database connection failed', error)
    process.exit(1)
}
