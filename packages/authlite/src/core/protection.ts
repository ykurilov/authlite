/** Общие ответы защиты для всех переходников. */
export function unauthorizedResponse(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export function loginRedirectPath(loginPath: string, returnTo: string): string {
  return `${loginPath}?next=${encodeURIComponent(returnTo)}`;
}
