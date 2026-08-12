/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bootstrap from "../bootstrap.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as history from "../history.js";
import type * as historyMaterialization from "../historyMaterialization.js";
import type * as identity from "../identity.js";
import type * as identityManagement from "../identityManagement.js";
import type * as ingestion from "../ingestion.js";
import type * as materialization from "../materialization.js";
import type * as model from "../model.js";
import type * as providers_espn from "../providers/espn.js";
import type * as providers_longestTouchdowns from "../providers/longestTouchdowns.js";
import type * as providers_sleeper from "../providers/sleeper.js";
import type * as reconciliation from "../reconciliation.js";
import type * as refresh from "../refresh.js";
import type * as status from "../status.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bootstrap: typeof bootstrap;
  crons: typeof crons;
  dashboard: typeof dashboard;
  history: typeof history;
  historyMaterialization: typeof historyMaterialization;
  identity: typeof identity;
  identityManagement: typeof identityManagement;
  ingestion: typeof ingestion;
  materialization: typeof materialization;
  model: typeof model;
  "providers/espn": typeof providers_espn;
  "providers/longestTouchdowns": typeof providers_longestTouchdowns;
  "providers/sleeper": typeof providers_sleeper;
  reconciliation: typeof reconciliation;
  refresh: typeof refresh;
  status: typeof status;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
