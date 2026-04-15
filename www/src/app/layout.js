import { ClerkProvider } from "@clerk/nextjs";

import ToastProvider from "@/components/ToastProvider";
import "./globals.css";

export const metadata = {
  title: "ICONIP 2026: CTF",
  description: "ICONIP 2026 CTF demo platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ClerkProvider taskUrls={{ 'setup-mfa': '/setup-mfa' }}>
          {children}
          <ToastProvider />
        </ClerkProvider>
      </body>
    </html>
  );
}
