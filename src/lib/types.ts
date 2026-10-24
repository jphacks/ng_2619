// API のレスポンス型（画面とサーバの契約。基本設計書 5.3 / 5.4）
// バックエンドがここを変えるときは、フロントエンド担当に必ず共有すること。

import type {
  AvatarSlot,
  ChallengeStatus,
  Role,
  SubmissionMethod,
  TargetUnit,
  VerifyMethod,
} from "./constants";

export type ApiErrorBody = {
  error: { code: string; message: string; reason?: string; fields?: Record<string, string> };
};

export type AvatarLayer = { slot: AvatarSlot; itemId: string; imagePath: string; isNone: boolean };

export type LoginResponse = { role: Role; redirectTo: string };

export type MeResponse = {
  userId: string;
  role: Role;
  displayName: string;
  loginId: string;
  email: string | null;
  reauthRequired: boolean | null;
};

// ---- 保護者 ----

export type ChildCard = {
  id: string;
  displayName: string;
  grade: number;
  loginId: string;
  level: number;
  approvedCount: number;
  activeCount: number;
  weekApprovedCount: number;
  avatar: AvatarLayer[];
};

export type ParentDashboard = { pendingCount: number; children: ChildCard[] };

export type ChildrenListResponse = { items: ChildCard[]; max: number };

export type MissionChallenge = {
  id: string;
  childId: string;
  childName: string;
  /** 期限切れを反映した状態（DBが OPEN でも期限を過ぎていれば EXPIRED） */
  status: ChallengeStatus;
  approvedAt: string | null;
  /** 「達成を登録」ボタンを出すか（F-APV-08） */
  canComplete: boolean;
  /** 承認待ちの申請がある場合のID（P-05 へのリンク用） */
  pendingSubmissionId: string | null;
};

export type Mission = {
  id: string;
  title: string;
  description: string | null;
  categoryCode: string;
  targetValue: number | null;
  targetUnit: TargetUnit | null;
  verifyMethod: VerifyMethod;
  dueDate: string | null;
  createdAt: string;
  challenges: MissionChallenge[];
};

export type MissionDetail = Mission & {
  editable: { allowed: boolean; verifyMethod: boolean; reason: string | null };
};

export type MissionListResponse = { items: Mission[]; nextCursor: string | null };

export type PendingSubmission = {
  id: string;
  challengeId: string;
  childId: string;
  childName: string;
  missionTitle: string;
  method: SubmissionMethod;
  submittedAt: string;
  stampLabel: string | null;
};

export type PendingListResponse = { items: PendingSubmission[]; nextCursor: string | null };

export type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "DELETED";

export type SubmissionDetail = {
  id: string;
  challengeId: string;
  challengeStatus: ChallengeStatus;
  source: "CHILD" | "PARENT";
  method: SubmissionMethod;
  submittedAt: string;
  stampLabel: string | null;
  reviewResult: "APPROVED" | "REJECTED" | null;
  reviewComment: string | null;
  child: { id: string; displayName: string };
  mission: {
    id: string;
    title: string;
    description: string | null;
    targetValue: number | null;
    targetUnit: TargetUnit | null;
    verifyMethod: VerifyMethod;
    dueDate: string | null;
  };
  video: { status: VideoStatus; failureReason: string | null } | null;
};

export type ReviewResult = {
  challengeStatus: ChallengeStatus;
  submissionId: string;
  child: { approvedCount: number; level: number; leveledUp: boolean };
};

export type ChildSummary = {
  id: string;
  displayName: string;
  grade: number;
  level: number;
  approvedCount: number;
  remainingToNext: number | null;
  avatar: AvatarLayer[];
  activeChallenges: {
    challengeId: string;
    missionId: string;
    title: string;
    status: ChallengeStatus;
    dueDate: string | null;
    verifyMethod: VerifyMethod;
    canComplete: boolean;
    pendingSubmissionId: string | null;
  }[];
  history: { challengeId: string; title: string; approvedAt: string; source: "CHILD" | "PARENT" }[];
};

// ---- 子ども ----

export type KidsChallengeCard = {
  id: string;
  title: string;
  status: ChallengeStatus;
  dueDate: string | null;
  targetValue: number | null;
  targetUnit: TargetUnit | null;
  verifyMethod: VerifyMethod;
  categoryCode: string;
};

export type KidsNotice = {
  submissionId: string;
  kind: "APPROVED" | "REJECTED" | "PARENT_COMPLETED";
  missionTitle: string;
  comment: string | null;
  reviewedAt: string;
};

export type UnlockedItem = { id: string; slot: AvatarSlot; name: string; imagePath: string };

export type KidsHome = {
  child: {
    displayName: string;
    level: number;
    approvedCount: number;
    remainingToNext: number | null;
    /** レベルゲージ用：今のレベルに必要だった累計数と、次のレベルに必要な累計数（最大レベルなら null） */
    levelStart: number;
    levelEnd: number | null;
    avatarInitialized: boolean;
  };
  avatar: AvatarLayer[];
  notices: KidsNotice[];
  levelUp: { from: number; to: number; unlockedItems: UnlockedItem[] } | null;
  challenges: KidsChallengeCard[];
  safetyMessage: string | null;
};

export type KidsChallengeDetail = KidsChallengeCard & {
  description: string | null;
  rejectionComment: string | null;
};

export type KidsRecords = {
  approvedCount: number;
  items: { challengeId: string; title: string; approvedAt: string; comment: string | null }[];
};

export type AvatarState = {
  level: number;
  items: {
    id: string;
    slot: AvatarSlot;
    name: string;
    imagePath: string;
    unlockLevel: number;
    isNone: boolean;
    unlocked: boolean;
  }[];
  equips: Record<AvatarSlot, string>;
};

export type VideoUploadUrlResponse = {
  videoId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

export type SubmissionCreated = { submissionId: string; challengeStatus: ChallengeStatus };

// ---- マスタ ----

export type Masters = {
  categories: { code: string; label: string; iconPath: string }[];
  stamps: { code: string; label: string; iconPath: string }[];
  commentTemplates: { id: number; text: string }[];
  levels: { level: number; requiredCount: number }[];
};
