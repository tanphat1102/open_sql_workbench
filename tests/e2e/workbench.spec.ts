import { expect, test, type Page, type Route } from "@playwright/test";

const resultRows = [
  { MATNR: "M-100", MTART: "FERT", ERNAM: "DEV-001" },
  { MATNR: "M-200", MTART: "ROH", ERNAM: "DEV-002" },
];

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "cache-control": "no-store",
      "x-oswb-proxy-bytes": String(JSON.stringify(body).length),
    },
    body: JSON.stringify(body),
  });
}

async function fulfillLogin(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "cache-control": "no-store",
    },
    body: JSON.stringify({
      success: true,
      message: "SAP login successful",
      status: 200,
    }),
  });
}

async function mockAuth(page: Page) {
  await page.route("**/api/auth/check-session**", (route) =>
    fulfillJson(route, {
      success: true,
      user: "dev-037",
      client: "324",
    }),
  );

  await page.route("**/api/auth/login**", fulfillLogin);
}

async function mockSapOData(page: Page) {
  await page.route("**/api/sap/**", async (route) => {
    const requestUrl = decodeURIComponent(route.request().url());

    if (requestUrl.includes("SearchTables")) {
      await fulfillJson(route, {
        d: {
          results: [
            {
              ObjectName: "MARA",
              ObjectType: "TABLE",
              Description: "Material master",
            },
            {
              ObjectName: "KNA1",
              ObjectType: "TABLE",
              Description: "Customer master",
            },
          ],
        },
      });
      return;
    }

    if (requestUrl.includes("GetFields")) {
      await fulfillJson(route, {
        d: {
          results: [
            { FieldName: "MATNR", KeyFlag: "X", DataElement: "MATNR" },
            { FieldName: "MTART", KeyFlag: "", DataElement: "MTART" },
          ],
        },
      });
      return;
    }

    if (requestUrl.includes("RunQuery")) {
      await fulfillJson(route, {
        d: {
          RunQuery: {
            ResultId: "RESULT-1",
            Status: "SUCCESS",
            ObjectName: "MARA",
            Page: 1,
            PageSize: 100,
            TotalRows: 2,
            ReturnedRows: 2,
            TotalPages: 1,
            RowCount: 2,
          },
        },
      });
      return;
    }

    if (requestUrl.includes("SqlwbColumnSet")) {
      await fulfillJson(route, {
        d: {
          results: [
            {
              ResultId: "RESULT-1",
              Position: 1,
              FieldName: "MATNR",
              JsonKey: "MATNR",
              Element: "MATNR",
              AbapType: "CHAR",
              Length: 18,
              Decimals: 0,
              IsKey: "X",
              Label: "Material",
            },
            {
              ResultId: "RESULT-1",
              Position: 2,
              FieldName: "MTART",
              JsonKey: "MTART",
              Element: "MTART",
              AbapType: "CHAR",
              Length: 4,
              Decimals: 0,
              IsKey: "",
              Label: "Material Type",
            },
            {
              ResultId: "RESULT-1",
              Position: 3,
              FieldName: "ERNAM",
              JsonKey: "ERNAM",
              Element: "ERNAM",
              AbapType: "CHAR",
              Length: 12,
              Decimals: 0,
              IsKey: "",
              Label: "Created By",
            },
          ],
        },
      });
      return;
    }

    if (requestUrl.includes("SqlwbPageChunkSet")) {
      await fulfillJson(route, {
        d: {
          results: [
            {
              ResultId: "RESULT-1",
              PageNo: "1",
              ChunkNo: 1,
              PayloadPart: JSON.stringify(resultRows),
              PayloadLen: JSON.stringify(resultRows).length,
              IsLastChunk: "X",
            },
          ],
        },
      });
      return;
    }

    await fulfillJson(route, { d: { results: [] } });
  });
}

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
  await mockSapOData(page);
});

test("login page signs in and opens the workbench", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Client").fill("324");
  await page.getByLabel("Username").fill("dev-037");
  await page.getByLabel("Password").fill("secret");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/workbench$/);
  await expect(page.getByText("Open SQL Workbench")).toBeVisible();
});

test("workbench executes a query and renders result rows", async ({ page }) => {
  const runQueryRequest = page.waitForRequest((request) => {
    const requestUrl = decodeURIComponent(request.url());
    return request.method() === "POST" && requestUrl.includes("RunQuery");
  });

  await page.goto("/workbench");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("button", { name: "Object Explorer", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("workbench-query-panel")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.getByRole("complementary").getByText("MARA")).toBeVisible();

  await page.getByRole("button", { name: "Execute" }).click();
  await runQueryRequest;

  await expect(
    page.locator('[data-slot="card-title"]').filter({ hasText: "Results" }),
  ).toBeVisible();
  await expect(page.getByText("M-100")).toBeVisible();
  await expect(page.getByText("FERT")).toBeVisible();
  await page.getByRole("button", { name: "Messages" }).click();
  await expect(page.getByText("Query executed for MARA")).toBeVisible();
});
