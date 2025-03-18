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
  const [cardEmpty, setCardEmpty] = useState(true);
  const [clientSecret, setClientSecret] = useState(null);
  const [address, setAddress] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [taxCalculated, setTaxCalculated] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [shippingCostLoading, setShippingCostLoading] = useState(false);
  // Controls when the payment method section is enabled (and visible)
  const [ccEnabled, setCcEnabled] = useState(false);

  const addressInputRef = useRef(null);

  // On mount, check sessionStorage for a stored delivery address.
  useEffect(() => {
    const storedAddress = sessionStorage.getItem("deliveryAddress");
    if (storedAddress) {
      setAddress(storedAddress);
      sessionStorage.removeItem("deliveryAddress");
    }
  }, []);

  // New useEffect to re-fetch shipping cost whenever address is set (e.g., on reload)
  useEffect(() => {
    if (address.trim() !== '') {
      const timer = setTimeout(() => {
        fetchShippingCost(address);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [address]);

  // Enable the credit card screen only when:
  // - A valid address is entered,
  // - The cart is not empty,
  // - And 5 seconds have passed after entering the address.
  useEffect(() => {
    if (address.trim() && basket?.length > 0) {
      setCcEnabled(false); // Disable immediately when conditions change.
      const timer = setTimeout(() => {
        setCcEnabled(true);
      }, 5000); // 5-second delay.
      return () => clearTimeout(timer);
    } else {
      setCcEnabled(false);
    }
  }, [address, basket]);

  // Initialize Google Places Autocomplete.
  useEffect(() => {
    const loadAutocomplete = () => {
      if (
        window.google &&
        window.google.maps &&
        window.google.maps.places
      ) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          { types: ['address'] }
        );
        autocomplete.addListener('place_changed', async () => {
          const place = autocomplete.getPlace();
          const dest = place.formatted_address;
          setAddress(dest);
          console.log("Autocomplete changed");
          await fetchShippingCost(dest);
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

  const fetchShippingCost = async (dest) => {
    console.log("fetchShippingCost");
    setShippingCostLoading(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const resp = await axios.get(
        `/shipping/cost?address=${encodeURIComponent(dest)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("Shipping responded", resp.data);
      if (resp.data.totalNetCharge !== undefined) {
        setShippingCost(resp.data.totalNetCharge);
      } else {
        setShippingCost(0);
      }
    } catch (err) {
      console.error('Error fetching shipping cost:', err);
      setShippingCost(0);
    } finally {
      setShippingCostLoading(false);
    }
  };

  // Update PaymentIntent client secret whenever basket, address, or shipping changes.
  useEffect(() => {
    const getClientSecret = async () => {
      setBackendLoading(true);
      const total = getBasketTotal(basket) * 100; // in cents
      try {
        const token = await auth.currentUser.getIdToken(true);
        const resp = await axios.post(
          `/payments/create?total=${total}&address=${encodeURIComponent(address)}`,
          { basket },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("Client secret resp", resp.data);
        setClientSecret(resp.data.clientSecret);
        if (resp.data.taxCalculation) {
          const taxedBase = resp.data.taxCalculation.amount_total / 100;
          setTaxAmount(resp.data.taxCalculation.tax_amount_exclusive / 100);
          setFinalTotal(taxedBase + shippingCost);
          setTaxCalculated(true);
        }
      } catch (err) {
        console.error('Error fetching client secret:', err);
      } finally {
        setBackendLoading(false);
      }
    };

    if (basket?.length > 0 && address.trim() !== '' && !shippingCostLoading) {
      const timer = setTimeout(() => {
        getClientSecret();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [basket, shippingCost, address, shippingCostLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address.trim()) {
      setError('Please enter a valid address.');
      return;
    }
    if (!clientSecret) {
      setError('Client secret not ready. Please try again.');
      return;
    }
    setProcessing(true);
    try {
      const { paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)
          }
        }
      );
      
      // If payment fails, alert the user, preserve the address, and reload.
      if (paymentIntent.status !== "succeeded") {
        window.alert("Payment failed. Please make sure all your details are correct.");
        sessionStorage.setItem("deliveryAddress", address);
        window.location.reload();
        return;
      }
      
      // Send order email only if payment succeeded.
      const token = await auth.currentUser.getIdToken(true);
      await axios.post(
        `/payments/notify?address=${encodeURIComponent(address)}&email=${encodeURIComponent(user.email)}`,
        { basket },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Save order details in Firestore.
      const orderRef = doc(db, 'users', user?.uid, 'orders', paymentIntent.id);
      await setDoc(orderRef, {
        basket,
        amount: paymentIntent.amount,
        created: paymentIntent.created,
        address,
        shippingCost,
        tax: taxAmount,
      });
      dispatch({ type: 'EMPTY_BASKET' });
      setSucceeded(true);
      setError(null);
      setProcessing(false);
      navigate('/orders', { replace: true });
    } catch (err) {
      console.error('Error confirming payment:', err);
      window.alert("Payment failed. Please make sure all your details are correct.");
      sessionStorage.setItem("deliveryAddress", address);
      window.location.reload();
      setProcessing(false);
    }
  };

  const handleChange = (event) => {
    setCardEmpty(event.empty);
    setError(event.error ? event.error.message : '');
  };

  return (
    <div className="payment">
      <div className="payment__container">
        <h1>
          Checkout <Link to="/checkout">({basket?.length} items)</Link>
        </h1>
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
        <div className="payment__section">
          <div className="payment__title">
            <h3>Shipping Cost</h3>
          </div>
          <div className="payment__shipping">
            <p>
              Shipping: ${shippingCost != null ? Number(shippingCost).toFixed(2) : '0.00'}
              {shippingCostLoading && " (loading...)"}
            </p>
          </div>
        </div>
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
        { basket?.length > 0 && address.trim() !== '' && taxCalculated ? (
          <div className="payment__section">
            <div className="payment__title">
              <h3>Payment Method</h3>
            </div>
            <div className="payment__details">
              { !ccEnabled ? (
                <div className="payment__loading">
                  Loading...
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <CardElement 
                    options={{ disabled: !ccEnabled || basket?.length === 0 }}
                    onChange={handleChange} 
                  />
                  <div className="payment__priceContainer">
                    <p>Tax: ${taxAmount.toFixed(2)}</p>
                    <p>Shipping: ${shippingCost != null ? Number(shippingCost).toFixed(2) : '0.00'}</p>
                    <CurrencyFormat
                      renderText={(value) => <h3>Total: {value}</h3>}
                      decimalScale={2}
                      value={finalTotal}
                      displayType={'text'}
                      thousandSeparator={true}
                      prefix={'$'}
                    />
                    <button
                      disabled={
                        processing ||
                        cardEmpty ||
                        succeeded ||
                        !taxCalculated ||
                        backendLoading ||
                        shippingCostLoading ||
                        !address.trim() ||
                        taxAmount === 0 ||
                        !ccEnabled ||
                        basket.length === 0
                      }
                    >
                      <span>{processing ? <p>Processing</p> : 'Buy Now'}</span>
                    </button>
                  </div>
                  {error && <div className="payment__error">{error}</div>}
                </form>
              )}
            </div>
          </div>
        ) : null }
      </div>
    </div>
  );
};

export default Payment;
