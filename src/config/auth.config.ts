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
        if (!credentials?.email || !credentials?.password) {
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

          if (users.length === 0) {
            return null;
          }

          const user = users[0];

          // Compare hashed password (make sure password_hash is not null)
          if (!user.password_hash) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(password, user.password_hash);
          if (!isPasswordValid) {
            return null;
          }

          // Return the user object (must include string id)
          return {
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
          };
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
      if (user) {
        if (account && account.provider !== 'credentials') {
          try {
            // Check if the OAuth user already exists in the database
            const [rows] = await pool.query(
              'SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?',
              [user.email]
            );
            const dbUsers = rows as any[];

            if (dbUsers.length > 0) {
              const dbUser = dbUsers[0];
              token.role = dbUser.role;
              token.id = String(dbUser.id);
            } else {
              // User doesn't exist, register them in the users table with default role_id = 1 (retail_client)
              const [result] = await pool.query(
                'INSERT INTO users (name, email, password_hash, role_id, auth_provider) VALUES (?, ?, NULL, 1, ?)',
                [user.name || 'Google User', user.email, account.provider]
              );
              const insertId = (result as any).insertId;
              token.role = 'retail_client';
              token.id = String(insertId);
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
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET || 'a-very-secure-secret-key-at-least-32-characters-long',
};
