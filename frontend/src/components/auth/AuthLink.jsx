import { Link, useLocation } from "react-router";

/**
 * A link to /login or /signup that opens the card over the current page.
 *
 * The route still changes — the URL is what makes the card shareable and lets
 * the back button close it — but the page underneath is carried along in
 * location state so React Router keeps rendering it. Without this the landing
 * page would remount behind the card and throw the reader back to the top.
 *
 * Arriving at /login any other way (a bookmark, a confirmation email) has no
 * page to carry, and App falls back to rendering the landing page underneath.
 */
export default function AuthLink({ to, children, ...props }) {
  const location = useLocation();

  return (
    <Link to={to} state={{ ...location.state, background: location }} {...props}>
      {children}
    </Link>
  );
}
