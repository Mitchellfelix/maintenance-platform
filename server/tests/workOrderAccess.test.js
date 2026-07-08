const { canEditWorkOrder, filterWorkOrderUpdate } = require("../src/services/workOrderAccess");

describe("workOrderAccess", () => {
  const workOrder = {
    id: "wo1",
    requesterId: "user-requester",
    assigneeId: "user-tech",
  };

  it("allows admin to edit any work order", () => {
    expect(canEditWorkOrder({ id: "user-admin", role: "ADMIN" }, workOrder)).toBe(true);
  });

  it("allows technician to edit assigned work orders only", () => {
    expect(canEditWorkOrder({ id: "user-tech", role: "TECHNICIAN" }, workOrder)).toBe(true);
    expect(canEditWorkOrder({ id: "other-tech", role: "TECHNICIAN" }, workOrder)).toBe(false);
  });

  it("limits requester updates to title and description", () => {
    const filtered = filterWorkOrderUpdate(
      { role: "REQUESTER" },
      { title: "New title", status: "COMPLETED", assigneeId: "x" },
    );
    expect(filtered).toEqual({ title: "New title" });
  });
});
