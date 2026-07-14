const {
  canLogTimeOnWorkOrder,
  canManageTimeEntry,
  canLogForOtherUsers,
} = require("../src/services/timeEntryAccess");

describe("timeEntryAccess", () => {
  const workOrder = { id: "wo1", assigneeId: "op1", requesterId: "req1", siteId: "s1" };

  it("lets operators log time on their assigned work orders", () => {
    expect(canLogTimeOnWorkOrder({ id: "op1", role: "OPERATOR" }, workOrder)).toBe(true);
    expect(canLogTimeOnWorkOrder({ id: "op2", role: "OPERATOR" }, workOrder)).toBe(false);
  });

  it("lets ops leads and admins log time on any work order", () => {
    expect(canLogTimeOnWorkOrder({ id: "lead", role: "OPS_LEAD" }, workOrder)).toBe(true);
    expect(canLogTimeOnWorkOrder({ id: "admin", role: "ADMIN" }, workOrder)).toBe(true);
  });

  it("blocks requesters from logging time", () => {
    expect(canLogTimeOnWorkOrder({ id: "req1", role: "REQUESTER" }, workOrder)).toBe(false);
  });

  it("lets operators manage only their own entries", () => {
    const own = { id: "t1", userId: "op1" };
    const other = { id: "t2", userId: "op2" };
    const operator = { id: "op1", role: "OPERATOR" };
    expect(canManageTimeEntry(operator, own, workOrder)).toBe(true);
    expect(canManageTimeEntry(operator, other, workOrder)).toBe(false);
    expect(canManageTimeEntry({ id: "lead", role: "OPS_LEAD" }, other, workOrder)).toBe(true);
  });

  it("only allows admins and ops leads to log for others", () => {
    expect(canLogForOtherUsers("ADMIN")).toBe(true);
    expect(canLogForOtherUsers("OPS_LEAD")).toBe(true);
    expect(canLogForOtherUsers("OPERATOR")).toBe(false);
  });
});
