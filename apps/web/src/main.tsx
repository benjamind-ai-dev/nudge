import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { shouldRetryQuery } from "./api/client";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Never retry 4xx (esp. 429) — backing off is the fix, not more requests.
      retry: shouldRetryQuery,
      // The shared /businesses query rides every page; default staleTime:0 +
      // refetchOnWindowFocus refetched it on every nav/focus, bursting the rate
      // limiter. A sane staleTime + no focus-refetch cuts baseline volume.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing env var: VITE_CLERK_PUBLISHABLE_KEY");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
);
