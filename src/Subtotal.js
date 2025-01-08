import React from 'react';
import CurrencyFormat from 'react-currency-format';
import "./Subtotal.css";
const Subtotal = () => {
  return (
    <div className ="subtotal">
      <CurrencyFormat
        renderText={(value) => (
            <>
                <p>
                    Subtotal (0)
                    <strong>{ ` ${value}`}</strong>
                </p>
            </>
        )}
        decimalScale={2}
        value={0}
        displayType={"text"}
        thousandSeparator={true}
        prefix={"$"}
        />
        <button>Proceed to Checkout</button>
    </div>
  ) 
}

export default Subtotal
