import { describe, expect, test } from "bun:test";
import { fetchAllRows } from "../src/lib/paginated-query";

describe("complete tabulation reads", () => {
  test("retains assignments beyond the first 1000 when membership changes", async () => {
    const assignments = Array.from({ length: 1405 }, (_, index) => ({
      training_id: "cuidarser",
      user_id: `user-${index}`,
    }));
    const rows = await fetchAllRows((from, to) =>
      Promise.resolve({ data: assignments.slice(from, to + 1), error: null }),
    );
    expect(rows).toHaveLength(1405);
    expect(rows.some(row => row.user_id === "user-1404")).toBe(true);
  });

  test("fails instead of displaying incomplete results when a page fails", async () => {
    await expect(fetchAllRows((from) => Promise.resolve(from === 0
      ? { data: Array.from({ length: 1000 }, () => ({ id: "report" })), error: null }
      : { data: null, error: { message: "Read failed" } },
    ))).rejects.toThrow("Read failed");
  });
});