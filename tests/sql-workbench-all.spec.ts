import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SAP_CLIENT = process.env.E2E_SAP_CLIENT ?? process.env.SAP_CLIENT ?? "";
const SAP_USERNAME =
  process.env.E2E_SAP_USERNAME ?? process.env.SAP_USERNAME ?? "";
const SAP_PASSWORD =
  process.env.E2E_SAP_PASSWORD ?? process.env.SAP_PASSWORD ?? "";
const hasLiveCredentials = Boolean(SAP_CLIENT && SAP_USERNAME && SAP_PASSWORD);

test.describe.configure({ mode: "serial" });

test.skip(
  !hasLiveCredentials,
  "Set E2E_SAP_CLIENT, E2E_SAP_USERNAME, and E2E_SAP_PASSWORD to run live SAP UI tests.",
);

async function signInAndOpenWorkbench(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Client").fill(SAP_CLIENT);
  await page.getByLabel("Username").fill(SAP_USERNAME);
  await page.getByLabel("Password").fill(SAP_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/workbench$/, { timeout: 30_000 });
  await expect(page.getByText("Open SQL Workbench")).toBeVisible();
  await expect(page.getByTestId("workbench-query-panel")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30_000 },
  );
}

async function openMessages(page: Page) {
  const messagesButton = page.getByRole("button", { name: "Messages" });

  await messagesButton.click();
}

async function inputSql(page: Page, sql: string) {
  await page.waitForFunction(() => Boolean(window.__openSqlWorkbenchEditor));
  await page.evaluate((nextSql) => {
    window.__openSqlWorkbenchEditor?.setValue(nextSql);
  }, sql);
  await expect
    .poll(
      async () =>
        page.evaluate(() => window.__openSqlWorkbenchEditor?.getValue() ?? ""),
      { timeout: 5_000 },
    )
    .toBe(sql);
  await expect(page.getByText(`${sql.length} chars`)).toBeVisible({
    timeout: 5_000,
  });
}

async function runSql(page: Page) {
  await page.getByRole("button", { name: "Execute" }).click();
}

async function expectSuccess(page: Page) {
  await expect(
    page.locator('[data-slot="card-title"]').filter({ hasText: "Results" }),
  ).toBeVisible({
    timeout: 30_000,
  });

  await openMessages(page);
  await expect(page.getByText(/Query executed|Preview loaded/i)).toBeVisible({
    timeout: 30_000,
  });
}

async function expectBlocked(page: Page) {
  await openMessages(page);
  await expect(
    page
      .getByText(
        /not allowed|forbidden|blocked|unauthorized|only select|failed/i,
      )
      .first(),
  ).toBeVisible({
    timeout: 30_000,
  });
}

async function expectSyntaxError(page: Page) {
  await openMessages(page);
  await expect(
    page.getByText(/syntax|invalid|error|failed/i).first(),
  ).toBeVisible({
    timeout: 30_000,
  });
}

const baseSelectCases = [
  "SELECT * FROM SCARR",
  "SELECT * FROM SAIRPORT",
  "SELECT * FROM SAPLANE",
  "SELECT * FROM SPFLI",
  "SELECT * FROM SFLIGHT",
  "SELECT * FROM SBOOK",
  "SELECT * FROM SCUSTOM",
  "SELECT * FROM SBUSPART",
  "SELECT * FROM SNVOICE",
  "SELECT * FROM STICKET",
  "SELECT * FROM STRAVELAG",

  "SELECT carrid, carrname, currcode, url FROM SCARR",
  "SELECT id, name, time_zone FROM SAIRPORT",
  "SELECT planetype, seatsmax, tankcap, weight FROM SAPLANE",
  "SELECT carrid, connid, countryfr, cityfrom, airpfrom, countryto, cityto, airpto FROM SPFLI",
  "SELECT carrid, connid, fldate, price, currency, planetype FROM SFLIGHT",
  "SELECT carrid, connid, fldate, bookid, customid, custtype, smoker FROM SBOOK",
  "SELECT id, name, form, street, city, country FROM SCUSTOM",
  "SELECT agencynum, name, street, city, country FROM STRAVELAG",

  "SELECT * FROM SCARR WHERE carrid = 'LH'",
  "SELECT * FROM SPFLI WHERE carrid = 'LH'",
  "SELECT * FROM SFLIGHT WHERE carrid = 'LH'",
  "SELECT * FROM SBOOK WHERE carrid = 'LH'",
  "SELECT * FROM SCUSTOM WHERE country = 'DE'",
  "SELECT * FROM SAIRPORT WHERE id = 'FRA'",

  "SELECT * FROM SCARR WHERE carrname LIKE '%Air%'",
  "SELECT * FROM SCUSTOM WHERE name LIKE '%Smith%'",
  "SELECT * FROM STRAVELAG WHERE name LIKE '%Travel%'",

  "SELECT * FROM SCARR ORDER BY carrid",
  "SELECT * FROM SPFLI ORDER BY carrid, connid",
  "SELECT * FROM SFLIGHT ORDER BY carrid, connid, fldate",
  "SELECT * FROM SCUSTOM ORDER BY id",
];

const topSelectCases = [
  "SELECT TOP 1 * FROM SCARR",
  "SELECT TOP 2 * FROM SAIRPORT",
  "SELECT TOP 3 * FROM SAPLANE",
  "SELECT TOP 4 * FROM SPFLI",
  "SELECT TOP 5 * FROM SFLIGHT",
  "SELECT TOP 6 * FROM SBOOK",
  "SELECT TOP 7 * FROM SCUSTOM",
  "SELECT TOP 8 * FROM SBUSPART",
  "SELECT TOP 9 * FROM SNVOICE",
  "SELECT TOP 10 * FROM STICKET",
  "SELECT TOP 11 * FROM STRAVELAG",
  "SELECT TOP 25 * FROM SCARR",
  "SELECT TOP 25 * FROM SAIRPORT",
  "SELECT TOP 25 * FROM SAPLANE",
  "SELECT TOP 25 * FROM SPFLI",
  "SELECT TOP 25 * FROM SFLIGHT",
  "SELECT TOP 25 * FROM SBOOK",
  "SELECT TOP 25 * FROM SCUSTOM",
  "SELECT TOP 25 * FROM SBUSPART",
  "SELECT TOP 25 * FROM SNVOICE",
  "SELECT TOP 25 * FROM STICKET",
  "SELECT TOP 25 * FROM STRAVELAG",
];

const projectionCases = [
  "SELECT TOP 5 carrid, carrname FROM SCARR",
  "SELECT TOP 5 currcode, url FROM SCARR",
  "SELECT TOP 5 id, name FROM SAIRPORT",
  "SELECT TOP 5 id, time_zone FROM SAIRPORT",
  "SELECT TOP 5 planetype, seatsmax FROM SAPLANE",
  "SELECT TOP 5 planetype, weight FROM SAPLANE",
  "SELECT TOP 5 carrid, connid FROM SPFLI",
  "SELECT TOP 5 cityfrom, cityto FROM SPFLI",
  "SELECT TOP 5 carrid, connid FROM SFLIGHT",
  "SELECT TOP 5 price, currency FROM SFLIGHT",
  "SELECT TOP 5 carrid, bookid FROM SBOOK",
  "SELECT TOP 5 customid, custtype FROM SBOOK",
  "SELECT TOP 5 id, name FROM SCUSTOM",
  "SELECT TOP 5 city, country FROM SCUSTOM",
  "SELECT TOP 5 agencynum, name FROM STRAVELAG",
  "SELECT TOP 5 city, country FROM STRAVELAG",
];

const equalityCases = [
  "SELECT * FROM SCARR WHERE carrid = 'AA'",
  "SELECT * FROM SCARR WHERE carrid = 'LH'",
  "SELECT * FROM SCARR WHERE carrid = 'SQ'",
  "SELECT * FROM SCARR WHERE currcode = 'USD'",
  "SELECT * FROM SAIRPORT WHERE id = 'FRA'",
  "SELECT * FROM SAIRPORT WHERE id = 'JFK'",
  "SELECT * FROM SAIRPORT WHERE id = 'SFO'",
  "SELECT * FROM SAPLANE WHERE planetype = 'A319'",
  "SELECT * FROM SAPLANE WHERE planetype = '747-400'",
  "SELECT * FROM SPFLI WHERE carrid = 'AA'",
  "SELECT * FROM SPFLI WHERE carrid = 'LH'",
  "SELECT * FROM SPFLI WHERE cityfrom = 'FRANKFURT'",
  "SELECT * FROM SPFLI WHERE cityto = 'NEW YORK'",
  "SELECT * FROM SPFLI WHERE countryfr = 'DE'",
  "SELECT * FROM SFLIGHT WHERE carrid = 'AA'",
  "SELECT * FROM SFLIGHT WHERE carrid = 'LH'",
  "SELECT * FROM SFLIGHT WHERE currency = 'EUR'",
  "SELECT * FROM SFLIGHT WHERE planetype = '747-400'",
  "SELECT * FROM SBOOK WHERE carrid = 'AA'",
  "SELECT * FROM SBOOK WHERE carrid = 'LH'",
  "SELECT * FROM SBOOK WHERE custtype = 'B'",
  "SELECT * FROM SBOOK WHERE smoker = 'X'",
  "SELECT * FROM SCUSTOM WHERE country = 'DE'",
  "SELECT * FROM SCUSTOM WHERE city = 'BERLIN'",
  "SELECT * FROM SCUSTOM WHERE form = 'Mr.'",
  "SELECT * FROM STRAVELAG WHERE country = 'DE'",
  "SELECT * FROM STRAVELAG WHERE city = 'BERLIN'",
];

const likeCases = [
  "SELECT * FROM SCARR WHERE carrname LIKE '%Air%'",
  "SELECT * FROM SCARR WHERE carrname LIKE '%Airlines%'",
  "SELECT * FROM SAIRPORT WHERE name LIKE '%Airport%'",
  "SELECT * FROM SAIRPORT WHERE name LIKE '%International%'",
  "SELECT * FROM SPFLI WHERE cityfrom LIKE '%FRANK%'",
  "SELECT * FROM SPFLI WHERE cityto LIKE '%NEW%'",
  "SELECT * FROM SCUSTOM WHERE name LIKE '%Smith%'",
  "SELECT * FROM SCUSTOM WHERE street LIKE '%Street%'",
  "SELECT * FROM SCUSTOM WHERE city LIKE '%BER%'",
  "SELECT * FROM STRAVELAG WHERE name LIKE '%Travel%'",
  "SELECT * FROM STRAVELAG WHERE street LIKE '%Street%'",
  "SELECT * FROM STRAVELAG WHERE city LIKE '%BER%'",
];

const orderCases = [
  "SELECT * FROM SCARR ORDER BY carrname",
  "SELECT * FROM SCARR ORDER BY currcode",
  "SELECT * FROM SAIRPORT ORDER BY name",
  "SELECT * FROM SAIRPORT ORDER BY time_zone",
  "SELECT * FROM SAPLANE ORDER BY planetype",
  "SELECT * FROM SAPLANE ORDER BY seatsmax",
  "SELECT * FROM SPFLI ORDER BY cityfrom",
  "SELECT * FROM SPFLI ORDER BY cityto",
  "SELECT * FROM SPFLI ORDER BY connid",
  "SELECT * FROM SFLIGHT ORDER BY fldate",
  "SELECT * FROM SFLIGHT ORDER BY price",
  "SELECT * FROM SBOOK ORDER BY bookid",
  "SELECT * FROM SBOOK ORDER BY customid",
  "SELECT * FROM SCUSTOM ORDER BY name",
  "SELECT * FROM SCUSTOM ORDER BY city",
  "SELECT * FROM STRAVELAG ORDER BY name",
  "SELECT * FROM STRAVELAG ORDER BY city",
];

const filteredOrderCases = [
  "SELECT * FROM SCARR WHERE currcode = 'USD' ORDER BY carrid",
  "SELECT * FROM SPFLI WHERE carrid = 'LH' ORDER BY connid",
  "SELECT * FROM SPFLI WHERE countryfr = 'DE' ORDER BY cityto",
  "SELECT * FROM SFLIGHT WHERE carrid = 'LH' ORDER BY fldate",
  "SELECT * FROM SFLIGHT WHERE currency = 'EUR' ORDER BY price",
  "SELECT * FROM SBOOK WHERE carrid = 'LH' ORDER BY bookid",
  "SELECT * FROM SBOOK WHERE custtype = 'B' ORDER BY customid",
  "SELECT * FROM SCUSTOM WHERE country = 'DE' ORDER BY name",
  "SELECT * FROM SCUSTOM WHERE city = 'BERLIN' ORDER BY id",
  "SELECT * FROM STRAVELAG WHERE country = 'DE' ORDER BY name",
  "SELECT * FROM STRAVELAG WHERE city = 'BERLIN' ORDER BY agencynum",
  "SELECT * FROM SAIRPORT WHERE id = 'FRA' ORDER BY name",
];

const selectCases = [
  ...baseSelectCases,
  ...topSelectCases,
  ...projectionCases,
  ...equalityCases,
  ...likeCases,
  ...orderCases,
  ...filteredOrderCases,
];

const joinCases = [
  `
SELECT a~carrid, a~carrname, b~connid, b~cityfrom, b~cityto
FROM scarr AS a
INNER JOIN spfli AS b
ON a~carrid = b~carrid
  `,

  `
SELECT a~carrid, a~connid, a~cityfrom, a~cityto, b~fldate, b~price, b~currency
FROM spfli AS a
INNER JOIN sflight AS b
ON a~carrid = b~carrid
AND a~connid = b~connid
  `,

  `
SELECT a~carrid, a~connid, a~fldate, b~bookid, b~customid
FROM sflight AS a
INNER JOIN sbook AS b
ON a~carrid = b~carrid
AND a~connid = b~connid
AND a~fldate = b~fldate
  `,

  `
SELECT a~bookid, a~customid, b~name, b~city, b~country
FROM sbook AS a
INNER JOIN scustom AS b
ON a~customid = b~id
  `,

  `
SELECT a~carrid, a~connid, a~fldate, a~planetype, b~seatsmax, b~tankcap
FROM sflight AS a
INNER JOIN saplane AS b
ON a~planetype = b~planetype
  `,

  `
SELECT a~carrid, a~carrname, b~connid, b~cityfrom, b~cityto
FROM scarr AS a
INNER JOIN spfli AS b
ON a~carrid = b~carrid
WHERE a~carrid = 'LH'
  `,
];

const blockedCases = [
  "SELECT * FROM USR02",
  "SELECT * FROM PA0001",
  "SELECT * FROM VBAK",
  "DELETE FROM SCARR",
  "UPDATE SCARR SET carrname = 'TEST'",
  "INSERT INTO SCARR VALUES (...)",
  "DROP TABLE SCARR",
];

const syntaxErrorCases = [
  "SELECT FROM SCARR",
  "SELECT * SCARR",
  "SELECT * FROM",
  "SELECT carrid, FROM SCARR",
];

test.describe("SQL Workbench - SELECT cases", () => {
  for (const [index, sql] of selectCases.entries()) {
    test(`success ${index + 1}: ${sql.slice(0, 80)}`, async ({ page }) => {
      await signInAndOpenWorkbench(page);

      await inputSql(page, sql);
      await runSql(page);

      await expectSuccess(page);
    });
  }
});

test.describe("SQL Workbench - JOIN cases", () => {
  for (const [index, sql] of joinCases.entries()) {
    test(`join success ${index + 1}: ${sql.replace(/\s+/g, " ").trim().slice(0, 80)}`, async ({
      page,
    }) => {
      await signInAndOpenWorkbench(page);

      await inputSql(page, sql.trim());
      await runSql(page);

      await expectSuccess(page);
    });
  }
});

test.describe("SQL Workbench - blocked cases", () => {
  for (const [index, sql] of blockedCases.entries()) {
    test(`blocked ${index + 1}: ${sql}`, async ({ page }) => {
      await signInAndOpenWorkbench(page);

      await inputSql(page, sql);
      await runSql(page);

      await expectBlocked(page);
    });
  }
});

test.describe("SQL Workbench - syntax error cases", () => {
  for (const [index, sql] of syntaxErrorCases.entries()) {
    test(`syntax error ${index + 1}: ${sql}`, async ({ page }) => {
      await signInAndOpenWorkbench(page);

      await inputSql(page, sql);
      await runSql(page);

      await expectSyntaxError(page);
    });
  }
});
