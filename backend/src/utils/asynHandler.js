const asyncHandler = (requestHandler) => {
    return async (req, res, next) => {
         try {
            await requestHandler(req, res, next)
         } catch (error) {
            console.log("Fetch Error: ", error);
            next(error)
         }   
    }   
}

export {asyncHandler}