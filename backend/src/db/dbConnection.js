const mockDbConnection = (db_url) =>{
    return new Promise((response, reject)=>{
        setTimeout(()=>{
            if(db_url === "demo_db_url") return response(true)
            reject("db_url does not exist !")
        },2000)
    })
}

export {mockDbConnection}