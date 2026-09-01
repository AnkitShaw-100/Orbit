import { Navigate } from "react-router";
import AuthDialog from "@/components/auth/AuthDialog";
import { useAuth } from "@/context/authContext";

export default function Signup() {
  const { session, loading } = useAuth();

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  return <AuthDialog mode="signup" />;
}
