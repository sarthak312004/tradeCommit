import mongoose from "mongoose";
import { Journal } from "../models/journal.models.js";
import { Planner } from "../models/planner.models.js";
import { PlanEntry } from "../models/planEntry.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteImagesFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TYPE = "Intraday";
const imageUrlsFromHtml = (html = "") =>
  [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1].trim()).filter(Boolean);

const getEntryImages = (entry) => [...new Set([
  ...(Array.isArray(entry.images) ? entry.images : []),
  ...imageUrlsFromHtml(entry.content),
])];

const removedImageUrlsFromBody = (body) =>
  Array.isArray(body?.removedImages) ? body.removedImages.filter((url) => typeof url === "string") : [];

/* ------------------------------- serializers ------------------------------- */

const serializePlanner = (planner) => ({
  id: String(planner._id),
  name: planner.name,
  type: planner.type || DEFAULT_TYPE,
  linkedJournalId: planner.linkedJournal ? String(planner.linkedJournal) : null,
  createdAt: new Date(planner.createdAt).toISOString(),
  updatedAt: new Date(planner.updatedAt).toISOString(),
});

const serializeEntry = (entry) => ({
  id: String(entry._id),
  plannerId: String(entry.planner),
  date: entry.date,
  title: entry.title,
  content: entry.content ?? "",
  images: Array.isArray(entry.images) ? entry.images : [],
  createdAt: new Date(entry.createdAt).toISOString(),
  updatedAt: new Date(entry.updatedAt).toISOString(),
});

/* -------------------------------- validation ------------------------------- */

const requireObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(400, `A valid ${label} ID is required`);
};

const findOwnedPlanner = async (req) => {
  const { plannerId } = req.params;
  requireObjectId(plannerId, "planner");

  const planner = await Planner.findOne({ _id: plannerId, owner: req.user._id });
  if (!planner) throw new ApiError(404, "Planner not found");
  return planner;
};

const parsePlannerPayload = (body, { requireName = true } = {}) => {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim() : "";

  if (requireName && !name) throw new ApiError(400, "Planner name is required");
  if (name.length > 60) throw new ApiError(400, "Planner name can be at most 60 characters");
  if (type.length > 30) throw new ApiError(400, "Planner type can be at most 30 characters");

  return { name, type };
};

// `linkedJournalId`: undefined = not sent (leave as is), null / "" = disconnect, an id = connect to that journal
const parseLinkedJournal = async (body, ownerId) => {
  if (!body || !Object.prototype.hasOwnProperty.call(body, "linkedJournalId")) return undefined;

  const value = body.linkedJournalId;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
    throw new ApiError(400, "A valid journal ID is required");
  }

  const journal = await Journal.findOne({ _id: value, owner: ownerId }).select("_id");
  if (!journal) throw new ApiError(404, "Journal not found");
  return journal._id;
};

const parseEntryPayload = (body) => {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const content = typeof body?.content === "string" ? body.content : "";

  if (!title) throw new ApiError(400, "Plan title is required");
  if (title.length > 120) throw new ApiError(400, "Plan title can be at most 120 characters");
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(date))) {
    throw new ApiError(400, "A valid plan date is required");
  }

  // images are derived from the content so the two can never drift apart
  const images = [...new Set(imageUrlsFromHtml(content))];

  return { title, date, content: content.trim(), images };
};

/* --------------------------------- planners -------------------------------- */

export const getAllPlanners = asyncHandler(async (req, res) => {
  const planners = await Planner.find({ owner: req.user._id }).sort({ createdAt: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, planners.map(serializePlanner), "Planners fetched successfully"));
});

export const createPlanner = asyncHandler(async (req, res) => {
  const { name, type } = parsePlannerPayload(req.body);
  const linkedJournal = await parseLinkedJournal(req.body, req.user._id);

  const planner = await Planner.create({
    name,
    type: type || DEFAULT_TYPE,
    linkedJournal: linkedJournal ?? null,
    owner: req.user._id,
  });

  return res.status(201).json(new ApiResponse(201, serializePlanner(planner), "Planner created successfully"));
});

export const updatePlanner = asyncHandler(async (req, res) => {
  const planner = await findOwnedPlanner(req);
  const { name, type } = parsePlannerPayload(req.body, { requireName: false });
  const linkedJournal = await parseLinkedJournal(req.body, req.user._id);

  if (name) planner.name = name;
  if (type) planner.type = type;
  if (linkedJournal !== undefined) planner.linkedJournal = linkedJournal;
  await planner.save();

  return res.status(200).json(new ApiResponse(200, serializePlanner(planner), "Planner updated successfully"));
});

export const deletePlanner = asyncHandler(async (req, res) => {
  const planner = await findOwnedPlanner(req);

  const entries = await PlanEntry.find({ planner: planner._id, owner: req.user._id });
  await PlanEntry.deleteMany({ planner: planner._id, owner: req.user._id });
  await Planner.deleteOne({ _id: planner._id, owner: req.user._id });

  void deleteImagesFromCloudinary(
    entries.flatMap(getEntryImages),
    `trade-planner/${planner._id}`
  );

  return res.status(200).json(new ApiResponse(200, { plannerId: String(planner._id) }, "Planner deleted successfully"));
});

/* ------------------------------- plan entries ------------------------------ */

export const getPlanEntries = asyncHandler(async (req, res) => {
  const planner = await findOwnedPlanner(req);
  const entries = await PlanEntry.find({ planner: planner._id, owner: req.user._id }).sort({ date: 1, createdAt: 1 });

  return res
    .status(200)
    .json(new ApiResponse(200, entries.map(serializeEntry), "Plans fetched successfully"));
});

export const createPlanEntry = asyncHandler(async (req, res) => {
  const planner = await findOwnedPlanner(req);
  const parsed = parseEntryPayload(req.body);

  const entry = await PlanEntry.create({ ...parsed, owner: req.user._id, planner: planner._id });

  const retainedImages = new Set(parsed.images);
  void deleteImagesFromCloudinary(
    removedImageUrlsFromBody(req.body).filter((url) => !retainedImages.has(url)),
    `trade-planner/${planner._id}`
  );

  return res.status(201).json(new ApiResponse(201, serializeEntry(entry), "Plan saved successfully"));
});

export const updatePlanEntry = asyncHandler(async (req, res) => {
  const planner = await findOwnedPlanner(req);
  const { entryId } = req.params;
  requireObjectId(entryId, "plan");
  const entry = await PlanEntry.findOne({ _id: entryId, planner: planner._id, owner: req.user._id });
  if (!entry) throw new ApiError(404, "Plan not found");

  const previousImages = getEntryImages(entry);
  const parsed = parseEntryPayload(req.body);
  const retainedImages = new Set(parsed.images);
  Object.assign(entry, parsed);
  await entry.save();

  void deleteImagesFromCloudinary(
    [
      ...previousImages.filter((url) => !retainedImages.has(url)),
      ...removedImageUrlsFromBody(req.body).filter((url) => !retainedImages.has(url)),
    ],
    `trade-planner/${planner._id}`
  );

  return res.status(200).json(new ApiResponse(200, serializeEntry(entry), "Plan updated successfully"));
});

export const deletePlanEntry = asyncHandler(async (req, res) => {
  const planner = await findOwnedPlanner(req);
  const { entryId } = req.params;
  requireObjectId(entryId, "plan");

  const entry = await PlanEntry.findOneAndDelete({ _id: entryId, planner: planner._id, owner: req.user._id });
  if (!entry) throw new ApiError(404, "Plan not found");

  void deleteImagesFromCloudinary(getEntryImages(entry), `trade-planner/${planner._id}`);

  return res.status(200).json(new ApiResponse(200, { entryId }, "Plan deleted successfully"));
});

export const uploadPlanImage = asyncHandler(async (req, res) => {
  const planner = await findOwnedPlanner(req);
  if (!req.file) throw new ApiError(400, "An image file is required");

  const uploaded = await uploadOnCloudinary(req.file.buffer, `trade-planner/${planner._id}`);

  return res.status(201).json(new ApiResponse(201, { url: uploaded.secure_url }, "Image uploaded successfully"));
});
