import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Research Agent Canvas',
  description: 'Visual multi-agent AI system for collaborative scientific paper analysis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
