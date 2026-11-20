import { expect, test } from "bun:test";
import { isPasswordRecoveryLink, passwordRecoveryRedirect } from "../src/lib/password-recovery";

test("recovery emails return to the password form rather than the dashboard", () => {
  expect(passwordRecoveryRedirect("https://novaeduca.lovable.app"))
    .toBe("https://novaeduca.lovable.app/reset-password");
});

test("recognizes recovery links on legacy landing pages without treating login as recovery", () => {
  expect(isPasswordRecoveryLink("#access_token=test&type=recovery")).toBe(true);
  expect(isPasswordRecoveryLink("#access_token=test&type=magiclink")).toBe(false);
  expect(isPasswordRecoveryLink("")).toBe(false);
});