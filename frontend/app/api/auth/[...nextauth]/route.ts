import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
        // Сохраняем Google ID Token для валидации на FastAPI бэкенде
        token.idToken = account.id_token
      }
      if (profile?.sub) {
        token.id = profile.sub
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        // Передаем idToken в session.user
        session.user.idToken = token.idToken as string
      }
      return session
    },
  },
  pages: {
    signIn: "/",
  },
})

export { handler as GET, handler as POST }