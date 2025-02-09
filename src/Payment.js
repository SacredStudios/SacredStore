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
  const [address, setAddress] = useState(''); // Single-line address from autocomplete

  const addressInputRef = useRef(null);

  useEffect(() => {
    const getClientSecret = async () => {
      if (!user) return;
      const total = getBasketTotal(basket) * 100;
      try {
        const token = await auth.currentUser.getIdToken(true);
        const response = await axios.post(
          `/payments/create?total=${total}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setClientSecret(response.data.clientSecret);
      } catch (err) {
        console.error('Error fetching client secret:', err);
      }
    };
    if (basket?.length > 0) getClientSecret();
  }, [basket, auth, user]);

  useEffect(() => {
    const loadAutocomplete = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          types: ['geocode'],
        });
  
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.formatted_address) {
            setAddress(place.formatted_address);
          } else {
            setError('Invalid address. Please select a valid address.');
          }
        });
      } else {
        console.error("Google Maps API not loaded.");
      }
    };
  
    // Wait until the script is loaded
    if (!window.google || !window.google.maps) {
      window.addEventListener('load', loadAutocomplete);
    } else {
      loadAutocomplete();
    }
  }, []);
  
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

      const orderRef = doc(db, 'users', user?.uid, 'orders', paymentIntent.id);
      await setDoc(orderRef, {
        basket: basket,
        amount: paymentIntent.amount,
        created: paymentIntent.created,
        address: address, // Save the formatted address from Google Places
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

        {/* Address Input with Autocomplete */}
        <div className="payment__section">
          <div className="payment__title">
            <h3>Delivery Address</h3>
          </div>
          <div className="payment__address">
            This is a test
            <input
              type="text"
              placeholder="Enter your address"
              ref={addressInputRef}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
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
                  value={getBasketTotal(basket)}
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
