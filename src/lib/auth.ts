import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            authorization: {
                params: {
                    scope:
                        "openid email profile https://www.googleapis.com/auth/spreadsheets",
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                },
            },
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        // SEGURIDAD: Solo correos autorizados pueden iniciar sesión. Default Deny.
        async signIn({ user }) {
            // Puedes definir esta variable de entorno en tu Vercel/Local:
            // ALLOWED_EMAILS="alexi.example@gmail.com,otroautorizado@gmail.com"
            const allowedEmailsStr = process.env.ALLOWED_EMAILS || "";
            const allowedEmails = allowedEmailsStr.split(",").map(e => e.trim().toLowerCase());

            if (user.email && allowedEmails.includes(user.email.toLowerCase())) {
                return true;
            }

            console.error(`🚨 Intento de acceso bloqueado para un correo no autorizado: ${user.email}`);
            return false; // Bloquea el login si no está en la whitelist
        },
        async jwt({ token, account }) {
            // Initial sign in
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                // account.expires_at is in seconds
                token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
                return token;
            }

            // Return previous token if the access token has not expired yet
            if (Date.now() < (token.accessTokenExpires as number)) {
                return token;
            }

            // Access token has expired, try to update it
            try {
                const response = await fetch("https://oauth2.googleapis.com/token", {
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        client_id: process.env.GOOGLE_CLIENT_ID as string,
                        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
                        grant_type: "refresh_token",
                        refresh_token: token.refreshToken as string,
                    }),
                    method: "POST",
                });

                const tokens = await response.json();

                if (!response.ok) throw tokens;

                return {
                    ...token,
                    accessToken: tokens.access_token,
                    accessTokenExpires: Date.now() + tokens.expires_in * 1000,
                    // Fall back to old refresh token
                    refreshToken: tokens.refresh_token ?? token.refreshToken,
                };
            } catch (error) {
                console.error("Error refreshing access token", error);
                return {
                    ...token,
                    error: "RefreshAccessTokenError",
                };
            }
        },
        async session({ session, token }) {
            // @ts-expect-error property does not bubble natively
            session.accessToken = token.accessToken;
            // @ts-expect-error property does not bubble natively
            session.error = token.error;
            return session;
        },
    },
};
