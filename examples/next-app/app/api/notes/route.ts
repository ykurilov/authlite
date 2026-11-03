import { nextAuth } from "@/lib/auth";

export const GET = nextAuth.withUser(async (_request, user) =>
  Response.json({ owner: user.email, notes: ["Купить молоко", "Позвонить маме"] }),
);
