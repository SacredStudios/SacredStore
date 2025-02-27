import React, { createContext, useContext, useReducer, useEffect } from 'react';

export const StateContext = createContext();

export const StateProvider = ({ reducer, initialState, children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist basket to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("basket", JSON.stringify(state.basket));
  }, [state.basket]);

  return (
    <StateContext.Provider value={[state, dispatch]}>
      {children}
    </StateContext.Provider>
  );
};

export const useStateValue = () => useContext(StateContext);
