import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Sell } from "./pages/Sell";
import { ItemDetail } from "./pages/ItemDetail";
import { MyListings } from "./pages/MyListings";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/sell" element={<Sell />} />
        <Route path="/item/:id" element={<ItemDetail />} />
        <Route path="/my" element={<MyListings />} />
      </Route>
    </Routes>
  );
}
