import "./globals.css";

export const metadata = {
  title: "Kfz-Werkstatt Dashboard",
  description: "Werkstattannahme, Termine, Fahrzeugdaten, Teile & Angebote",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
