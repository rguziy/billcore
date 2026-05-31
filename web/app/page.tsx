import Link from "next/link";

export default function Dashboard() {
  const cards = [
    { href: "/clients",      icon: "bi-people",      label: "Clients",      color: "#1a56db" },
    { href: "/locations",    icon: "bi-geo-alt",     label: "Locations",    color: "#dc2626" },
    { href: "/subscriptions", icon: "bi-link-45deg", label: "Subscriptions", color: "#f59e0b" },
    { href: "/services",     icon: "bi-grid",        label: "Services",     color: "#0891b2" },
    { href: "/calculations", icon: "bi-calculator",  label: "Calculations", color: "#7c3aed" },
    { href: "/payments",     icon: "bi-credit-card", label: "Payments",     color: "#059669" },
  ];

  return (
    <>
      <div className="bc-page-header">
        <h1>Dashboard</h1>
      </div>
      <div className="row g-3">
        {cards.map((c) => (
          <div key={c.href} className="col-sm-6 col-lg-3 col-xl">
            <Link href={c.href} className="text-decoration-none">
              <div className="bc-card d-flex align-items-center gap-3" style={{ cursor: "pointer" }}>
                <div
                  style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: c.color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <i className={`bi ${c.icon}`} style={{ fontSize: "1.4rem", color: c.color }} />
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Go to
                  </div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{c.label}</div>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
