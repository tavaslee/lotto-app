import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazyWithReload } from "@/lib/lazyWithReload";
import NotFound from "@/pages/NotFound";
import { Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { TrafficTracker } from "./components/site/TrafficTracker";

const Admin = lazyWithReload(
  () => import("./pages/Admin"),
  "caishen:admin-chunk-reload",
);

function AdminRoute() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-stone-950 text-sm font-bold text-stone-400">
          正在載入管理後台…
        </div>
      }
    >
      <Admin />
    </Suspense>
  );
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin"} component={AdminRoute} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <TrafficTracker />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
