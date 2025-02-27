import React, { useState, useEffect, useRef } from 'react';
import './Header.css';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import { Link } from 'react-router-dom';
import { useStateValue } from "./StateProvider";
import { auth } from './firebase';

const Header = () => {
  const [{ basket, user }, dispatch] = useStateValue();
  const [bounce, setBounce] = useState(false);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const headerRef = useRef(null);

  const handleAuthentication = () => {
    if (user) {
      auth.signOut();
    }
  };

  useEffect(() => {
    setBounce(true);
    const timer = setTimeout(() => {
      setBounce(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [basket]);

  // Start dragging: record the offset between the mouse and the header's top-left.
  const handleMouseDown = (e) => {
    setDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging && headerRef.current) {
        // Get header dimensions
        const headerWidth = headerRef.current.offsetWidth;
        const headerHeight = headerRef.current.offsetHeight;

        // Calculate new position and clamp it within the viewport
        const newX = Math.min(
          Math.max(e.clientX - offset.x, 0),
          window.innerWidth - headerWidth
        );
        const newY = Math.min(
          Math.max(e.clientY - offset.y, 0),
          window.innerHeight - headerHeight
        );

        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, offset]);

  return (
    <div 
      className="header"
      ref={headerRef}
      onMouseDown={handleMouseDown}
      style={{ position: 'absolute', left: position.x, top: position.y }}
    >
      <Link to="/">
        <img 
          className="header__logo"
          src="/logo.png"
          alt="Logo"
        />
      </Link>      
      <div className="header__nav">
        <Link to={!user && '/login'}>
          <div onClick={handleAuthentication} className="header__option">
            <span className="header__optionLineOne">
              Hello {user ? user.email.split('@')[0] : 'Guest'}
            </span>
            <span className="header__optionLineTwo">
              {user ? 'Sign Out' : 'Sign In'}
            </span>
          </div>
        </Link>
        <Link to="/orders">
          <div className="header__option">
            <span className="header__optionLineOne">Returns</span>
            <span className="header__optionLineTwo">& Orders</span>
          </div>
        </Link>
        <Link to="/checkout">
          <div className={`header__optionBasket ${bounce ? 'bounce' : ''}`}>
            <ShoppingBasketIcon />
            <span className="header__optionLineTwo header__basketCount">
              {basket?.length}
            </span>   
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Header;
