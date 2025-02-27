import React from 'react';
import "./Product.css";
import { useStateValue } from "./StateProvider";

const Product = ({ title, image, price, rating, id }) => {
  const [{ basket }, dispatch] = useStateValue();

  const addToBasket = () => {
    dispatch({
      type: "ADD_TO_BASKET",
      item: {
        id: id,
        title: title,
        image: image,
        price: price,
        rating: rating,
      },
    });
  };

  return (
    <div className="product">
      <img src={image} alt={title} />
      <div className="product__info">
        <div className="product__text">
          <p className="product__title">{title}</p>
          <p className="product__price">
            <small>$</small>
            <strong>{price}</strong>
            <small className="product__shipping"> + shipping</small>
          </p>
          <div className="product__rating">
            {Array(rating)
              .fill()
              .map((_, i) => (
                <span key={i}>⭐</span>
              ))}
          </div>
        </div>
        <button className="product__button" onClick={addToBasket}>
          Add to Cart
        </button>
      </div>
    </div>
  );
};

export default Product;
