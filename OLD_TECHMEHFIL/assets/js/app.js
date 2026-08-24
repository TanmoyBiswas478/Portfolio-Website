// AngularJS Application
angular
  .module("portfolioApp", ["ngRoute"])
  .config([
    "$routeProvider",
    function ($routeProvider) {
      $routeProvider
        .when("/", {
          templateUrl: "pages/dashboard.php",
          controller: "dashCtrl",
        })
        .when("/dash", {
          templateUrl: "pages/dashboard.php",
          controller: "dashCtrl",
        })
        .when("/contact", {
          templateUrl: "pages/contactus.html",
          controller: "dashCtrl",
        })
        .when("/stype", {
          templateUrl: "pages/stype.html",
          controller: "dashCtrl",
        })
        .when("/product", {
          templateUrl: "pages/product.html",
          controller: "dashCtrl",
        });
    },
  ])
  .controller("dashCtrl", [
    "$scope",
    function ($scope) {
      // Dashboard controller logic can be added here
    },
  ])
  .controller("MainController", [
    "$scope",
    function ($scope) {
      // Hero Banner Data
      $scope.heroData = {
        title: "Raining Offers For Hot Summer!",
        subtitle: "25% Off On All Products",
        primaryCta: "Shop Now",
        secondaryCta: "Find More",
      };

      // Client Logos Data
      $scope.clientLogos = [
        {
          id: 1,
          name: "Client 1",
          logo: "https://api.dicebear.com/7.x/avataaars/svg?seed=logo1",
        },
        {
          id: 2,
          name: "Client 2",
          logo: "https://api.dicebear.com/7.x/avataaars/svg?seed=logo2",
        },
        {
          id: 3,
          name: "Client 3",
          logo: "https://api.dicebear.com/7.x/avataaars/svg?seed=logo3",
        },
        {
          id: 4,
          name: "Client 4",
          logo: "https://api.dicebear.com/7.x/avataaars/svg?seed=logo4",
        },
        {
          id: 5,
          name: "Client 5",
          logo: "https://api.dicebear.com/7.x/avataaars/svg?seed=logo5",
        },
      ];

      // Portfolio Categories
      $scope.categories = ["All", "Fashion", "Clothing", "Accessories", "Bags"];
      $scope.activeCategory = "All";

      // Portfolio Items Data
      $scope.portfolioItems = [
        {
          id: "1",
          title: "Yellow Shoes",
          category: "Fashion",
          image:
            "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&q=80",
          description: "Stylish yellow shoes for summer",
          price: "$120.00",
          originalPrice: "$150.00",
        },
        {
          id: "2",
          title: "Blue Shoes",
          category: "Fashion",
          image:
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80",
          description: "Comfortable blue sneakers",
          price: "$110.00",
        },
        {
          id: "3",
          title: "Brown Shoes",
          category: "Fashion",
          image:
            "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&q=80",
          description: "Classic brown leather shoes",
          price: "$130.00",
        },
        {
          id: "4",
          title: "Denim Jeans",
          category: "Clothing",
          image:
            "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&q=80",
          description: "Blue denim jeans",
          price: "$95.00",
        },
        {
          id: "5",
          title: "Gray Jacket",
          category: "Clothing",
          image:
            "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500&q=80",
          description: "Stylish gray jacket",
          price: "$120.00",
        },
        {
          id: "6",
          title: "Denim Shorts",
          category: "Clothing",
          image:
            "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500&q=80",
          description: "Summer denim shorts",
          price: "$75.00",
          originalPrice: "$95.00",
        },
        {
          id: "7",
          title: "Silver Bracelet",
          category: "Accessories",
          image:
            "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=500&q=80",
          description: "Elegant silver bracelet",
          price: "$60.00",
        },
        {
          id: "8",
          title: "Beaded Bracelet",
          category: "Accessories",
          image:
            "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=500&q=80",
          description: "Colorful beaded bracelet",
          price: "$40.00",
        },
        {
          id: "9",
          title: "Leather Bag",
          category: "Bags",
          image:
            "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&q=80",
          description: "Premium leather bag",
          price: "$180.00",
        },
        {
          id: "10",
          title: "Red Bag",
          category: "Bags",
          image:
            "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&q=80",
          description: "Stylish red handbag",
          price: "$150.00",
        },
      ];

      // Feature Banner Data
      $scope.featureBanner = {
        title: "Special Edition Designs",
        description:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo. Consectetur adipiscing elit.",
        discountCode: "ART20",
        buttonText: "Buy Now",
        imageSrc:
          "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80",
        onButtonClick: function () {
          alert("Buy Now clicked!");
        },
      };

      // Filter portfolio items based on active category
      $scope.filteredItems = $scope.portfolioItems;

      // Function to set active category and filter items
      $scope.setActiveCategory = function (category) {
        $scope.activeCategory = category;

        if (category === "All") {
          $scope.filteredItems = $scope.portfolioItems;
        } else {
          $scope.filteredItems = $scope.portfolioItems.filter(function (item) {
            return item.category === category;
          });
        }
      };

      // Initialize filtered items
      $scope.setActiveCategory($scope.activeCategory);
    },
  ]);

// jQuery for additional interactions
$(document).ready(function () {
  // Smooth scrolling for navigation links
  $('a[href^="#"]').on("click", function (event) {
    var target = $(this.getAttribute("href"));
    if (target.length) {
      event.preventDefault();
      $("html, body")
        .stop()
        .animate(
          {
            scrollTop: target.offset().top - 70,
          },
          1000,
        );
    }
  });

  // Add fade-in animation to portfolio cards on scroll
  $(window).scroll(function () {
    $(".portfolio-card").each(function () {
      var elementTop = $(this).offset().top;
      var elementBottom = elementTop + $(this).outerHeight();
      var viewportTop = $(window).scrollTop();
      var viewportBottom = viewportTop + $(window).height();

      if (elementBottom > viewportTop && elementTop < viewportBottom) {
        $(this).addClass("fade-in");
      }
    });
  });

  // Navbar background change on scroll
  $(window).scroll(function () {
    if ($(window).scrollTop() > 50) {
      $(".navbar").addClass("scrolled");
    } else {
      $(".navbar").removeClass("scrolled");
    }
  });

  // Copy discount code to clipboard
  $(".badge-outline-light").click(function () {
    var discountCode = "ART20";

    // Create temporary input element
    var tempInput = $("<input>");
    $("body").append(tempInput);
    tempInput.val(discountCode).select();
    document.execCommand("copy");
    tempInput.remove();

    // Show feedback
    $(this).text("Code Copied!");
    setTimeout(function () {
      $(".badge-outline-light").text(
        "Buy This Pack At 20% Discount, Use Code: ART20",
      );
    }, 2000);
  });

  // Mobile menu close on link click
  $(".navbar-nav .nav-link").on("click", function () {
    $(".navbar-collapse").collapse("hide");
  });
});
