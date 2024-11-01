import AuthProvider from '../components/AuthProvider';
import Navbar from '../components/Navbar';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <AuthProvider>
        <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white`}>
          <Navbar />
          {children}
        </body>
      </AuthProvider>
    </html>
  );
}