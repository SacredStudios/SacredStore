import './App.css';
import Header from './Header';
import Home from "./Home";
import Checkout from "./Checkout";
import Login from "./Login";
import Payment from "./Payment"
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { auth } from './firebase';
import { useStateValue } from "./StateProvider";

const Layout = () => {
  const location = useLocation();

  return (
    <div className="app">
      {location.pathname !== '/login' && <Header />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/" element={<Home />} />
      </Routes>
    </div>
  );
}

const App = () => {
  const[{}, dispatch] = useStateValue();
  useEffect(() => {
    auth.onAuthStateChanged(authUser => {
      console.log("User: ", authUser);

      if (authUser) {
        dispatch({
          type: "SET_USER",
          user: authUser,
        })
      }
      else {
        dispatch({
          type: "SET_USER",
          user: null,
        })
      }
    })
  }, [])
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
