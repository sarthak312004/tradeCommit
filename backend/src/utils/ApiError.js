class ApiError extends Error{
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = "",
        meta = {}
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false;
        this.errors = errors
        // Optional machine-readable fields, e.g. { code: "PLAN_LIMIT", feature: "maxJournals" }.
        // Ordinary errors do not get them, so existing errors look exactly as before.
        if(meta?.code !== undefined) this.code = meta.code
        if(meta?.feature !== undefined) this.feature = meta.feature

        if(stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

// The extra fields the error middleware may send to the client. Only deliberate ApiErrors qualify, and only string
// values do: database errors carry a numeric `code` (e.g. 11000) that must never be exposed.
const publicErrorFields = (error) => {
    if(error?.success !== false) return {}
    const fields = {}
    if(typeof error.code === "string") fields.code = error.code
    if(typeof error.feature === "string") fields.feature = error.feature
    return fields
}

export {ApiError, publicErrorFields}