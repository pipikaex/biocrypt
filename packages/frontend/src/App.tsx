import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Wallet } from "./pages/Wallet";
import { Mine } from "./pages/Mine";
import { Transfer } from "./pages/Transfer";
import { Network } from "./pages/Network";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/mine" element={<Mine />} />
        <Route path="/transfer" element={<Transfer />} />
        <Route path="/network" element={<Network />} />
      </Route>
    </Routes>
  );
}
