import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "./ApiError.js";

// Configured lazily: ES module imports run before dotenv.config(),
// so reading process.env at the top level can give undefined values.
let configured = false;
const configure = () => {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
};

// Upload an image buffer (from multer memory storage)
export const uploadOnCloudinary = (buffer, folder = "trading-journal") => {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(new ApiError(500, "Image upload failed"));
        resolve(result); // result.secure_url, result.public_id
      }
    );
    stream.end(buffer);
  });
};

// Delete an image by its publicId
export const deleteFromCloudinary = async (publicId) => {
  configure();
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId);
};