import { expect, test } from "bun:test";
import { canDeleteUser } from "../supabase/functions/_shared/delete-user-policy";

test("only a dual-role administrator may delete another user", () => {
  expect(canDeleteUser("admin", ["admin"], "admin-1", "user-1")).toBe(true);
  expect(canDeleteUser("leader", ["leader"], "leader-1", "user-1")).toBe(false);
  expect(canDeleteUser("admin", ["user"], "admin-1", "user-1")).toBe(false);
  expect(canDeleteUser("user", ["admin"], "admin-1", "user-1")).toBe(false);
});

test("an administrator cannot delete their own account", () => {
  expect(canDeleteUser("admin", ["admin"], "admin-1", "admin-1")).toBe(false);
});