import 'dotenv/config'
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

export const cloudinaryPublicIdFromUrl = (imageUrl, expectedFolder) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (typeof imageUrl !== "string" || !cloudName || !expectedFolder) return null;

  try {
    const url = new URL(imageUrl);
    const uploadPath = `/${cloudName}/image/upload/`;
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(uploadPath)) {
      return null;
    }

    const path = decodeURIComponent(url.pathname.slice(uploadPath.length));
    const segments = path.split("/");
    if (/^v\d+$/.test(segments[0] ?? "")) segments.shift();
    if (segments.length < 2 || segments.some((segment) => segment === "." || segment === "..")) return null;

    const filename = segments.pop().replace(/\.(?:avif|bmp|gif|jpe?g|png|tiff?|webp)$/i, "");
    const publicId = [...segments, filename].join("/");
    return publicId.startsWith(`${expectedFolder}/`) ? publicId : null;
  } catch {
    return null;
  }
};

export const deleteImagesFromCloudinary = async (imageUrls, expectedFolder) => {
  if (!Array.isArray(imageUrls)) return;

  const publicIds = new Set(
    imageUrls
      .map((imageUrl) => cloudinaryPublicIdFromUrl(imageUrl, expectedFolder))
      .filter(Boolean)
  );

  await Promise.all([...publicIds].map(async (publicId) => {
    try {
      const result = await deleteFromCloudinary(publicId);
      if (result?.result === "error") {
        console.error("Cloudinary image deletion failed", publicId, result);
      }
    } catch (error) {
      console.error("Cloudinary image deletion failed", publicId, error);
    }
  }));
};