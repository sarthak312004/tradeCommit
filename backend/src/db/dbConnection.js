import 'dotenv/config'
import mongoose from 'mongoose'
import { PlanEntry } from '../models/planEntry.models.js'
const db_name = "TradeCommitDB"

const dbConnection = async () => {
        const connectionInstance = await mongoose.connect(
                                    process.env.MONGODB_CONNECTION_URL, 
                                    {dbName:db_name})
        await PlanEntry.createIndexes()
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
        console.log('Plan entry indexes are ready.')
}

export {dbConnection}