import { UserProvider } from '@auth0/nextjs-auth0/client';
import Navbar from '../components/Navbar';
import { Inter } from 'next/font/google';
import '../app/globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <UserProvider>
        <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white`}>
          <Navbar />
          {children}
        </body>
      </UserProvider>
    </html>
  );
}
