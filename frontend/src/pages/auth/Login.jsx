import { Navigate } from "react-router";
import AuthDialog from "@/components/auth/AuthDialog";
import { useAuth } from "@/context/authContext";

export default function Login() {
  const { session, loading } = useAuth();

  // Already signed in — go straight through rather than opening the card.
  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return <AuthDialog mode="login" />;
}
