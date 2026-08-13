import { v } from "convex/values";

export const SCHEMA_VERSION = 1;

export const providerValidator = v.union(
  v.literal("espn"),
  v.literal("sleeper"),
);

export const seasonStatusValidator = v.union(
  v.literal("planned"),
  v.literal("preseason"),
  v.literal("active"),
  v.literal("complete"),
);

export const syncStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("skipped"),
  v.literal("failed"),
);

export const dataQualityValidator = v.union(
  v.literal("verified"),
  v.literal("inferred"),
  v.literal("incomplete"),
);

export const matchupStateValidator = v.union(
  v.literal("scheduled"),
  v.literal("live"),
  v.literal("final"),
);

export const matchupResultValidator = v.union(
  v.literal("pending"),
  v.literal("win"),
  v.literal("loss"),
  v.literal("tie"),
  v.literal("bye"),
);

export const transactionKindValidator = v.union(
  v.literal("waiver"),
  v.literal("free_agent"),
  v.literal("trade"),
  v.literal("commissioner"),
);
