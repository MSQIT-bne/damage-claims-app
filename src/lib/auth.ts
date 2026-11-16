import NextAuth from "next-auth";
import AzureAD from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        session.user.role = dbUser?.role ?? "CLAIMS_STAFF";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
});

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
};

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}
