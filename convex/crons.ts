import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "refresh active Sleeper league",
  { minutes: 5 },
  internal.refresh.sleeper,
);

export default crons;
