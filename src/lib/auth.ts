import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export function createAuth(allowSignUp = false) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    // Share production auth limits across serverless instances.
    rateLimit: { storage: "database" },
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      minPasswordLength: 12,
      autoSignIn: false,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "engineer", input: false },
        active: { type: "boolean", required: false, defaultValue: true, input: false },
      },
    },
  });
}

export const auth = createAuth();
