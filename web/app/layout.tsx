import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import Sidebar from "./_components/Sidebar";

export const metadata: Metadata = {
  title: "BillCore",
  description: "Universal billing system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="d-flex" style={{ minHeight: "100vh" }}>
          <Sidebar />
          <main className="flex-grow-1 bg-light">
            <div className="p-4">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
