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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [shippingCost, setShippingCost] = useState(0); // in dollars
  const [finalTotal, setFinalTotal] = useState(0);
  const [backendLoading, setBackendLoading] = useState(false);
  const [shippingCostLoading, setShippingCostLoading] = useState(false);
  const [ccEnabled, setCcEnabled] = useState(false);

  const addressInputRef = useRef(null);

  // Helper to detect "outside the US"
  const isOutsideUS = (addr) => {
    const lower = addr.toLowerCase();
    if (lower.includes("united states") || lower.includes("usa")) {
      return false;
    }
    return true;
  };

  // On mount, check sessionStorage for a stored delivery address
  useEffect(() => {
    const storedAddress = sessionStorage.getItem("deliveryAddress");
    if (storedAddress) {
      setAddress(storedAddress);
      sessionStorage.removeItem("deliveryAddress");
    }
  }, []);

  // Debounced address => fetch shipping cost
  useEffect(() => {
    if (address.trim() !== '') {
      const timer = setTimeout(() => {
        fetchShippingCost(address);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [address]);

  // Enable CC only after 5 seconds, if we have a valid address and non-empty basket
  useEffect(() => {
    if (address.trim() && basket?.length > 0) {
      setCcEnabled(false);
      const timer = setTimeout(() => {
        setCcEnabled(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setCcEnabled(false);
    }
  }, [address, basket]);

  // Google Places Autocomplete
  useEffect(() => {
    const loadAutocomplete = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          { types: ['address'] }
        );
        autocomplete.addListener('place_changed', async () => {
          const place = autocomplete.getPlace();
          const dest = place.formatted_address;
          setAddress(dest);
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
    setShippingCostLoading(true);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const resp = await axios.get(
        `/shipping/cost?address=${encodeURIComponent(dest)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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

  // Update PaymentIntent whenever basket, address, or shipping changes
  useEffect(() => {
    const getClientSecret = async () => {
      setBackendLoading(true);
      const totalInCents = getBasketTotal(basket) * 100;
      try {
        const token = await auth.currentUser.getIdToken(true);
        const resp = await axios.post(
          `/payments/create?total=${totalInCents}&address=${encodeURIComponent(address)}`,
          { basket },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setClientSecret(resp.data.clientSecret);

        // finalTotal in USD = (baseAmount + shippingCost) / 100
        const finalInCents = resp.data.baseAmount + resp.data.shippingCost;
        setFinalTotal(finalInCents / 100);
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
  
    // If outside the US, phone number is required
    if (isOutsideUS(address) && !phoneNumber.trim()) {
      setError('Phone number is required for international shipments.');
      return;
    }
  
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
      // 1) Confirm the payment with Stripe
      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
          },
        }
      );
  
      // 2) If Stripe returned an error object, treat as failed.
      if (stripeError) {
        throw new Error(`Stripe payment error: ${stripeError.message}`);
      }
      
      // 3) If paymentIntent is missing or status is not 'succeeded',
      //    we consider it a failure. (Adjust if you want to allow 'processing'.)
      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        throw new Error(
          `Payment was not successful. Status: ${paymentIntent?.status || "N/A"}`
        );
      }
  
      // 4) At this point, we know the payment truly succeeded.
      //    Next, attempt to send the order email:
      const token = await auth.currentUser.getIdToken(true);
      await axios.post(
        `/payments/notify?address=${encodeURIComponent(address)}&phone=${encodeURIComponent(phoneNumber)}`,
        { basket },
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      // 5) Since email was sent successfully, write order to Firestore
      const orderRef = doc(db, 'users', user?.uid, 'orders', paymentIntent.id);
      await setDoc(orderRef, {
        basket,
        amount: paymentIntent.amount,  // in cents
        created: paymentIntent.created,
        address,
        shippingCost,
        phoneNumber,
      });
  
      // 6) Mark as succeeded in the UI
      dispatch({ type: 'EMPTY_BASKET' });
      setSucceeded(true);
      setError(null);
      setProcessing(false);
      navigate('/orders', { replace: true });
  
    } catch (err) {
      console.error('Error during payment or email:', err);
  
      // 7) Show failure message, preserve address in sessionStorage if you want
      window.alert("Order failed. Please check your details and try again.");
      sessionStorage.setItem("deliveryAddress", address);
  
      // Optional: window.location.reload() or a less disruptive approach
      window.location.reload();
  
      setProcessing(false);
    }
  };
  
  

  const handleChange = (event) => {
    setCardEmpty(event.empty);
    setError(event.error ? event.error.message : '');
  };

  // Hide the CC form if:
  //  (1) ccEnabled is false (i.e. haven't waited 5s or no valid address/basket)
  //  (2) or user is outside the US and hasn't put in phone number
  const hideCcForm =
    !ccEnabled || (isOutsideUS(address) && !phoneNumber.trim());

  return (
    <div className="payment">
      <div className="payment__container">
        <h1>
          Checkout <Link to="/checkout">({basket?.length} items)</Link>
        </h1>

        {/* Delivery Address */}
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

        {/* If outside the US => request phone number */}
        {isOutsideUS(address) && (
          <div className="payment__section">
            <div className="payment__title">
              <h3>Phone Number (Required for International Shipping)</h3>
            </div>
            <div className="payment__address">
              <input
                type="tel"
                placeholder="e.g. +44 20 7946 0018"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Shipping Cost */}
        <div className="payment__section">
          <div className="payment__title">
            <h3>Shipping Cost</h3>
          </div>
          <div className="payment__shipping">
            <p>
              Shipping: $
              {shippingCost != null
                ? Number(shippingCost).toFixed(2)
                : '0.00'}
              {shippingCostLoading && ' (loading...)'}
            </p>
          </div>
        </div>

        {/* Review Items */}
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

        {/* Payment Method */}
        {basket?.length > 0 && address.trim() !== '' && (
          <div className="payment__section">
            <div className="payment__title">
              <h3>Payment Method</h3>
            </div>
            <div className="payment__details">
              {hideCcForm ? (
                <div className="payment__loading">
                  {/* Customize any text you want here */}
                  {isOutsideUS(address) && !phoneNumber.trim()
                    ? 'Please provide your phone number for international shipping.'
                    : 'Loading...'}
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <CardElement
                    options={{
                      disabled: !ccEnabled || basket?.length === 0,
                    }}
                    onChange={handleChange}
                  />
                  <div className="payment__priceContainer">
                    <CurrencyFormat
                      renderText={(value) => <h3>Total: {value}</h3>}
                      decimalScale={2}
                      value={finalTotal}
                      displayType="text"
                      thousandSeparator
                      prefix="$"
                    />
                    <button
                      disabled={
                        processing ||
                        cardEmpty ||
                        succeeded ||
                        backendLoading ||
                        shippingCostLoading ||
                        !address.trim() ||
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
        )}
      </div>
    </div>
  );
};

export default Payment;
