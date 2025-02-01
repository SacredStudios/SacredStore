import React from 'react'
import "./Product.css"
import { useStateValue } from "./StateProvider";
const Product = ({title, image, price, rating, id}) => {
  const [{ basket }, dispatch] = useStateValue();
  const addToBasket = () => {
    dispatch({
      type: "ADD_TO_BASKET",
      item:
      {
        id: id,
        title: title,
        image: image,
        price: price,
        rating: rating,
      }
    })
  }
  return (
    <div className="product">
      <div className = "product__info">
        {title}
            <p className="product__price">
                <small>$</small>
                <strong>{price}</strong>
            </p>
        <div class="product__rating">
            {Array(rating).fill().map((_, i) => (
                <p>★</p>
            ))}
            
        </div>
        </div>
        <img src={image}
        alt="/placeholder_product.jpg"/>
        <button onClick={addToBasket}>Add to Cart</button>
    </div>
  )
}

export default Product
