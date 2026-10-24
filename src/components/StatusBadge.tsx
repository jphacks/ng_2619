import { CHALLENGE_STATUS_LABEL, type ChallengeStatus } from "@/lib/constants";
import { Badge } from "./ui";

const COLOR: Record<ChallengeStatus, "gray" | "blue" | "green" | "orange" | "red"> = {
  OPEN: "blue",
  PENDING: "orange",
  REJECTED: "red",
  APPROVED: "green",
  EXPIRED: "gray",
  ARCHIVED: "gray",
};

export function StatusBadge({ status }: { status: ChallengeStatus }) {
  return <Badge color={COLOR[status]}>{CHALLENGE_STATUS_LABEL[status]}</Badge>;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  BALL: "⚽",
  BAR: "🤸",
  ROPE: "➰",
  RUN: "🏃",
  PLAYGROUND: "🛝",
  OTHER: "⭐",
};
