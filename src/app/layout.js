import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import ConditionalLayout from "./ConditionalLayout";
import { TenantProvider } from "./providers/TenantProvider";

export const metadata = {
  title: "Digital Twin Dashboard",
  description: "Dummy twin dashboard (Realtime + History)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <TenantProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </TenantProvider>
      </body>
    </html>
  );
}
