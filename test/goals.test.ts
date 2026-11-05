import assert from "node:assert/strict";
import test from "node:test";
import { goalProgress, normalizeGoals, removeGoal, upsertGoal, type Goal } from "../server/lib/goals.ts";

const base: Goal = {
  handle: "artur",
  followers: 10000,
  date: "2026-12-31",
  startFollowers: 4000,
  startedAt: 1_700_000_000_000,
};

test("Handles werden ohne @ und ohne Grossschreibung verglichen", () => {
  const goals = normalizeGoals([{ ...base, handle: " @Artur " }]);
  assert.equal(goals.length, 1);
  assert.equal(goals[0].handle, "artur");
});

test("kaputte Ziele fallen raus, doppelte bleiben einmal", () => {
  const goals = normalizeGoals([
    { ...base, date: "31.12.2026" },
    { ...base, followers: 0 },
    { ...base, handle: "" },
    null,
    "x",
    base,
    { ...base, followers: 12000 },
  ]);
  assert.equal(goals.length, 1);
  assert.equal(goals[0].followers, 10000);
});

test("ein neues Ziel merkt sich den Startpunkt", () => {
  const goals = upsertGoal([], { handle: "neu", followers: 5000, date: "2027-01-31", startFollowers: 1200 }, 1_800_000_000_000);
  assert.deepEqual(goals, [
    {
      handle: "neu",
      followers: 5000,
      date: "2027-01-31",
      startFollowers: 1200,
      startedAt: 1_800_000_000_000,
    },
  ]);
});

test("ein hoeheres Ziel behaelt den alten Startpunkt", () => {
  const goals = upsertGoal([base], { handle: "@Artur", followers: 20000, date: "2027-06-30", startFollowers: 9000 }, 1_900_000_000_000);
  assert.equal(goals.length, 1);
  assert.equal(goals[0].followers, 20000);
  assert.equal(goals[0].startFollowers, 4000);
  assert.equal(goals[0].startedAt, base.startedAt);
});

test("ohne bekannte Follower entsteht kein falscher Startpunkt", () => {
  const [goal] = upsertGoal([], { handle: "leer", followers: 3000, date: "2027-03-01" });
  assert.equal(goal.startFollowers, 0);
  assert.equal(goal.startedAt, 0);
  assert.equal(goalProgress(goal, 5000), null);
});

test("Ziel entfernen trifft auch @Schreibweise", () => {
  assert.deepEqual(removeGoal([base], "@ARTUR"), []);
  assert.deepEqual(removeGoal([base], "jemand"), [base]);
});

test("Fortschritt liegt zwischen 0 und 100 Prozent", () => {
  assert.equal(goalProgress(base, 4000), 0);
  assert.equal(goalProgress(base, 7000), 50);
  assert.equal(goalProgress(base, 10000), 100);
  assert.equal(goalProgress(base, 12000), 100);
  assert.equal(goalProgress(base, 1000), 0);
});
