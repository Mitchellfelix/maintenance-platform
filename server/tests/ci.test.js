test("CI uses a database URL", () => {
  if (!process.env.CI) {
    return;
  }

  expect(process.env.DATABASE_URL).toBeTruthy();
});
