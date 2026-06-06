import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import Sidebar from "./_components/Sidebar";
import Header from "./_components/Header";
import AuthGuard from "./_components/AuthGuard";

export const metadata: Metadata = {
  title: "BillCore",
  description: "Universal billing system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>
          <div className="d-flex" style={{ minHeight: "100vh" }}>
            <Sidebar />
            <div className="flex-grow-1 d-flex flex-column bg-light">
              <Header />
              <main className="flex-grow-1">
                <div className="p-4">{children}</div>
              </main>
            </div>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
