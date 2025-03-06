import React, { useEffect } from 'react';
import './App.css';
import Header from './Header';
import Home from "./Home";
import Checkout from "./Checkout";
import Login from "./Login";
import Orders from "./Orders";
import Payment from "./Payment";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { useStateValue } from "./StateProvider";
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const promise = loadStripe('pk_live_51QoH15Lx9xG3paMnnC7ySSjLva7iHRYZjmJet52MKXRdiiMeNCOBVIwM7zFrJVX1RL9k757lylKmzzhLdJtvSUnE00uhDODTkQ');

// ProtectedRoute component to guard routes that require authentication
const ProtectedRoute = ({ children }) => {
  const [{ user }] = useStateValue();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const Layout = () => {
  const location = useLocation();

  return (
    <div className="app">
      {location.pathname !== '/login' && <Header />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/checkout" 
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/orders" 
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/payment" 
          element={
            <Elements stripe={promise}>
              <Payment />
            </Elements>
          } 
        />
        <Route path="/" element={<Home />} />
      </Routes>
    </div>
  );
};

const App = () => {
  const [{}, dispatch] = useStateValue();

  useEffect(() => {
    auth.onAuthStateChanged(authUser => {
      console.log("User: ", authUser);
      if (authUser) {
        dispatch({
          type: "SET_USER",
          user: authUser,
        });
      } else {
        dispatch({
          type: "SET_USER",
          user: null,
        });
      }
    });
  }, [dispatch]);

  return (
    <Router>
      <Layout />
    </Router>
  );
};

export default App;
