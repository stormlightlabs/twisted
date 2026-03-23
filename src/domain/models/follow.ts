import type { UserSummary } from "./user.js";

export type FollowSummary = { atUri: string; subjectDid: string; createdAt: string };

export type FollowedUserSummary = UserSummary & { followAtUri: string; followedAt: string };
