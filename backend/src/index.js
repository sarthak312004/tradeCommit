import 'dotenv/config'
import { app } from './app.js'
import { mockDbConnection } from './db/dbConnection.js'

mockDbConnection(process.env.MOCK_DB_URL)
.then((response)=>{
    app.listen(process.env.PORT, ()=>{
        console.log(`Server listining to ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log(err);
})
