import 'dotenv/config'
import mongoose from 'mongoose'
const db_name = "TradeCommitDB"

const dbConnection = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_CONNECTION_URL}/${db_name}`)
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log(error);
    }
}

export {dbConnection}