import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import ProductsPage from './pages/ProductsPage';
import OrdersPage   from './pages/OrdersPage';
import UsersPage    from './pages/UsersPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="header">
          <div className="header-inner">
            <span className="logo">⚡ CDK Demo</span>
            <nav className="nav">
              <NavLink to="/"        end className={({ isActive }) => isActive ? 'active' : ''}>Products</NavLink>
              <NavLink to="/orders"      className={({ isActive }) => isActive ? 'active' : ''}>Orders</NavLink>
              <NavLink to="/users"       className={({ isActive }) => isActive ? 'active' : ''}>Users</NavLink>
            </nav>
            <span className="stack-badge">Lambda · DynamoDB · S3 · CloudFront</span>
          </div>
        </header>

        <main className="main">
          <Routes>
            <Route path="/"       element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage   />} />
            <Route path="/users"  element={<UsersPage    />} />
          </Routes>
        </main>

        <footer className="footer">
          Built with AWS CDK · React · Node.js Lambdas
        </footer>
      </div>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
