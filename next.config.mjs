import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";

// Ensure IPv4 is prioritized across all operating systems (Linux, macOS, Windows)
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore in environments where not supported
}

// Socket family patch for environments with broken IPv6 routing
const patchFamily = (orig) => {
  if (typeof orig !== "function") return orig;
  return function (...args) {
    if (args.length > 0 && typeof args[0] === "object" && args[0] !== null) {
      if (!args[0].family) args[0].family = 4;
    } else if (args.length > 1 && typeof args[1] === "object" && args[1] !== null) {
      if (!args[1].family) args[1].family = 4;
    }
    return orig.apply(this, args);
  };
};

if (net.createConnection) net.createConnection = patchFamily(net.createConnection);
if (tls.connect) tls.connect = patchFamily(tls.connect);

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
