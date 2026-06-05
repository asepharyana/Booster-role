/**
 * Base error for all Booster Role bot errors.
 * Enables reliable error type checking via `instanceof` instead of fragile
 * string matching on `error.message`.
 */
export class BoosterRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoosterRoleError";
  }
}

/**
 * Input validation failures — user provided an invalid name, color, icon, etc.
 * Safe to show the message directly to the end user.
 */
export class ValidationError extends BoosterRoleError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Resource not found — no stored role, no Discord role, etc.
 * Safe to show the message directly to the end user.
 */
export class NotFoundError extends BoosterRoleError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Permission / authorisation failures — user doesn't own the role, bot
 * lacks permissions, position is unsafe, etc.
 * Safe to show the message directly to the end user.
 */
export class PermissionError extends BoosterRoleError {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}
