import { BrowserRouter, Routes, Route } from "react-router";
import AppShell from "./components/app/AppShell";
import RequireAuth from "./components/app/RequireAuth";
import CustomCursor from "./components/CustomCursor";
import Dashboard from "./pages/app/Dashboard";
import Markets from "./pages/app/Markets";
import Portfolio from "./pages/app/Portfolio";
import Profile from "./pages/app/Profile";
import Settings from "./pages/app/Settings";
import Trade from "./pages/app/Trade";
import Transactions from "./pages/app/Transactions";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Theme from "./pages/Theme";

function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

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
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="/theme" element={<Theme />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
