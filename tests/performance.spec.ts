import { expect, test } from "@playwright/test";
test("profile the visible scene and recover from actual WebGL context loss", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "3D pathways", exact: true }).click();
  const host = page.locator(".three-host");
  await expect(host.locator("canvas")).toBeVisible();
  await host.scrollIntoViewIfNeeded();
  await expect(host).toHaveAttribute("data-median-fps", /\d/, {
    timeout: 15000,
  });
  const fps = Number(await host.getAttribute("data-median-fps"));
  console.info(`Visible Three.js scene median frame cadence: ${fps} fps`);
  await testInfo.attach("scene-performance", {
    body: JSON.stringify({
      medianFps: fps,
      viewport: "1440x1000",
      browser: "Microsoft Edge",
      rendering: "headless",
    }),
    contentType: "application/json",
  });
  await page.evaluate(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>(".three-host canvas");
    const gl = canvas?.getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension)
      throw new Error(
        "WebGL context-loss extension not available for this test",
      );
    extension.loseContext();
  });
  await expect(page.getByTestId("pipeline-fallback")).toBeVisible();
  await page
    .getByRole("button", { name: "Model comparison", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Put every model to the test." }),
  ).toBeVisible();
});
