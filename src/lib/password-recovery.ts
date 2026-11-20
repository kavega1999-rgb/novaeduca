export function isPasswordRecoveryLink(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, "")).get("type") === "recovery";
}

export function passwordRecoveryRedirect(origin: string): string {
  return `${origin}/reset-password`;
}

// Capture before the auth client finishes consuming and clearing the URL fragment.
export const initialRecoveryLink = typeof window !== "undefined"
  && isPasswordRecoveryLink(window.location.hash);