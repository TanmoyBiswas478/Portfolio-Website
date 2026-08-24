// Admin Panel JavaScript
$(document).ready(function () {
  // Load dashboard data
  loadDashboardData();

  // Load portfolio items when tab is clicked
  $('a[href="#portfolio"]').on("shown.bs.tab", function () {
    loadPortfolioItems();
  });

  // Load messages when tab is clicked
  $('a[href="#messages"]').on("shown.bs.tab", function () {
    loadMessages();
  });

  // Handle add item form submission
  $("#add-item-form").on("submit", function (e) {
    e.preventDefault();
    addPortfolioItem();
  });

  // Handle settings form submission
  $("#settings-form").on("submit", function (e) {
    e.preventDefault();
    saveSettings();
  });
});

// Load dashboard statistics
function loadDashboardData() {
  // Load portfolio items count
  $.get("../api/portfolio.php", function (data) {
    $("#total-items").text(data.length);
  });

  // Load categories count
  $.get("../api/portfolio.php/categories", function (data) {
    $("#total-categories").text(data.length - 1); // Exclude 'All'
  });

  // Load messages count
  $.get("../api/contact.php", function (data) {
    $("#total-messages").text(data.length);
  });
}

// Load portfolio items
function loadPortfolioItems() {
  $.get("../api/portfolio.php", function (data) {
    var tbody = $("#portfolio-table tbody");
    tbody.empty();

    data.forEach(function (item) {
      var row = `
                <tr>
                    <td>${item.id}</td>
                    <td><img src="${item.image}" alt="${item.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;"></td>
                    <td>${item.title}</td>
                    <td><span class="badge badge-primary">${item.category}</span></td>
                    <td>${item.price || "N/A"}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editItem(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
      tbody.append(row);
    });
  });
}

// Load contact messages
function loadMessages() {
  $.get("../api/contact.php", function (data) {
    var tbody = $("#messages-table tbody");
    tbody.empty();

    data.forEach(function (message) {
      var date = new Date(message.created_at).toLocaleDateString();
      var row = `
                <tr>
                    <td>${message.id}</td>
                    <td>${message.name}</td>
                    <td>${message.email}</td>
                    <td>${message.subject || "No Subject"}</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="viewMessage(${message.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMessage(${message.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
      tbody.append(row);
    });
  });
}

// Add new portfolio item
function addPortfolioItem() {
  var formData = {
    title: $('input[name="title"]').val(),
    category: $('select[name="category"]').val(),
    image: $('input[name="image"]').val(),
    description: $('textarea[name="description"]').val(),
    price: $('input[name="price"]').val(),
    originalPrice: $('input[name="originalPrice"]').val(),
  };

  $.ajax({
    url: "../api/portfolio.php",
    method: "POST",
    data: JSON.stringify(formData),
    contentType: "application/json",
    success: function (response) {
      if (response.success) {
        alert("Portfolio item added successfully!");
        $("#addItemModal").modal("hide");
        $("#add-item-form")[0].reset();
        loadPortfolioItems();
        loadDashboardData();
      } else {
        alert("Error: " + response.message);
      }
    },
    error: function () {
      alert("Error adding portfolio item");
    },
  });
}

// Edit portfolio item
function editItem(id) {
  // Get item data
  $.get(`../api/portfolio.php/${id}`, function (item) {
    // Populate form with existing data
    $('input[name="title"]').val(item.title);
    $('select[name="category"]').val(item.category);
    $('input[name="image"]').val(item.image);
    $('textarea[name="description"]').val(item.description);
    $('input[name="price"]').val(item.price);
    $('input[name="originalPrice"]').val(item.originalPrice);

    // Change modal title and form action
    $("#addItemModal .modal-title").text("Edit Portfolio Item");
    $("#add-item-form")
      .off("submit")
      .on("submit", function (e) {
        e.preventDefault();
        updatePortfolioItem(id);
      });

    $("#addItemModal").modal("show");
  });
}

// Update portfolio item
function updatePortfolioItem(id) {
  var formData = {
    title: $('input[name="title"]').val(),
    category: $('select[name="category"]').val(),
    image: $('input[name="image"]').val(),
    description: $('textarea[name="description"]').val(),
    price: $('input[name="price"]').val(),
    originalPrice: $('input[name="originalPrice"]').val(),
  };

  $.ajax({
    url: `../api/portfolio.php/${id}`,
    method: "PUT",
    data: JSON.stringify(formData),
    contentType: "application/json",
    success: function (response) {
      if (response.success) {
        alert("Portfolio item updated successfully!");
        $("#addItemModal").modal("hide");
        loadPortfolioItems();

        // Reset form for adding new items
        $("#addItemModal .modal-title").text("Add New Portfolio Item");
        $("#add-item-form")
          .off("submit")
          .on("submit", function (e) {
            e.preventDefault();
            addPortfolioItem();
          });
      } else {
        alert("Error: " + response.message);
      }
    },
    error: function () {
      alert("Error updating portfolio item");
    },
  });
}

// Delete portfolio item
function deleteItem(id) {
  if (confirm("Are you sure you want to delete this item?")) {
    $.ajax({
      url: `../api/portfolio.php/${id}`,
      method: "DELETE",
      success: function (response) {
        if (response.success) {
          alert("Portfolio item deleted successfully!");
          loadPortfolioItems();
          loadDashboardData();
        } else {
          alert("Error: " + response.message);
        }
      },
      error: function () {
        alert("Error deleting portfolio item");
      },
    });
  }
}

// View message details
function viewMessage(id) {
  // Implementation for viewing message details
  alert("View message functionality - to be implemented");
}

// Delete message
function deleteMessage(id) {
  if (confirm("Are you sure you want to delete this message?")) {
    // Implementation for deleting message
    alert("Delete message functionality - to be implemented");
  }
}

// Save settings
function saveSettings() {
  var formData = $("#settings-form").serialize();

  // Implementation for saving settings
  alert("Settings saved successfully!");
}

// Reset modal when closed
$("#addItemModal").on("hidden.bs.modal", function () {
  $("#add-item-form")[0].reset();
  $("#addItemModal .modal-title").text("Add New Portfolio Item");
  $("#add-item-form")
    .off("submit")
    .on("submit", function (e) {
      e.preventDefault();
      addPortfolioItem();
    });
});
