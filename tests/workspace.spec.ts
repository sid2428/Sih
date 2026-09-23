import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function completeRun(page: Page) {
  await page.getByLabel("Run playback speed").selectOption("4");
  await expect(page.getByTestId("run-status")).toHaveText("Run complete");
}
test("agent run, inspect, replay, pause, cancel and input invalidation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByTestId("run-status")).toHaveText("Playback paused");
  await expect(page.getByTestId("forecast-value")).toHaveCount(0);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await completeRun(page);
  const initial = await page.getByTestId("forecast-value").textContent();
  await page.screenshot({
    path: "test-results/agent-workspace.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Inspect Physics agent", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Agent inspector" }),
  ).toContainText("Bias correction");
  await page
    .getByRole("button", { name: "Inspect Blending agent", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "How trust is assigned." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Full trace", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Forecast context locked");
  await page.getByRole("button", { name: "Replay run", exact: true }).click();
  await page.getByRole("button", { name: "Cancel run", exact: true }).click();
  await expect(page.getByTestId("run-status")).toHaveText("Inputs changed");
  await expect(page.getByTestId("forecast-value")).toHaveCount(0);
  await page.getByLabel("Weather scenario").selectOption("northeast");
  await page.getByRole("button", { name: "Run forecast", exact: true }).click();
  await completeRun(page);
  expect(await page.getByTestId("forecast-value").textContent()).not.toBe(
    initial,
  );
  await expect(page.locator(".mission-context")).toContainText("Guwahati");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export briefing", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain("briefing.md");
  await page.getByLabel("Weather scenario").selectOption("day6");
  await page.getByRole("button", { name: "Run forecast", exact: true }).click();
  await completeRun(page);
  await expect(
    page.getByRole("button", { name: "Inspect AI pattern agent", exact: true }),
  ).toContainText("Excluded");
  await expect(page.locator(".source-status")).toContainText("2/3");
  expect(errors).toEqual([]);
});
test("interactive model chart, hover, series toggles, replay, zoom and modes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await completeRun(page);
  await page
    .getByRole("button", { name: "Compare all models", exact: true })
    .click();
  await expect(page.locator(".echart-host canvas")).toBeVisible();
  await page.screenshot({
    path: "test-results/model-comparison.png",
    fullPage: true,
  });
  const before = await page.locator(".point-inspector h3").textContent();
  await page.getByLabel("Comparison cursor").fill("12");
  await expect(page.getByLabel("Comparison cursor")).toHaveValue("12");
  expect(await page.locator(".point-inspector h3").textContent()).not.toBe(
    before,
  );
  const host = await page.getByTestId("comparison-chart").boundingBox();
  if (!host) throw Error("Missing chart");
  await page.mouse.move(host.x + host.width * 0.7, host.y + host.height * 0.35);
  await expect(page.getByLabel("Comparison cursor")).not.toHaveValue("12");
  const nwp = page
    .locator(".series-toggles")
    .getByRole("button", { name: "Physics-based NWP" });
  await nwp.click();
  await expect(nwp).toHaveAttribute("aria-pressed", "false");
  await nwp.click();
  await expect(nwp).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Comparison cursor").fill("0");
  await page.getByRole("button", { name: "Play chart replay" }).click();
  await expect(page.getByLabel("Comparison cursor")).not.toHaveValue("0");
  await page.getByRole("button", { name: "Pause chart replay" }).click();
  await page.getByRole("tab", { name: "Error by lead" }).click();
  await expect(page.locator(".ranking-panel")).toContainText(
    "Mean of held-out errors",
  );
  await page.getByRole("tab", { name: "Forecast horizon" }).click();
  await expect(page.locator(".point-inspector")).toContainText(
    "These are forecasts, not observations",
  );
  await page.getByRole("button", { name: "Expand chart" }).click();
  await expect(page.getByTestId("comparison-chart")).toHaveCSS(
    "height",
    "510px",
  );
  await page.getByRole("button", { name: "Restore chart size" }).click();
  await page.mouse.move(host.x + host.width * 0.5, host.y + host.height * 0.4);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -400);
  await page.keyboard.up("Control");
  await page.getByRole("button", { name: "Reset chart zoom" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download comparison CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "astrablend-horizon-comparison.csv",
  );
  await page.getByText("Inspect the underlying comparison data").click();
  await expect(page.locator(".comparison-data-table tbody tr")).toHaveCount(40);
  expect(errors).toEqual([]);
});
test("upload has no invented history, and weather modes switch", async ({
  page,
}) => {
  await page.goto("/");
  await completeRun(page);
  await page
    .getByRole("button", { name: "Extreme risk desk", exact: true })
    .click();
  await page.getByRole("button", { name: "Heatwave", exact: true }).click();
  await expect(page.locator(".forecast-context")).toContainText("Temperature");
  await page.getByRole("button", { name: "High wind", exact: true }).click();
  await expect(page.locator(".forecast-context")).toContainText("Wind speed");
  await page
    .getByRole("button", { name: "Data & provenance", exact: true })
    .click();
  await page
    .getByLabel("Upload forecast CSV")
    .setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("source,value\nnwp,40"),
    });
  await expect(page.getByRole("alert")).toContainText("Missing columns");
  const csv =
    "timestamp,lat,lon,lead_time,source,variable,forecast_value,observed_value\n2026-07-18T06:00:00Z,19.5,73.5,48,nwp,rainfall,190,\n2026-07-18T06:00:00Z,19.5,73.5,48,ai,rainfall,150,\n";
  await page
    .getByLabel("Upload forecast CSV")
    .setInputFiles({
      name: "rainfall.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await page.getByRole("button", { name: "Use dataset", exact: true }).click();
  await page
    .getByRole("button", { name: "Agent workspace", exact: true })
    .click();
  await page.getByRole("button", { name: "Run forecast", exact: true }).click();
  await completeRun(page);
  await expect(page.locator(".source-status")).toContainText("2/3");
  await page
    .getByRole("button", { name: "Compare all models", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Historical replay" }),
  ).toBeDisabled();
  await expect(page.getByRole("tab", { name: "Error by lead" })).toBeDisabled();
  await expect(page.locator(".point-inspector h3")).toContainText("48 h");
});
test("tablet and projector layouts, reduced motion and map interaction", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?no-webgl");
  await completeRun(page);
  for (const width of [1366, 1920, 820]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect
      .poll(async () => {
        const canvas = await page.getByTestId("agent-canvas").boundingBox();
        const output = await page
          .getByRole("button", { name: "Inspect Forecast result", exact: true })
          .boundingBox();
        return (
          !!canvas &&
          !!output &&
          output.x + output.width <= canvas.x + canvas.width + 1
        );
      })
      .toBe(true);
    await page.screenshot({
      path: `test-results/workspace-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "3D pathways", exact: true }).click();
  await expect(page.getByTestId("pipeline-fallback")).toBeVisible();
  await page.getByRole("button", { name: "Regional map", exact: true }).click();
  const cell = page.getByRole("button", { name: /Grid / }).first();
  await cell.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("run-status")).toHaveText("Inputs changed");
  await page
    .getByRole("button", { name: "Model comparison", exact: true })
    .click();
  await expect(page.locator(".echart-host canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/comparison-tablet.png",
    fullPage: true,
  });
});
test("keyboard controls, accessible views and guide", async ({ page }) => {
  await page.goto("/");
  await completeRun(page);
  for (const view of ["Agent workspace", "Model comparison"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    if (view === "Model comparison")
      await expect(page.locator(".echart-host canvas")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page
    .getByRole("button", { name: "Workspace guide", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("worker fallback completes when workers are unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await completeRun(page);
  await expect(page.getByTestId("forecast-value")).toBeVisible();
});

test("preloaded workspaces can replay and recompute offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await completeRun(page);
  await page
    .getByRole("button", { name: "Model comparison", exact: true })
    .click();
  await expect(page.locator(".echart-host canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Agent workspace", exact: true })
    .click();
  await context.setOffline(true);
  await page.getByLabel("Weather scenario").selectOption("northeast");
  await page.getByRole("button", { name: "Run forecast", exact: true }).click();
  await completeRun(page);
  await page
    .getByRole("button", { name: "Compare all models", exact: true })
    .click();
  await expect(page.locator(".echart-host canvas")).toBeVisible();
  await page.getByLabel("Comparison cursor").fill("5");
  await expect(page.getByLabel("Comparison cursor")).toHaveValue("5");
});
