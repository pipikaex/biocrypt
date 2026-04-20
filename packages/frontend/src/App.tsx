import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Wallet } from "./pages/Wallet";
import { Mine } from "./pages/Mine";
import { Transfer } from "./pages/Transfer";
import { Network } from "./pages/Network";
import { HowItWorks } from "./pages/HowItWorks";
import { Economics } from "./pages/Economics";
import { Proof } from "./pages/Proof";
import { Organism } from "./pages/Organism";
import { Pay } from "./pages/Pay";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route path="/pay/:paymentId" element={<Pay />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/mine" element={<Mine />} />
        <Route path="/transfer" element={<Transfer />} />
        <Route path="/network" element={<Network />} />
        <Route path="/economics" element={<Economics />} />
        <Route path="/proof" element={<Proof />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/organism" element={<Organism />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
