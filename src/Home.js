import React, { useState, useEffect } from 'react';
import "./Home.css";
import Product from "./Product";
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const Home = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const colRef = collection(db, 'products');
        const snapshot = await getDocs(colRef);
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsData);
      } catch (error) {
        console.error('Error fetching products: ', error);
      }
    };

    fetchProducts();
  }, []);

  // Group products into rows of 2
  const chunkProducts = (array, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  };

  const productRows = chunkProducts(products, 2);

  return (
    <div className="home">
      <div className="home__container">
        <img 
          className="home__image"
          src="/banner.png"
          alt=""
        />
        {productRows.map((row, rowIndex) => (
          <div className="home__row" key={rowIndex}>
            {row.map(product => (
              <Product 
                key={product.id}
                id={product.id}
                title={product.Title}
                price={product.Cost}
                image={product.Token}  // Using the public URL stored in Token
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
