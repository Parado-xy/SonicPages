import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

import { prisma } from "@/lib/prisma";
import { parseServerEnvironment } from "@/lib/env";

const environment = parseServerEnvironment(process.env);
const emailEnabled = Boolean(environment.RESEND_API_KEY && environment.EMAIL_FROM);
const googleEnabled = Boolean(environment.AUTH_GOOGLE_ID && environment.AUTH_GOOGLE_SECRET);

export const auth = betterAuth({
  appName: "SonicPages",
  secret: environment.AUTH_SECRET,
  baseURL: environment.NEXT_PUBLIC_APP_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  advanced: {
    database: { generateId: false },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: environment.AUTH_GOOGLE_ID!,
          clientSecret: environment.AUTH_GOOGLE_SECRET!,
        },
      }
    : {},
  plugins: [
    ...(emailEnabled
      ? [
          magicLink({
            sendMagicLink: async ({ email, url }) => {
              const resend = new Resend(environment.RESEND_API_KEY);
              const { error } = await resend.emails.send({
                from: environment.EMAIL_FROM!,
                to: email,
                subject: "Your SonicPages sign-in link",
                text: `Sign in to SonicPages: ${url}\n\nThis link expires shortly. If you did not request it, you can ignore this email.`,
              });

              if (error) {
                throw new Error("Unable to send the sign-in email.");
              }
            },
          }),
        ]
      : []),
    nextCookies(),
  ],
});
