export type BoostEligibilityInput = {
  isBoosting: boolean;
};

import { PermissionError } from "./errors";

export function assertBoostEligibility(input: BoostEligibilityInput): void {
  if (!input.isBoosting) {
    throw new PermissionError("User must be currently boosting to claim a custom role");
  }
}
