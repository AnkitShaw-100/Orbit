import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/context/authContext";

/**
 * Gate for every signed-in screen. While the stored session is still loading
 * it renders a placeholder rather than redirecting — otherwise a refresh on
 * /dashboard would throw a signed-in user back to the login page.
 */
export default function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink">
        <span className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <span className="sr-only">Loading your account</span>
      </div>
    );
  }

  if (!session) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
