const { canEditWorkOrder, filterWorkOrderUpdate } = require("../src/services/workOrderAccess");

describe("workOrderAccess", () => {
  const workOrder = {
    id: "wo1",
    requesterId: "user-requester",
    assigneeId: "user-operator",
  };

  it("allows admin to edit any work order", () => {
    expect(canEditWorkOrder({ id: "user-admin", role: "ADMIN" }, workOrder)).toBe(true);
  });

  it("allows ops lead to edit any work order", () => {
    expect(canEditWorkOrder({ id: "user-lead", role: "OPS_LEAD" }, workOrder)).toBe(true);
  });

  it("allows operator to edit assigned work orders only", () => {
    expect(canEditWorkOrder({ id: "user-operator", role: "OPERATOR" }, workOrder)).toBe(true);
    expect(canEditWorkOrder({ id: "other-operator", role: "OPERATOR" }, workOrder)).toBe(false);
  });

  it("limits requester updates to title and description (not assign)", () => {
    const filtered = filterWorkOrderUpdate(
      { role: "REQUESTER" },
      { title: "New title", status: "COMPLETED", assigneeId: "x" },
    );
    expect(filtered).toEqual({ title: "New title" });
  });
});

