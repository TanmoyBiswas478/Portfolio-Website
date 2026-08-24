<!DOCTYPE html>
<html lang="en" ng-app="portfolioApp">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DNK - Creative Portfolio</title>
    
    <!-- Bootstrap 4 CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
    <!-- Route View Container -->
    <div ng-view></div>
    
    <!-- Original Content (can be moved to separate template files) -->
    <div ng-controller="MainController">
    <!-- Header/Navigation -->
    <nav class="navbar navbar-expand-lg navbar-light bg-white sticky-top border-bottom">
        <div class="container">
            <a class="navbar-brand font-weight-bold text-primary" href="#">DNK</a>
            
            <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav mx-auto">
                    <li class="nav-item">
                        <a class="nav-link font-weight-medium" href="#home">HOME</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link font-weight-medium" href="#store">STORE</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link font-weight-medium" href="#blog">BLOG</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link font-weight-medium" href="#women">WOMEN</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link font-weight-medium" href="#accessories">ACCESSORIES</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link font-weight-medium" href="#account">ACCOUNT</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link font-weight-medium" href="#about">ABOUT</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link font-weight-medium" href="#!/contact">CONTACT US</a>
                    </li>
                </ul>
                
                <div class="navbar-nav">
                    <a class="nav-link" href="#"><i class="fas fa-search"></i></a>
                    <a class="nav-link" href="#"><i class="fas fa-user"></i></a>
                    <a class="nav-link" href="#"><i class="fas fa-shopping-cart"></i></a>
                </div>
            </div>
        </div>
    </nav>

    <!-- Hero Banner -->
    <section class="hero-banner" id="home">
        <div class="hero-overlay"></div>
        <div class="container h-100">
            <div class="row h-100 align-items-center">
                <div class="col-lg-6">
                    <h1 class="hero-title text-white mb-4">{{heroData.title}}</h1>
                    <p class="hero-subtitle text-white mb-4">{{heroData.subtitle}}</p>
                    <div class="hero-buttons">
                        <button class="btn btn-light btn-lg mr-3 mb-2">
                            <i class="fas fa-eye mr-2"></i>{{heroData.primaryCta}}
                        </button>
                        <button class="btn btn-outline-light btn-lg mb-2">
                            {{heroData.secondaryCta}} <i class="fas fa-arrow-right ml-2"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Client Logos -->
    <section class="client-logos py-4">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-1 text-center">
                    <button class="btn btn-sm btn-light rounded-circle">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                </div>
                <div class="col-10">
                    <div class="row justify-content-between align-items-center">
                        <div class="col" ng-repeat="client in clientLogos">
                            <div class="text-center">
                                <img ng-src="{{client.logo}}" alt="{{client.name}}" class="client-logo">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-1 text-center">
                    <button class="btn btn-sm btn-light rounded-circle">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Portfolio Grid -->
    <section class="portfolio-section py-5" id="store">
        <div class="container">
            <!-- Category Tabs -->
            <div class="row justify-content-center mb-4">
                <div class="col-lg-8">
                    <ul class="nav nav-pills justify-content-center portfolio-tabs">
                        <li class="nav-item" ng-repeat="category in categories">
                            <a class="nav-link" 
                               ng-class="{active: activeCategory === category}" 
                               ng-click="setActiveCategory(category)">{{category}}</a>
                        </li>
                    </ul>
                </div>
            </div>
            
            <!-- Portfolio Items -->
            <div class="row">
                <div class="col-lg-2 col-md-4 col-sm-6 mb-4" ng-repeat="item in filteredItems">
                    <div class="card portfolio-card h-100">
                        <div class="card-img-wrapper">
                            <img ng-src="{{item.image}}" class="card-img-top" alt="{{item.title}}">
                            <span class="badge badge-primary category-badge">{{item.category}}</span>
                        </div>
                        <div class="card-body">
                            <h6 class="card-title font-weight-medium">{{item.title}}</h6>
                            <p class="card-text text-muted small">{{item.description}}</p>
                            <div class="price-wrapper">
                                <span class="font-weight-bold text-primary">{{item.price}}</span>
                                <span class="text-muted small text-decoration-line-through ml-2" ng-if="item.originalPrice">{{item.originalPrice}}</span>
                            </div>
                        </div>
                        <div class="card-footer bg-transparent">
                            <button class="btn btn-outline-primary btn-sm btn-block">View Details</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="text-center" ng-if="filteredItems.length === 0">
                <p class="text-muted">No items found in this category.</p>
            </div>
            
            <div class="text-center mt-4" ng-if="filteredItems.length > 10">
                <button class="btn btn-outline-primary">Load More</button>
            </div>
        </div>
    </section>

    <!-- Feature Banner -->
    <section class="feature-banner py-5">
        <div class="container">
            <div class="feature-banner-card">
                <div class="row align-items-center">
                    <div class="col-lg-6 mb-4 mb-lg-0">
                        <h2 class="text-white mb-3">{{featureBanner.title}}</h2>
                        <p class="text-white-50 mb-4">{{featureBanner.description}}</p>
                        <div class="d-flex flex-column flex-sm-row align-items-start">
                            <span class="badge badge-outline-light mb-2 mb-sm-0 mr-sm-3">
                                Buy This Pack At 20% Discount, Use Code: {{featureBanner.discountCode}}
                            </span>
                            <button class="btn btn-light" ng-click="featureBanner.onButtonClick()">
                                {{featureBanner.buttonText}}
                            </button>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="feature-image-wrapper">
                            <img ng-src="{{featureBanner.imageSrc}}" alt="Special Edition Design" class="img-fluid rounded">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-light border-top py-5">
        <div class="container">
            <div class="row">
                <div class="col-md-3 mb-4">
                    <h5 class="font-weight-semibold mb-3">Shop Information</h5>
                    <ul class="list-unstyled">
                        <li><a href="#" class="text-decoration-none text-muted">FAQ</a></li>
                        <li><a href="#" class="text-decoration-none text-muted">Contact Us</a></li>
                    </ul>
                </div>
                <div class="col-md-3 mb-4">
                    <h5 class="font-weight-semibold mb-3">Terms and Policy</h5>
                    <ul class="list-unstyled">
                        <li><a href="#" class="text-decoration-none text-muted">Return Acceptance</a></li>
                        <li><a href="#" class="text-decoration-none text-muted">Privacy Policy</a></li>
                    </ul>
                </div>
                <div class="col-md-3 mb-4">
                    <h5 class="font-weight-semibold mb-3">My Account</h5>
                    <ul class="list-unstyled">
                        <li><a href="#" class="text-decoration-none text-muted">Track Order</a></li>
                        <li><a href="#" class="text-decoration-none text-muted">Help Center</a></li>
                    </ul>
                </div>
                <div class="col-md-3 mb-4">
                    <h5 class="font-weight-semibold mb-3">Download App</h5>
                    <a href="#">
                        <img src="https://images.unsplash.com/photo-1633409361618-c73427e4e206?w=200&q=80" alt="Download App" class="app-download-img">
                    </a>
                </div>
            </div>
            
            <hr class="my-4">
            
            <div class="row align-items-center">
                <div class="col-md-6">
                    <p class="text-muted mb-0">Copyright © 2023 Brandstore</p>
                </div>
                <div class="col-md-6 text-md-right">
                    <p class="text-muted mb-0">Powered by Brandstore</p>
                </div>
            </div>
        </div>
    </footer>

    <!-- Contact & Social Section -->
    <section class="contact-social bg-dark text-white py-5">
        <div class="container text-center">
            <h3 class="mb-3">"For Buy"</h3>
            <p class="mb-3">
                Email: tanmoybiswas478@gmail.com / 
                <a href="#" class="text-info">Behance</a>
            </p>
            <p class="small mb-4">"Follow Me"</p>
            <h2 class="mb-4">Brand store homepage</h2>
            <div class="d-flex justify-content-center">
                <button class="btn btn-outline-light btn-sm mr-2">
                    <i class="fas fa-heart mr-1"></i> 0
                </button>
                <button class="btn btn-outline-light btn-sm mr-2">
                    <i class="fas fa-comment mr-1"></i> 0
                </button>
                <button class="btn btn-outline-light btn-sm">
                    <i class="fas fa-bookmark mr-1"></i> 0
                </button>
            </div>
        </div>
    </section>

    <!-- jQuery, Popper.js, Bootstrap JS -->
    <script src="https://code.jquery.com/jquery-3.5.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
    
    <!-- AngularJS -->
    <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular.min.js"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular-route.min.js"></script>
    
    <!-- Custom JavaScript -->
    <script src="assets/js/app.js"></script>
    </div>
</body>
</html>
