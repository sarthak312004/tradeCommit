import { Router } from "express";
import multer from "multer";
import { commitImport, downloadImportTemplate, previewImport } from "../controllers/import.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

// Spreadsheets are read in memory (never written to disk), so keep them small and the request rate bounded.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!/\.(csv|xlsx|xls|txt)$/i.test(file.originalname)) {
      return cb(new ApiError(400, "Upload a .csv or .xlsx file"));
    }
    cb(null, true);
  },
}).single("file");

const readUpload = (req, res, next) =>
  upload(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return next(new ApiError(413, "This file is larger than 5 MB. Split it and import in parts."));
    return next(error instanceof ApiError ? error : new ApiError(400, error.message || "The file could not be uploaded"));
  });

const previewLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: "Too many imports, please wait a minute and try again" });
const commitLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: "Too many imports, please wait a minute and try again" });

router.get("/template", verifyJWT, downloadImportTemplate);
router.post("/preview", verifyJWT, previewLimiter, readUpload, previewImport);
router.post("/commit", verifyJWT, commitLimiter, commitImport);

export { router as importRouter };
