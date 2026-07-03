import Credentials from '@auth/express/providers/credentials';
import Google from '@auth/express/providers/google';
import bcrypt from 'bcryptjs';
import pool from './db';

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        console.log('[Auth Debug] Authorize start. Credentials received:', { email: credentials?.email, hasPassword: !!credentials?.password });
        if (!credentials?.email || !credentials?.password) {
          console.log('[Auth Debug] Authorize failed: Missing email or password');
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          const [rows] = await pool.query(
            'SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
            [email]
          );
          const users = rows as any[];
          console.log('[Auth Debug] Authorize: DB users found:', users.length);

          if (users.length === 0) {
            console.log('[Auth Debug] Authorize failed: User not found in DB');
            return null;
          }

          const user = users[0];

          // Compare hashed password (make sure password_hash is not null)
          if (!user.password_hash) {
            console.log('[Auth Debug] Authorize failed: User password_hash is null (OAuth user?)');
            return null;
          }

          const isPasswordValid = await bcrypt.compare(password, user.password_hash);
          console.log('[Auth Debug] Authorize: Password valid:', isPasswordValid);
          if (!isPasswordValid) {
            return null;
          }

          const userObj = {
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
          };
          console.log('[Auth Debug] Authorize success! Returning user object:', userObj);
          return userObj;
        } catch (error) {
          console.error('Error in Auth authorize:', error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' as const },
  callbacks: {
    async jwt({ token, user, account }: any) {
      console.log('[Auth Debug] JWT Callback start:', { token: { id: token.id, email: token.email, role: token.role }, user, account: account ? { provider: account.provider } : null });
      if (user) {
        if (account && account.provider !== 'credentials') {
          try {
            // Check if the OAuth user already exists in the database
            const [rows] = await pool.query(
              'SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
              [user.email]
            );
            const dbUsers = rows as any[];
            console.log('[Auth Debug] DB query result:', dbUsers);

            if (dbUsers.length > 0) {
              const dbUser = dbUsers[0];
              token.role = dbUser.role;
              token.id = String(dbUser.id);
              console.log('[Auth Debug] JWT role set to DB role:', token.role);
            } else {
              // User doesn't exist, register them in the users table with default role_id = 1 (retail_client)
              const [result] = await pool.query(
                'INSERT INTO users (name, email, password_hash, role_id, auth_provider) VALUES (?, ?, NULL, 1, ?)',
                [user.name || 'Google User', user.email, account.provider]
              );
              const insertId = (result as any).insertId;
              token.role = 'retail_client';
              token.id = String(insertId);
              console.log('[Auth Debug] Created new user in DB. JWT role set to:', token.role);
            }
          } catch (error) {
            console.error('Error syncing Google user to database:', error);
            token.role = 'retail_client';
            token.id = user.id;
          }
        } else {
          // Credentials login already has these details set from authorize()
          token.role = user.role;
          token.id = user.id;
          console.log('[Auth Debug] Credentials JWT role set to:', token.role);
        }
      } else {
        console.log('[Auth Debug] JWT Callback (subsequent request), current token role:', token.role);
      }
      return token;
    },
    async session({ session, token }: any) {
      console.log('[Auth Debug] Session Callback start:', { session, token: { id: token.id, email: token.email, role: token.role } });
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      console.log('[Auth Debug] Session Callback end:', session);
      return session;
    },
  },
  secret: process.env.AUTH_SECRET || 'a-very-secure-secret-key-at-least-32-characters-long',
};
