import React, { useState, useEffect, useRef } from 'react';
import './Payment.css';
import { useStateValue } from './StateProvider';
import CheckoutProduct from './CheckoutProduct';
import { Link, useNavigate } from 'react-router-dom';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import CurrencyFormat from 'react-currency-format';
import { getBasketTotal } from './reducer';
import axios from './axios';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const Payment = () => {
  const [{ basket, user }, dispatch] = useStateValue();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const auth = getAuth();

  const [succeeded, setSucceeded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [disabled, setDisabled] = useState(true);
  const [clientSecret, setClientSecret] = useState(null);
  const [address, setAddress] = useState('');
  const [shippingCost, setShippingCost] = useState(0);

  const addressInputRef = useRef(null);

  // Load Google Places Autocomplete and listen for address changes.
  useEffect(() => {
    const loadAutocomplete = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          { types: ['address'] }
        );
        autocomplete.addListener('place_changed', async () => {
          const place = autocomplete.getPlace();
          const destination = place.formatted_address;
          setAddress(destination);
          console.log("is this running");
          // Call the backend to get the FedEx shipping cost
          const loc = await fetchShippingCost(destination);
          console.log("loc, ", loc);
        });
      } else {
        console.error('Google Maps API not loaded.');
      }
    };

    if (!window.google || !window.google.maps) {
      window.addEventListener('load', loadAutocomplete);
    } else {
      loadAutocomplete();
    }
  }, []);

  // Fetch shipping cost from the backend using FedEx API.
  const fetchShippingCost = async (destination) => {
    try {
      const token = await auth.currentUser.getIdToken(true);
      const response = await axios.get(
        `/shipping/cost?address=${encodeURIComponent(destination)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const fedexShippingCost = response.data.shippingCost;
      setShippingCost(fedexShippingCost);
    } catch (err) {
      console.error('Error fetching shipping cost:', err);
      setShippingCost(0);
    }
  };

  // Create or update PaymentIntent once basket, address, or shipping cost changes.
  useEffect(() => {
    const getClientSecret = async () => {
      if (!user || !address) return;
      // Calculate the total in cents (basket total + shipping cost)
      const total = getBasketTotal(basket) * 100 + Math.round(shippingCost * 100);
      try {
        const token = await auth.currentUser.getIdToken(true);
        // Pass both total and address so the backend can recalc if needed.
        const response = await axios.post(
          `/payments/create?total=${total}&address=${encodeURIComponent(address)}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setClientSecret(response.data.clientSecret);
      } catch (err) {
        console.error('Error fetching client secret:', err);
      }
    };

    if (basket?.length > 0 && address) {
      getClientSecret();
    }
  }, [basket, auth, user, shippingCost, address]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address) {
      setError('Please enter a valid address.');
      return;
    }

    setProcessing(true);
    try {
      const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      // Save order details (including shipping cost) to Firestore
      const orderRef = doc(db, 'users', user?.uid, 'orders', paymentIntent.id);
      await setDoc(orderRef, {
        basket: basket,
        amount: paymentIntent.amount,
        created: paymentIntent.created,
        address: address,
        shippingCost: shippingCost,
      });

      dispatch({ type: 'EMPTY_BASKET' });
      setSucceeded(true);
      setError(null);
      setProcessing(false);
      navigate('/orders', { replace: true });
    } catch (err) {
      console.error('Error confirming card payment:', err);
      setError(err.message);
      setProcessing(false);
    }
  };

  const handleChange = (event) => {
    setDisabled(event.empty);
    setError(event.error ? event.error.message : '');
  };

  return (
    <div className="payment">
      <div className="payment__container">
        <h1>
          Checkout <Link to="/checkout">({basket?.length} items)</Link>
        </h1>

        {/* Delivery Address Section */}
        <div className="payment__section">
          <div className="payment__title">
            <h3>Delivery Address</h3>
          </div>
          <div className="payment__address">
            <input
              type="text"
              placeholder="Enter your address"
              ref={addressInputRef}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>

        {/* Shipping Cost Display */}
        <div className="payment__section">
          <div className="payment__title">
            <h3>Shipping Cost</h3>
          </div>
          <div className="payment__shipping">
            <p>Estimated Shipping Cost: ${shippingCost}</p>
          </div>
        </div>

        {/* Review Items Section */}
        <div className="payment__section">
          <div className="payment__title">
            <h3>Review Items</h3>
          </div>
          <div className="payment__items">
            {basket.map((item) => (
              <CheckoutProduct
                key={item.id}
                id={item.id}
                title={item.title}
                image={item.image}
                price={item.price}
              />
            ))}
          </div>
        </div>

        {/* Payment Method Section */}
        <div className="payment__section">
          <div className="payment__title">
            <h3>Payment Method</h3>
          </div>
          <div className="payment__details">
            <form onSubmit={handleSubmit}>
              <CardElement onChange={handleChange} />
              <div className="payment__priceContainer">
                <CurrencyFormat
                  renderText={(value) => <h3>Order Total: {value}</h3>}
                  decimalScale={2}
                  // Note: Adding shippingCost to basket total
                  value={getBasketTotal(basket) + shippingCost}
                  displayType={'text'}
                  thousandSeparator={true}
                  prefix={'$'}
                />
                <button disabled={processing || disabled || succeeded}>
                  <span>{processing ? <p>Processing</p> : 'Buy Now'}</span>
                </button>
              </div>
              {error && <div className="payment__error">{error}</div>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
