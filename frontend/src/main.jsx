import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthProvider";
import "./index.css";
import App from "./App.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * Retry once, but never a refusal the server meant.
       *
       * A 4xx says the request itself was wrong, and sending it again changes
       * nothing. That matters most for 429: an immediate retry spends another
       * token from a bucket that is already empty, so it deepens the limit it
       * is trying to escape and reports the second failure instead of the
       * first. Server errors and dropped connections are still worth one more
       * attempt, since those genuinely do come back.
       */
      retry: (failureCount, error) => {
        const status = error?.status;
        if (status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
