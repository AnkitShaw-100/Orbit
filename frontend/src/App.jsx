import { BrowserRouter, Routes, Route, useLocation } from "react-router";
import AppShell from "./components/app/AppShell";
import RequireAuth from "./components/app/RequireAuth";
import CustomCursor from "./components/CustomCursor";
import ScrollToHash from "./components/ScrollToHash";
import Dashboard from "./pages/app/Dashboard";
import Markets from "./pages/app/Markets";
import Profile from "./pages/app/Profile";
import Settings from "./pages/app/Settings";
import Trade from "./pages/app/Trade";
import Transactions from "./pages/app/Transactions";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Theme from "./pages/Theme";

/**
 * Signing in is a card over the page you were on, not a page of its own.
 *
 * /login and /signup are still real routes — the URL is what makes the card
 * survive a refresh, close on the back button, and be somewhere a confirmation
 * email can land. AuthLink carries the page you left in location state, and
 * this renders that page underneath while the card sits on top. Arriving with
 * no page to carry falls back to the landing page as the backdrop, so the card
 * never opens over an empty screen.
 */
function Routing() {
  const location = useLocation();
  const background = location.state?.background;

  return (
    <>
      <ScrollToHash />

      <Routes location={background ?? location}>
        <Route path="/" element={<Home />} />

        <Route
          path="/login"
          element={
            <>
              <Home />
              <Login />
            </>
          }
        />
        <Route
          path="/signup"
          element={
            <>
              <Home />
              <Signup />
            </>
          }
        />

        {/* Everything behind the login wall shares the sidebar and top bar. */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="/theme" element={<Theme />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {background && (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <Routing />
    </BrowserRouter>
  );
}

export default App;
