import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { LocaleRoot } from "@/components/locale-root";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Canopy";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Canopy by MΛZ — bilingual keyword research and SERP tracking for client websites, with scoped access and Maz•Assist agents.",
      },
      { name: "theme-color", content: "#0F1724" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Poppins:wght@600;700&family=Vazirmatn:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <PreviewHostBridge />
        <AuthProvider>
          <LocaleRoot>
            <Outlet />
          </LocaleRoot>
        </AuthProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: "!bg-raised !text-fg !border-border !font-sans !shadow-[var(--shadow-border)]",
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
