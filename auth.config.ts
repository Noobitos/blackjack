import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = auth?.user?.role === "ADMIN";
      const pathname = nextUrl.pathname;

      const publicPaths = ["/login", "/register"];
      if (publicPaths.includes(pathname)) {
        if (isLoggedIn) return Response.redirect(new URL("/lobby", nextUrl));
        return true;
      }

      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      if (pathname.startsWith("/admin") && !isAdmin) {
        return Response.redirect(new URL("/lobby", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.name = token.name as string;
      return session;
    },
  },
};
