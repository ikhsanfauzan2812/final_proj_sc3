import type { Metadata } from "next";
import "./globals.css";

import Sidebar from "../components/Sidebar";

export const metadata: Metadata = {
  title: "Compact Smart Climate Controller",
  description: "Advanced IoT Monitoring & Automation Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.onerror = function(message, source, lineno, colno, error) {
            var errDiv = document.createElement('div');
            errDiv.style.position = 'fixed';
            errDiv.style.top = '0';
            errDiv.style.left = '0';
            errDiv.style.width = '100%';
            errDiv.style.background = 'red';
            errDiv.style.color = 'white';
            errDiv.style.zIndex = '9999';
            errDiv.style.padding = '20px';
            errDiv.style.fontSize = '14px';
            errDiv.innerHTML = 'Global Error: ' + message + '<br>Source: ' + source + '<br>Line: ' + lineno;
            document.body.appendChild(errDiv);
          };
        `}} />
      </head>
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
