-- Database schema for Portfolio Website

-- Create database
CREATE DATABASE IF NOT EXISTS portfolio_db;
USE portfolio_db;

-- Portfolio items table
CREATE TABLE IF NOT EXISTS portfolio_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    image VARCHAR(500) NOT NULL,
    description TEXT,
    price VARCHAR(50),
    original_price VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Contact messages table
CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client logos table
CREATE TABLE IF NOT EXISTS client_logos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo VARCHAR(500) NOT NULL,
    url VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table for site configuration
CREATE TABLE IF NOT EXISTS site_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert sample portfolio items
INSERT INTO portfolio_items (title, category, image, description, price, original_price) VALUES
('Yellow Shoes', 'Fashion', 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&q=80', 'Stylish yellow shoes for summer', '$120.00', '$150.00'),
('Blue Shoes', 'Fashion', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80', 'Comfortable blue sneakers', '$110.00', NULL),
('Brown Shoes', 'Fashion', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&q=80', 'Classic brown leather shoes', '$130.00', NULL),
('Denim Jeans', 'Clothing', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&q=80', 'Blue denim jeans', '$95.00', NULL),
('Gray Jacket', 'Clothing', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500&q=80', 'Stylish gray jacket', '$120.00', NULL),
('Denim Shorts', 'Clothing', 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500&q=80', 'Summer denim shorts', '$75.00', '$95.00'),
('Silver Bracelet', 'Accessories', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=500&q=80', 'Elegant silver bracelet', '$60.00', NULL),
('Beaded Bracelet', 'Accessories', 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=500&q=80', 'Colorful beaded bracelet', '$40.00', NULL),
('Leather Bag', 'Bags', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80', 'Premium leather bag', '$180.00', NULL),
('Red Bag', 'Bags', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&q=80', 'Stylish red handbag', '$150.00', NULL);

-- Insert sample client logos
INSERT INTO client_logos (name, logo, display_order) VALUES
('Client 1', 'https://api.dicebear.com/7.x/avataaars/svg?seed=logo1', 1),
('Client 2', 'https://api.dicebear.com/7.x/avataaars/svg?seed=logo2', 2),
('Client 3', 'https://api.dicebear.com/7.x/avataaars/svg?seed=logo3', 3),
('Client 4', 'https://api.dicebear.com/7.x/avataaars/svg?seed=logo4', 4),
('Client 5', 'https://api.dicebear.com/7.x/avataaars/svg?seed=logo5', 5);

-- Insert site settings
INSERT INTO site_settings (setting_key, setting_value) VALUES
('site_title', 'DNK - Creative Portfolio'),
('hero_title', 'Raining Offers For Hot Summer!'),
('hero_subtitle', '25% Off On All Products'),
('hero_primary_cta', 'Shop Now'),
('hero_secondary_cta', 'Find More'),
('hero_background_image', 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80'),
('feature_banner_title', 'Special Edition Designs'),
('feature_banner_description', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo. Consectetur adipiscing elit.'),
('feature_banner_discount_code', 'ART20'),
('feature_banner_button_text', 'Buy Now'),
('feature_banner_image', 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80'),
('contact_email', 'tanmoybiswas478@gmail.com'),
('behance_url', '#'),
('copyright_text', 'Copyright © 2023 Brandstore'),
('powered_by_text', 'Powered by Brandstore');
