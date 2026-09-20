const registerHandler = async (req, res) =>{
    const {email, fullname, username, password} = req.body

    if(!email || !password || !username || !fullname) {
        return res.status(300).json({message:"All fields are required"})
    }

    return res.status(200).json({email, password, username, fullname})
}

export {registerHandler}