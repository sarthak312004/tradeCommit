import 'dotenv/config'
import mongoose from 'mongoose'
const db_name = "TradeCommitDB"

const dbConnection = async () => {
        const connectionInstance = await mongoose.connect(
                                    process.env.MONGODB_CONNECTION_URL, 
                                    {dbName:db_name})
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
}

export {dbConnection}