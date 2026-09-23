import { expect, test } from "@playwright/test";
test("agent canvas stays inside its panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("run-status")).toHaveText("Run complete");
  const canvas = await page.getByTestId("agent-canvas").boundingBox();
  const flow = await page.locator(".react-flow").boundingBox();
  expect(flow!.y + flow!.height).toBeLessThanOrEqual(
    canvas!.y + canvas!.height,
  );
});
