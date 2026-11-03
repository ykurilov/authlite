import { expect, test, type Page } from "@playwright/test";
import { exampleByName, lastResetLinkFor } from "./examples";

const PASSWORD = "first-password-1";
const NEW_PASSWORD = "second-password-2";

let ipCounter = 0;
/**
 * Свой адрес подключения на каждый тест: ограничение частоты считает попытки по адресу,
 * а в жизни его передаёт nginx в X-Forwarded-For.
 */
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.77.${testInfo.workerIndex}.${ipCounter}` });
});

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signUp(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
}

test("история 1–2: регистрация, защищённая страница, выход, вход, сессия после перезапуска браузера", async ({ page, browser, baseURL }) => {
  const email = uniqueEmail("story");

  // Без входа защищённая страница отправляет на вход и помнит, куда вернуться.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  expect((await page.request.get("/api/notes")).status()).toBe(401);

  await page.getByRole("link", { name: "Зарегистрироваться" }).click();
  await expect(page).toHaveURL(/\/signup\?next=%2Fdashboard$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("current-email")).toHaveText(email);
  await expect(page.getByTestId("notes")).toBeVisible();

  // Сессия переживает перезапуск браузера.
  const saved = await page.context().storageState();
  const restarted = await browser.newContext({ storageState: saved, baseURL });
  const restartedPage = await restarted.newPage();
  await restartedPage.goto("/dashboard");
  await expect(restartedPage.getByTestId("current-email")).toHaveText(email);
  await restarted.close();

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);

  await signIn(page, email, "wrong-password");
  await expect(page.getByText("Неверный email или пароль")).toBeVisible();
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("current-email")).toHaveText(email);
});

test("история 3: сброс пароля по ссылке из журнала, повторная ссылка — «устарела»", async ({ page }, testInfo) => {
  const example = exampleByName(testInfo.project.name);
  const email = uniqueEmail("reset");
  await signUp(page, email);
  await expect(page).toHaveURL(/\/$|\/dashboard$/);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByRole("link", { name: "Забыли пароль?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Отправить ссылку" }).click();
  await expect(page.getByText("Если такой адрес зарегистрирован, мы отправили письмо")).toBeVisible();

  let link: string | null = null;
  await expect.poll(() => (link = lastResetLinkFor(example, email))).not.toBeNull();
  await page.goto(link!);
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel("Новый пароль").fill(NEW_PASSWORD);
  await page.getByLabel("Повторите пароль").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1$/);
  await expect(page.getByText("Пароль изменён. Войдите с новым паролем.")).toBeVisible();

  await signIn(page, email, PASSWORD);
  await expect(page.getByText("Неверный email или пароль")).toBeVisible();
  await signIn(page, email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/$|\/dashboard$/);

  await page.goto(link!);
  await expect(page.getByText("Ссылка устарела")).toBeVisible();
  await page.getByRole("link", { name: "Запросить новую" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("вид экрана входа: светлая и тёмная тема, телефон", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "next", "экраны общие для обоих примеров — снимаем один раз");
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("login-light.png") });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: testInfo.outputPath("login-dark.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({ path: testInfo.outputPath("login-mobile.png") });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
