import { describe, expect, test } from "bun:test";
import { canAddEmployees, prepareAuthorizedEmployee } from "../src/lib/authorized-employee";

describe("admin employee authorization", () => {
  test("only administrators with both role entries can add employees", () => {
    expect(canAddEmployees("admin", ["admin"])).toBe(true);
    expect(canAddEmployees("leader", ["leader"])).toBe(false);
    expect(canAddEmployees("user", ["user"])).toBe(false);
    expect(canAddEmployees("admin", ["user"])).toBe(false);
    expect(canAddEmployees("user", ["admin"])).toBe(false);
  });

  test("requires both employee name and document", () => {
    expect(() => prepareAuthorizedEmployee(" ", "123")).toThrow();
    expect(() => prepareAuthorizedEmployee("Ana Pérez", " ")).toThrow();
  });

  test("preserves document leading zeros and normalizes personal names", () => {
    expect(prepareAuthorizedEmployee("  ANA   PÉREZ ", " 001234 ")).toEqual({
      full_name: "Ana Pérez", document_number: "001234",
    });
  });
});