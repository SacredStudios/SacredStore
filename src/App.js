import './App.css';
import Header from './Header';
import Home from "./Home";
import Checkout from "./Checkout";
import Login from "./Login";
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

const Layout = () => {
  const location = useLocation();

  return (
    <div className="app">
      {location.pathname !== '/login' && <Header />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/" element={<Home />} />
      </Routes>
    </div>
  );
}

const App = () => {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
