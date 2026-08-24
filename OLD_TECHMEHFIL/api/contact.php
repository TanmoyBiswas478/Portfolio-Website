<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

class ContactAPI {
    private $conn;
    
    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }
    
    // Submit contact form
    public function submitContact($data) {
        // Validate required fields
        if (empty($data['name']) || empty($data['email']) || empty($data['message'])) {
            return array('success' => false, 'message' => 'All fields are required');
        }
        
        // Validate email
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return array('success' => false, 'message' => 'Invalid email format');
        }
        
        // Insert into database
        $query = "INSERT INTO contact_messages (name, email, subject, message, created_at) 
                  VALUES (:name, :email, :subject, :message, NOW())";
        
        $stmt = $this->conn->prepare($query);
        
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':subject', $data['subject']);
        $stmt->bindParam(':message', $data['message']);
        
        if ($stmt->execute()) {
            // Send email notification (optional)
            $this->sendEmailNotification($data);
            
            return array('success' => true, 'message' => 'Message sent successfully');
        }
        
        return array('success' => false, 'message' => 'Failed to send message');
    }
    
    // Send email notification
    private function sendEmailNotification($data) {
        $to = 'tanmoybiswas478@gmail.com';
        $subject = 'New Contact Form Submission: ' . $data['subject'];
        $message = "Name: " . $data['name'] . "\n";
        $message .= "Email: " . $data['email'] . "\n";
        $message .= "Subject: " . $data['subject'] . "\n";
        $message .= "Message: " . $data['message'] . "\n";
        
        $headers = 'From: ' . $data['email'] . "\r\n" .
                   'Reply-To: ' . $data['email'] . "\r\n" .
                   'X-Mailer: PHP/' . phpversion();
        
        mail($to, $subject, $message, $headers);
    }
    
    // Get all contact messages (admin)
    public function getContactMessages() {
        $query = "SELECT * FROM contact_messages ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        
        $messages = array();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $messages[] = array(
                'id' => $row['id'],
                'name' => $row['name'],
                'email' => $row['email'],
                'subject' => $row['subject'],
                'message' => $row['message'],
                'created_at' => $row['created_at']
            );
        }
        
        return $messages;
    }
}

// Handle API requests
$api = new ContactAPI();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        echo json_encode($api->submitContact($data));
        break;
        
    case 'GET':
        // Admin only - add authentication here
        echo json_encode($api->getContactMessages());
        break;
        
    default:
        http_response_code(405);
        echo json_encode(array('message' => 'Method not allowed'));
        break;
}
?>
