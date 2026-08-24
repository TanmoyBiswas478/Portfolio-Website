<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

class PortfolioAPI {
    private $conn;
    
    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }
    
    // Get all portfolio items
    public function getPortfolioItems($category = null) {
        $query = "SELECT * FROM portfolio_items";
        
        if ($category && $category !== 'All') {
            $query .= " WHERE category = :category";
        }
        
        $query .= " ORDER BY created_at DESC";
        
        $stmt = $this->conn->prepare($query);
        
        if ($category && $category !== 'All') {
            $stmt->bindParam(':category', $category);
        }
        
        $stmt->execute();
        
        $items = array();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $items[] = array(
                'id' => $row['id'],
                'title' => $row['title'],
                'category' => $row['category'],
                'image' => $row['image'],
                'description' => $row['description'],
                'price' => $row['price'],
                'originalPrice' => $row['original_price']
            );
        }
        
        return $items;
    }
    
    // Get single portfolio item
    public function getPortfolioItem($id) {
        $query = "SELECT * FROM portfolio_items WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return array(
                'id' => $row['id'],
                'title' => $row['title'],
                'category' => $row['category'],
                'image' => $row['image'],
                'description' => $row['description'],
                'price' => $row['price'],
                'originalPrice' => $row['original_price']
            );
        }
        
        return null;
    }
    
    // Add new portfolio item
    public function addPortfolioItem($data) {
        $query = "INSERT INTO portfolio_items (title, category, image, description, price, original_price) 
                  VALUES (:title, :category, :image, :description, :price, :original_price)";
        
        $stmt = $this->conn->prepare($query);
        
        $stmt->bindParam(':title', $data['title']);
        $stmt->bindParam(':category', $data['category']);
        $stmt->bindParam(':image', $data['image']);
        $stmt->bindParam(':description', $data['description']);
        $stmt->bindParam(':price', $data['price']);
        $stmt->bindParam(':original_price', $data['originalPrice']);
        
        if ($stmt->execute()) {
            return array('success' => true, 'message' => 'Portfolio item added successfully');
        }
        
        return array('success' => false, 'message' => 'Failed to add portfolio item');
    }
    
    // Update portfolio item
    public function updatePortfolioItem($id, $data) {
        $query = "UPDATE portfolio_items SET 
                  title = :title, 
                  category = :category, 
                  image = :image, 
                  description = :description, 
                  price = :price, 
                  original_price = :original_price 
                  WHERE id = :id";
        
        $stmt = $this->conn->prepare($query);
        
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':title', $data['title']);
        $stmt->bindParam(':category', $data['category']);
        $stmt->bindParam(':image', $data['image']);
        $stmt->bindParam(':description', $data['description']);
        $stmt->bindParam(':price', $data['price']);
        $stmt->bindParam(':original_price', $data['originalPrice']);
        
        if ($stmt->execute()) {
            return array('success' => true, 'message' => 'Portfolio item updated successfully');
        }
        
        return array('success' => false, 'message' => 'Failed to update portfolio item');
    }
    
    // Delete portfolio item
    public function deletePortfolioItem($id) {
        $query = "DELETE FROM portfolio_items WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            return array('success' => true, 'message' => 'Portfolio item deleted successfully');
        }
        
        return array('success' => false, 'message' => 'Failed to delete portfolio item');
    }
    
    // Get categories
    public function getCategories() {
        $query = "SELECT DISTINCT category FROM portfolio_items ORDER BY category";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        
        $categories = array('All');
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $categories[] = $row['category'];
        }
        
        return $categories;
    }
}

// Handle API requests
$api = new PortfolioAPI();
$method = $_SERVER['REQUEST_METHOD'];
$request = explode('/', trim($_SERVER['PATH_INFO'], '/'));

switch ($method) {
    case 'GET':
        if (isset($request[0]) && $request[0] === 'categories') {
            echo json_encode($api->getCategories());
        } elseif (isset($request[0]) && is_numeric($request[0])) {
            $item = $api->getPortfolioItem($request[0]);
            if ($item) {
                echo json_encode($item);
            } else {
                http_response_code(404);
                echo json_encode(array('message' => 'Item not found'));
            }
        } else {
            $category = isset($_GET['category']) ? $_GET['category'] : null;
            echo json_encode($api->getPortfolioItems($category));
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        echo json_encode($api->addPortfolioItem($data));
        break;
        
    case 'PUT':
        if (isset($request[0]) && is_numeric($request[0])) {
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode($api->updatePortfolioItem($request[0], $data));
        } else {
            http_response_code(400);
            echo json_encode(array('message' => 'Invalid request'));
        }
        break;
        
    case 'DELETE':
        if (isset($request[0]) && is_numeric($request[0])) {
            echo json_encode($api->deletePortfolioItem($request[0]));
        } else {
            http_response_code(400);
            echo json_encode(array('message' => 'Invalid request'));
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(array('message' => 'Method not allowed'));
        break;
}
?>
