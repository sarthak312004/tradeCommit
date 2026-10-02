import 'dotenv/config'
import { app } from './app.js'
import { dbConnection } from './db/dbConnection.js'

dbConnection()
.then((res)=>{
    app.listen(process.env.PORT, ()=>{
        console.log(`server is listening to port ${process.env.PORT}`);  
    })
})
.catch((error)=>{
    console.log("DB Connection failed !",error);
})

