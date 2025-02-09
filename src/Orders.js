import React, { useState, useEffect } from 'react';
import './Orders.css';
import { useStateValue } from './StateProvider';
import { db } from './firebase';
import Order from './Order.js';

// Import Firestore v9+ methods
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [{ user }] = useStateValue();

  useEffect(() => {
    if (user) {
      // 1. Create a reference to the "orders" subcollection for the current user
      const ordersRef = collection(db, 'users', user.uid, 'orders');

      // 2. Create a query object to order by the 'created' field (descending)
      const q = query(ordersRef, orderBy('created', 'desc'));

      // 3. Subscribe to real-time updates with onSnapshot
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setOrders(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            data: doc.data(),
          }))
        );
      });

      // Cleanup subscription on unmount
      return () => unsubscribe();
    } else {
      // If no user is logged in, clear any previous orders
      setOrders([]);
    }
  }, [user]);

  return (
    <div className="orders">
      <h1>Your Orders</h1>
      <div className="orders__order">
        {orders?.map((order) => (
          <Order key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
};

export default Orders;
