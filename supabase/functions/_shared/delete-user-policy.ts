export function canDeleteUser(profileRole: string | undefined, roles: string[], actorId: string, targetId: string): boolean {
  return profileRole === "admin" && roles.includes("admin") && actorId !== targetId;
}