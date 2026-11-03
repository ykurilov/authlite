import { createAuthLite } from "@ykurilov/authlite";
import { createNextAuth } from "@ykurilov/authlite/next";

export const authLite = createAuthLite();
export const nextAuth = createNextAuth(authLite);
