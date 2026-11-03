import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./ApiError.js";
import { PlanEntry } from "../models/planEntry.models.js";
import {
  DEFAULT_PLAN_SCOPE,
  PLAN_SCOPES,
  isWeeklyPlanStart,
  parsePlanScope,
  planCoversDate,
  planCoversRange,
} from "./planScope.js";

test("a missing scope means day on create, and keeps the current scope on update", () => {
  assert.equal(DEFAULT_PLAN_SCOPE, "day");
  assert.equal(parsePlanScope(undefined), "day");
  assert.equal(parsePlanScope(undefined, "week"), "week");
});

test("day and week are accepted as sent", () => {
  assert.deepEqual(PLAN_SCOPES, ["day", "week"]);
  assert.equal(parsePlanScope("day"), "day");
  assert.equal(parsePlanScope("week", "day"), "week");
});

test("anything else is rejected with a 400", () => {
  for (const bad of ["month", "Week", "", null, 1, true, {}, ["week"]]) {
    assert.throws(() => parsePlanScope(bad), (error) => error instanceof ApiError && error.statusCode === 400);
  }
});

test("weekly plans require a real Monday date", () => {
  assert.equal(isWeeklyPlanStart("2026-10-19"), true);
  for (const date of ["2026-10-18", "2026-02-30", "not-a-date", "2026-10-19T00:00:00Z"]) {
    assert.equal(isWeeklyPlanStart(date), false);
  }
});

test("weekly plans cover their full week and overlapping ranges", () => {
  const weekly = { date: "2026-10-19", scope: "week" };
  const daily = { date: "2026-10-20", scope: "day" };
  assert.equal(planCoversDate(weekly, "2026-10-19"), true);
  assert.equal(planCoversDate(weekly, "2026-10-25"), true);
  assert.equal(planCoversDate(weekly, "2026-10-26"), false);
  assert.equal(planCoversDate(daily, "2026-10-20"), true);
  assert.equal(planCoversDate(daily, "2026-10-21"), false);
  assert.equal(planCoversRange(weekly, "2026-10-22", "2026-10-23"), true);
  assert.equal(planCoversRange(weekly, "2026-10-26", "2026-10-27"), false);
});

test("the unique weekly index leaves existing daily plans unrestricted", () => {
  const index = PlanEntry.schema.indexes().find(([, options]) => options.name === "weekly_plan_per_planner_date");
  assert.ok(index);
  assert.deepEqual(index[0], { planner: 1, date: 1 });
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, { scope: "week" });
});
