import { AiRangeReview } from "../models/aiRangeReview.models.js";
import { AiReview } from "../models/aiReview.models.js";
import { Journal } from "../models/journal.models.js";
import { Planner } from "../models/planner.models.js";
import { PlanEntry } from "../models/planEntry.models.js";
import { Trade } from "../models/trade.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";
import { asyncHandler } from "./asyncHandler.js";

export const ONBOARDING_ACTION = Object.freeze({
  JOURNAL_CREATED: "journal_created",
  JOURNAL_CONTEXT_SAVED: "journal_context_saved",
  PLAN_CREATED: "plan_created",
  PLANNER_CONNECTED: "planner_connected",
  TRADE_LOGGED: "trade_logged",
  MENTOR_REVIEW_CREATED: "mentor_review_created",
});

export const REQUIRED_ONBOARDING_ACTIONS = Object.freeze([
  ONBOARDING_ACTION.PLAN_CREATED,
  ONBOARDING_ACTION.PLANNER_CONNECTED,
  ONBOARDING_ACTION.JOURNAL_CREATED,
  ONBOARDING_ACTION.JOURNAL_CONTEXT_SAVED,
  ONBOARDING_ACTION.TRADE_LOGGED,
  ONBOARDING_ACTION.MENTOR_REVIEW_CREATED,
]);

export const PLANNER_WALKTHROUGH_STEPS = Object.freeze([
  "connection",
  "open-plan",
  "deep-mode",
  "quick-plan",
  "full-editor",
]);

export const DEMO_FLYWHEEL_STATUSES = Object.freeze([
  "pending",
  "active",
  "completed",
  "skipped",
]);

export const DEMO_FLYWHEEL_STEPS = Object.freeze([
  "journal",
  "context",
  "planner",
  "ai-mentor",
  "next-plan",
  "finish",
]);

export const ALLOWED_PRIOR_DEMO_STATUSES = Object.freeze({
  pending: Object.freeze(["pending"]),
  active: Object.freeze(["pending", "active"]),
  completed: Object.freeze(["pending", "active"]),
  skipped: Object.freeze(["pending", "active"]),
});

export const toDemoFlywheel = (demo) => demo ? ({
  status: demo.status,
  step: demo.step,
  updatedAt: demo.updatedAt ? new Date(demo.updatedAt).toISOString() : null,
}) : null;

export const createUpdateDemoFlywheelHandler = ({ User: UserModel = User } = {}) =>
  asyncHandler(async (req, res) => {
    const { status, step } = req.body ?? {};
    if (!DEMO_FLYWHEEL_STATUSES.includes(status) || !DEMO_FLYWHEEL_STEPS.includes(step)) {
      throw new ApiError(400, "Choose a valid flywheel demo status and step");
    }

    const allowedPriorStatuses = ALLOWED_PRIOR_DEMO_STATUSES[status];
    let user = await UserModel.findOneAndUpdate(
      {
        _id: req.user._id,
        "demoFlywheel.status": { $in: allowedPriorStatuses },
      },
      {
        $set: {
          "demoFlywheel.status": status,
          "demoFlywheel.step": step,
          "demoFlywheel.updatedAt": new Date(),
        },
      },
      { new: true, projection: "demoFlywheel" }
    );

    if (!user) {
      user = await UserModel.findById(req.user._id).select("demoFlywheel");
      if (!user) throw new ApiError(404, "User not found");
      if (!user.demoFlywheel) {
        throw new ApiError(409, "Flywheel demo is not available for this account");
      }
    }

    return res.status(200).json(
      new ApiResponse(200, { demoFlywheel: toDemoFlywheel(user.demoFlywheel) }, "Flywheel demo saved")
    );
  });

export const hasCompletedOnboardingWorkflow = (actions = []) => {
  const completed = new Set(actions);
  return REQUIRED_ONBOARDING_ACTIONS.every((action) => completed.has(action));
};

export const getOnboardingActionsFromFacts = ({
  hasJournal = false,
  hasContext = false,
  hasPlan = false,
  hasPlannerConnection = false,
  hasTrade = false,
  hasMentorReview = false,
} = {}) => [
  hasPlan && ONBOARDING_ACTION.PLAN_CREATED,
  hasPlannerConnection && ONBOARDING_ACTION.PLANNER_CONNECTED,
  hasJournal && ONBOARDING_ACTION.JOURNAL_CREATED,
  hasContext && ONBOARDING_ACTION.JOURNAL_CONTEXT_SAVED,
  hasTrade && ONBOARDING_ACTION.TRADE_LOGGED,
  hasMentorReview && ONBOARDING_ACTION.MENTOR_REVIEW_CREATED,
].filter(Boolean);

export const reconcileOnboardingActions = async (ownerId) => {
  const [hasJournal, hasContext, hasPlan, hasPlannerConnection, hasTrade, hasWeeklyReview, hasRangeReview] = await Promise.all([
    Journal.exists({ owner: ownerId }),
    Journal.exists({
      owner: ownerId,
      $or: [
        { "context.strategy": { $exists: true, $nin: ["", null] } },
        { "context.attributes.0": { $exists: true } },
      ],
    }),
    PlanEntry.exists({ owner: ownerId }),
    Planner.exists({ owner: ownerId, linkedJournal: { $exists: true, $ne: null } }),
    Trade.exists({ owner: ownerId }),
    AiReview.exists({ owner: ownerId }),
    AiRangeReview.exists({ owner: ownerId }),
  ]);
  const actions = getOnboardingActionsFromFacts({
    hasJournal: Boolean(hasJournal),
    hasContext: Boolean(hasContext),
    hasPlan: Boolean(hasPlan),
    hasPlannerConnection: Boolean(hasPlannerConnection),
    hasTrade: Boolean(hasTrade),
    hasMentorReview: Boolean(hasWeeklyReview || hasRangeReview),
  });
  const now = new Date();
  const update = {
    $set: {
      "onboardingGuide.actions": actions,
      "onboardingGuide.updatedAt": now,
    },
  };
  if (hasCompletedOnboardingWorkflow(actions)) {
    update.$set["onboardingGuide.workflowCompletedAt"] = now;
  }

  return User.updateOne(
    {
      _id: ownerId,
      onboardingGuide: { $ne: null },
      "onboardingGuide.workflowCompletedAt": null,
    },
    update
  );
};

export const reconcileOnboardingActionsSafely = async (ownerId, source) => {
  try {
    await reconcileOnboardingActions(ownerId);
  } catch (error) {
    console.error(`[onboarding] ${source} progress reconciliation failed`, error);
  }
};

export const restoreLegacyOnboardingGuide = async (ownerId, { status, step }) => {
  const eligibleUser = await User.findOne({
    _id: ownerId,
    onboardingCompleted: true,
    onboardingTradingStyle: { $in: ["intraday", "swing", "position", "hybrid"] },
    onboardingGuide: null,
  }).select("_id");
  if (!eligibleUser) return null;

  const [hasJournal, hasContext, hasPlan, hasPlannerConnection, hasTrade, hasWeeklyReview, hasRangeReview] = await Promise.all([
    Journal.exists({ owner: ownerId }),
    Journal.exists({
      owner: ownerId,
      $or: [
        { "context.strategy": { $exists: true, $nin: ["", null] } },
        { "context.attributes.0": { $exists: true } },
      ],
    }),
    PlanEntry.exists({ owner: ownerId }),
    Planner.exists({ owner: ownerId, linkedJournal: { $exists: true, $ne: null } }),
    Trade.exists({ owner: ownerId }),
    AiReview.exists({ owner: ownerId }),
    AiRangeReview.exists({ owner: ownerId }),
  ]);
  const actions = getOnboardingActionsFromFacts({
    hasJournal: Boolean(hasJournal),
    hasContext: Boolean(hasContext),
    hasPlan: Boolean(hasPlan),
    hasPlannerConnection: Boolean(hasPlannerConnection),
    hasTrade: Boolean(hasTrade),
    hasMentorReview: Boolean(hasWeeklyReview || hasRangeReview),
  });
  const now = new Date();
  const guide = {
    guideStatus: status,
    step,
    actions,
    workflowCompletedAt: hasCompletedOnboardingWorkflow(actions) ? now : null,
    updatedAt: now,
  };

  const restored = await User.findOneAndUpdate(
    { _id: ownerId, onboardingGuide: null, onboardingCompleted: true },
    { $set: { onboardingGuide: guide } },
    { new: true, projection: "onboardingGuide" }
  );
  if (restored) return restored;
  return User.findById(ownerId).select("onboardingGuide");
};

export const recordOnboardingAction = async (ownerId, action) => {
  if (!Object.values(ONBOARDING_ACTION).includes(action)) {
    throw new TypeError("Invalid onboarding action");
  }

  const activeGuide = {
    _id: ownerId,
    onboardingGuide: { $ne: null },
    "onboardingGuide.workflowCompletedAt": null,
  };
  const now = new Date();
  const result = await User.updateOne(activeGuide, {
    $addToSet: { "onboardingGuide.actions": action },
    $set: { "onboardingGuide.updatedAt": now },
  });

  if (result.matchedCount === 0) return;

  await User.updateOne(
    {
      ...activeGuide,
      "onboardingGuide.actions": { $all: REQUIRED_ONBOARDING_ACTIONS },
    },
    {
      $set: {
        "onboardingGuide.workflowCompletedAt": now,
        "onboardingGuide.updatedAt": now,
      },
    }
  );
};

export const recordOnboardingActionSafely = async (ownerId, action, source) => {
  try {
    await recordOnboardingAction(ownerId, action);
  } catch (error) {
    console.error(`[onboarding] ${source} progress update failed`, error);
  }
};

export const queueFirstPlannerWalkthrough = async (ownerId, plannerId) => {
  const firstPlanner = await Planner.findOne({ owner: ownerId }).sort({ createdAt: 1, _id: 1 }).select("_id");
  if (String(firstPlanner?._id) !== String(plannerId)) return false;

  const result = await User.updateOne(
    { _id: ownerId, plannerWalkthrough: null },
    {
      $set: {
        plannerWalkthrough: {
          status: "pending",
          step: PLANNER_WALKTHROUGH_STEPS[0],
          planner: plannerId,
          updatedAt: new Date(),
        },
      },
    }
  );

  return result.modifiedCount === 1;
};

export const queueFirstPlannerWalkthroughSafely = async (ownerId, plannerId) => {
  try {
    return await queueFirstPlannerWalkthrough(ownerId, plannerId);
  } catch (error) {
    console.error("[onboarding] first Planner walkthrough queue failed", error);
    return false;
  }
};
