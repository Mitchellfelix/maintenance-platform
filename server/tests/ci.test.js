test("CI uses a reachable database", () => {
  if (!process.env.CI) {
    return;
  }

  expect(process.env.DB_TESTS_AVAILABLE).toBe("true");
});
