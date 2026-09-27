-- ============================================================================
-- ShopHunt schema (MySQL 8) — training target. FAKE data only.
-- Loaded automatically by the mysql container on first start.
-- ============================================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS shophunt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shophunt;

-- Users -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          ENUM('customer','seller','admin') NOT NULL DEFAULT 'customer',
  avatar_url    VARCHAR(1024) DEFAULT NULL,
  bio           TEXT DEFAULT NULL,
  phone         VARCHAR(64) DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Products --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  seller_id    INT NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  price_cents  INT NOT NULL DEFAULT 0,
  category     VARCHAR(128) DEFAULT 'general',
  image_url    VARCHAR(1024) DEFAULT NULL,
  stock        INT NOT NULL DEFAULT 0,
  rating_avg   DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (category),
  INDEX (seller_id),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- Reviews ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT NOT NULL,
  user_id     INT NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  rating      TINYINT NOT NULL DEFAULT 5,
  body        TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (product_id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Carts (one open cart per user) ---------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cart_id    INT NOT NULL,
  product_id INT NOT NULL,
  quantity   INT NOT NULL DEFAULT 1,
  INDEX (cart_id),
  CONSTRAINT fk_cartitems_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cartitems_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Coupons ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  code     VARCHAR(64) NOT NULL UNIQUE,
  kind     ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  value    INT NOT NULL DEFAULT 0,           -- percent (0-100) or fixed cents
  active   TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Orders ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  subtotal_cents INT NOT NULL DEFAULT 0,
  discount_cents INT NOT NULL DEFAULT 0,
  total_cents   INT NOT NULL DEFAULT 0,
  status        ENUM('pending','paid','shipped','cancelled') NOT NULL DEFAULT 'paid',
  coupon_code   VARCHAR(64) DEFAULT NULL,
  ship_name     VARCHAR(255) DEFAULT NULL,
  ship_address  VARCHAR(1024) DEFAULT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  order_id        INT NOT NULL,
  product_id      INT NOT NULL,
  title           VARCHAR(255) NOT NULL,
  quantity        INT NOT NULL DEFAULT 1,
  unit_price_cents INT NOT NULL DEFAULT 0,
  INDEX (order_id),
  CONSTRAINT fk_orderitems_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Support tickets -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT DEFAULT NULL,
  email      VARCHAR(255) DEFAULT NULL,
  subject    VARCHAR(255) NOT NULL,
  body       TEXT,
  status     ENUM('open','closed') NOT NULL DEFAULT 'open',
  admin_seen TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (status)
);

-- Password reset OTPs ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  otp        VARCHAR(12) NOT NULL,
  used       TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users(id)
);
