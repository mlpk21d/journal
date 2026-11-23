import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/navigation';
export const metadata: Metadata = { title: 'Trade Journal', description: 'Trading performance and wash sale monitoring' };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body><Navigation/>{children}</body></html>;
}
