/*
    Cravin' App
    Eva King
    Meg Rumble
    Colin Shifley
    Dan Orlovsky

    UNCC Coding Bootcamp

    APIs used:
        Zomato
        Google Geolocate (as a backup to HTML5)

    Persistent Storage:
        Firebase
*/
'use strict';
// FIREBASE CONFIG
var config = {
    apiKey: "AIzaSyAfZPBHzrGWnwIrnZTZrw8LBet6cKYPIoM",
    authDomain: "codersbay-a751d.firebaseapp.com",
    databaseURL: "https://codersbay-a751d.firebaseio.com",
    projectId: "codersbay-a751d",
    storageBucket: "codersbay-a751d.appspot.com",
    messagingSenderId: "1033281453498"
};

firebase.initializeApp(config);
var database = firebase.database();

// FIREBASE AUthorization Provider
var provider = new firebase.auth.GoogleAuthProvider();


function review(uid, starRating, text) {
    this.uid = uid;
    this.text = text;
};
// User object
function User(uid, name, email, photoURL) {
    this.uid = uid;
    this.name = name;
    this.email = email;
    this.photoURL = photoURL;
    this.currentCityId = 0;
    this.currentCity = "";
    this.currentState = "";
    this.cities = [];
    this.restaurants = [];
    this.userHasEaten = false;
    this.lastRestaurantId = "";
};

// Restaurant object
function Restaurant(id, name, address, lat, lon, thumb, price_range, average_cost, featured_image, rating_text) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.googleAddress = address.replace(/,/g, "");
    this.googleAddress = this.googleAddress.replace(/ /g, "+");
    this.lat = lat;
    this.lon = lon;
    this.distance = 0;
    this.thumb = thumb;
    this.price_range = price_range;
    this.average_cost = average_cost;
    this.featured_image = featured_image;
    this.rating_text = rating_text;
    this.yelpId = 0;
    this.yelpReviews = [];
    this.userReviews = [];
}

// Object to hold API keys
var apiKeys = {
    mapsEmbed: "AIzaSyDqf6wEb0fLt7Wf56hzb84dYQ8OBte-5dE",
    zomato: {
        header: {
            "user-key": "029229483ea9d14f003cd7257516abde"
        },
    },

    yelp: {
        clientId: "dE4ardVf7tro8HdvDguNuA",
        clientSecret: "wdaKsDjLnqLqtp49StvQFag2fhR9p2Rvv5xTkTNtYjX6TyAzLpExHue5xEnpqYkn"
    }

};

//Burger Animation
window.onload=(function() {
    var burg = document.getElementById("food1");
    TweenMax.to(burg, 1, {y:60})
})


// URLs stored for the APIs used.
var apiUrls = {
    zomatoBase: "https://developers.zomato.com/api/v2.1/",
    yelpBestMatch: "https://api.yelp.com/v3/businesses/matches/best",
    // Google direction link, not to API.
    googleDirsUrl: "https://www.google.com/maps/dir/",
    googleGeoLocation: `https://www.googleapis.com/geolocation/v1/geolocate?key=${ apiKeys.mapsEmbed}`,
};

// Returns where we store users in the DB
function getUsrDataLoc(uid) {
    return "users/" + uid;
}

// Returns where we store restaurants in the DB
function getRestDataLoc(rid) {
    return "restaurants/" + rid;
}


// Thank you StackOverflow.
// Finds the distance between two locations, used for sort.
function distance(lat1, lon1, lat2, lon2) {
    var p = 0.017453292519943295; // Math.PI / 180
    var c = Math.cos;
    var a = 0.5 - c((lat2 - lat1) * p) / 2 +
        c(lat1 * p) * c(lat2 * p) *
        (1 - c((lon2 - lon1) * p)) / 2;
    var milesAway = (12742 * Math.asin(Math.sqrt(a))) / 1.609344;
    return (milesAway).toFixed(1); // 2 * R; R = 6371 km
}

$(document).ready(function () {
    // App instance
    var app = {
        // Store screens for back-button functionality
        lastScreens: [],
        // Stores the ID of our current screen
        currentScreen: "",
        // Stores our Latitude and Longitude coordinates
        latLong: [],
        // Stores a list of returned restaurants
        restaurantResults: [],
        // Our current user object
        currentUser: null,
        // Our current craving identitfier
        currentCraving: 0,
        // Function to sort restaurant array by distance
        sortByDistance: function (a, b) {
            if (a.distance < b.distance) {
                return -1;
            }
            if (a.distance > b.distance) {
                return 1;
            }
            return 0;
        },
        // Function to sort restaurant array by quality
        sortByQuality: function (a, b) {
            if (a.rating_text < b.rating_text) {
                return -1;
            }
            if (a.rating_text > b.rating_text) {
                return 1;
            }
            return 0;
        },
        // Generic function to make Ajax call
        callApi: function (type, url, headers, callback) {
            $.ajax({
                type: type,
                url: url,
                headers: headers,
                success: function (response) {
                    callback(response);
                }
            });
        },
        // Calls the Zomato API to get the user's City Id
        getCity: function () {
            // Builds the url to call
            var callUrl = `${ apiUrls.zomatoBase }cities?lat=${ this.latLong[0] }&lon=${ this.latLong[1] }`;
            // Calls the API
            this.callApi("get", callUrl, apiKeys.zomato.header, function (response) {
                // Parses the results, stores them in the Firebase storage bucket
                app.currentUser.currentCityId = response.location_suggestions[0].id;
                app.currentUser.currentCity = response.location_suggestions[0].name;
                app.currentUser.currentState = response.location_suggestions[0].state_code;
                database.ref(getUsrDataLoc(app.currentUser.uid)).update({
                    currentCityId: app.currentUser.currentCityId,
                    currentCity: app.currentUser.currentCity,
                    currentState: app.currentUser.currentState,
                });
            });
        },
        // Shows the Modal alert dialog
        showAlert: function (title, body) {

            $("#alert-title").text(title);
            $("#alert-body").text(body);
            $("#alert-modal").modal();
        },
        // Shows the modal Yes/No dialog
        showYesNo: function (title, body) {
            $("#btn-yes").prop("disabled", false);
            $("#btn-no").prop("disabled", false);
            $("#yes-no-title").text(title);
            $("#yes-no-body").text(body);
            $("#yes-no-modal").modal();
        },
        // Hides the modal Yes/No Dialog
        hideYesNo: function () {
            $("#btn-yes").prop("disabled", true);
            $("#btn-no").prop("disabled", true);
            $("#yes-no-modal").modal('hide');
        },
        // Displays our "loading" indicator that displays a font-awesome spinner
        showLoadingScreen: function () {
            var body = document.body;
            var html = document.documentElement;
            // Since our screens are continually changing the height of the DOM, we find the absolute highest height at the moment.
            var height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
            $("#loading-screen").css({
                "height": height,
                "display": "block"
            });
        },
        // Hides the loading screen
        hideLoadingScreen: function () {
            $("#loading-screen").css("display", "none");
        },
        // Fades from one screen to the next
        switchScreens: function (closeId, openId, storeScreen, callback) {
            // Grabs the new currentScreen (used for back button functionality).
            app.currentScreen = openId;
            // Push the screen we are leaving into the lastScreens array should we be prompted.  We don't do this if the user hits the "back button"
            // or from the splash screen.
            if (storeScreen === true) {
                window.history.pushState({
                    state: window.history.length
                }, "", closeId);
                app.lastScreens.push(closeId);
            }
            // Animate the closing, and change the CSS
            $(closeId).animate({ opacity: 0 }, 500, function () { 
                $(openId).css({
                    "display": "block",
                    "min-height": "85vh",
                    "height": "auto",
                    "z-index": "9"
                });
                $(closeId).css({
                    "display": "none",
                    "height": 0,
                    "z-index": "0"
                });
                $("#footer").css({
                    "display": "none"
                });
                $("#footer").css({
                    "display": "block"
                });
                $(openId).animate({
                    opacity: 1
                }, 500, function () {
                    $('html, body').animate({
                        scrollTop: 0
                    });
                    if (callback) {
                        callback();
                    }
                });
            });

            // Change the opening screens CSS and animate the opening.


        },
        // Loops through our restaurantResults array to get more values.
        populateResults: function () {
            var resultsBox = $("#results");
            resultsBox.empty();
            // Cycles through all restaurants
            for (var i = 0; i < 3; i++) {
                var priceRange = "";
                var rest = app.restaurantResults[i];
                var image;
                if(rest.featured_image !== "") {
                    image = rest.featured_image; 
                } else if(rest.thumb !== "") {
                    image = rest.thumb;
                } else {
                    image = "../assets/images/noimage.png";
                }
                for (var x = 0; x < Math.floor(app.restaurantResults[i].price_range); x++) {
                    priceRange += "$";
                }

                var resultsDisplay = $(`
                    <div class="row justify-content-center">    
                        <div class="col-12">
                            <div class="row results-box first-result clearfix">
                                <div class="col-4">
                                <img class="results-image img-fluid img-thumbnail" src="${ image }" />
                                </div>
                                <div class="col-8">
                                <div class="restaurant-info">
                                    <h3 class="restaurant-name">${ rest.name }</h3>
                                    <h4>Average Rating: ${ rest.rating_text }</h4>
                                    <h4>Price Range: <span style="color: green;">${ priceRange }</span></h4>
                                    <h4>Address: ${ rest.address }</h4>
                                    <h4>About ${ rest.distance } miles away.</h4>
                                    <h5>
                                        <a href="${ apiUrls.googleDirsUrl }${app.latLong[0]},${app.latLong[1]}/${rest.googleAddress}" 
                                        class="go-to-restaurant" data-index="${ i }">Let's Go!</a>
                                    </h5>
                                </div>
                                </div>
                            </div>
                       </div>                       
                    </div>`);
                resultsBox.append(resultsDisplay);

            };
        },
        findCraving(type) {
            // If they've selected no craving, alert and bail.
            if (app.currentCraving === 0) {
                app.showAlert("No craving", "Please select a craving to continue!");
                return;
            }
            // Opens the loading screen
            app.showLoadingScreen();
            // Bu
            var callUrl = `${ apiUrls.zomatoBase }/search?lat=${ app.latLong[0] }&lon=${ app.latLong[1] }&cuisines=${ app.currentCraving }&radius=3000`;
            app.restaurantResults.length = 0;

            app.callApi("get", callUrl, apiKeys.zomato.header, function (response) {
                for (var i = 0; i < response.restaurants.length; i++) {
                    var rest = response.restaurants[i].restaurant;
                    console.log(rest);
                    var newRestaurant = new Restaurant(rest.id, rest.name, rest.location.address, rest.location.latitude, rest.location.longitude,
                        rest.thumb, rest.price_range, rest.average_cost_for_two, rest.featured_image, rest.user_rating.rating_text);

                    newRestaurant.distance = parseFloat(distance(app.latLong[0], app.latLong[1], newRestaurant.lat, newRestaurant.lon));
                    app.restaurantResults.push(newRestaurant);
                };
                if (type === "fast") {
                    app.restaurantResults.sort(app.sortByDistance);
                } else {
                    app.restaurantResults.sort(app.sortByQuality);
                }

                app.populateResults();
                app.hideLoadingScreen();
                app.switchScreens("#craving-select-screen", "#results-screen", true);
            })
        },
        addRestuarantToDb: function (idx) {
            var restaurant = app.restaurantResults[idx];
            var dbRestLoc = getRestDataLoc(restaurant.id);
            var dbUsrLoc = getUsrDataLoc(app.currentUser.uid);
            database.ref(dbUsrLoc).once("value", function (usrSnap) {
                var user = usrSnap.val();
                database.ref(dbRestLoc).once("value", function (snapshot) {
                    var restData = snapshot.val();
                    if (!restData) {
                        database.ref(dbRestLoc).set(restaurant);
                    }
                });
                user.userHasEaten = true;
                user.lastRestaurantId = restaurant.id;
                if (!user.restaurants) {
                    user.restaurants = [];
                }
                if (user.restaurants.indexOf(restaurant.id) === -1) {
                    user.restaurants.push(restaurant.id);
                }
                database.ref(dbUsrLoc).update(user);
            });
        },
        backButton: function () {
            if (app.lastScreens.length <= 0) {
                window.history.popstate();
                return;
            };
            // Grab the value before we pop it.
            var lastScreen = app.lastScreens[app.lastScreens.length - 1];
            // pop the last screen from our array.
            app.lastScreens.pop();
            // Transition the screens.
            app.switchScreens(app.currentScreen, lastScreen, false);

        },
        eventListeners: function () {
            window.onpopstate = function (event) {
                app.backButton();
            };
            $("#btn-sign-out").on("click", function () {
                firebase.auth().signOut().then(function () {
                    $("#btn-sign-in").css("display", "block");
                    // Sign-out successful.
                }).catch(function (error) {
                    // An error happened.
                });
            });
            $(document).on("click", ".go-to-restaurant", function (e) {
                e.preventDefault();
                app.addRestuarantToDb(parseInt($(this).attr("data-index")));
                window.open($(this).attr("href"));

            });
            $("#btn-fast").on('click', function (e) {
                e.preventDefault();
                app.findCraving("fast")
            });
            $("#btn-best").on('click', function (e) {
                e.preventDefault();
                app.findCraving("best")
            });
            $("#btn-back").on("click", function (e) {
                e.preventDefault();
                window.history.back();
            });

            $("#btn-no").on("click", function (e) {
                database.ref(getUsrDataLoc(app.currentUser.uid)).update({
                    userHasEaten: false,
                    lastRestaurantId: "",
                });
                app.hideYesNo();
            })

            $("#btn-sign-in").on("click", function () {
                firebase.auth().signInWithRedirect(provider);
            });

            firebase.auth().getRedirectResult().then(function (result) {
                if (result.credential) {
                    var token = result.credential.accessToken;
                }
                app.currentUser = result.user;
                if (result.user != null) {

                    database.ref(getUsrDataLoc(app.currentUser.uid)).once("value", function (snapshot) {
                        var userData = snapshot.val();
                        if (!userData) {
                            app.currentUser = new User(app.currentUser.uid, app.currentUser.displayName, app.currentUser.email, app.currentUser.photoURL);
                            database.ref(getUsrDataLoc(app.currentUser.uid)).update(app.currentUser);
                        }
                    })
                }
            });
            $(".craving-box").on("click", function () {
                app.currentCraving = $(this).attr("data-craving-id");
                $(".craving-box").each(function () {
                    $(this).find('.craving-check-wrapper').css("display", "none");
                });
                $(this).find('.craving-check-wrapper').css("display", "block");
            });

            firebase.auth().onAuthStateChanged(function (user) {

                if (user) {
                    //app.currentUser = user;
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(function (position) {
                            app.latLong = [position.coords.latitude, position.coords.longitude];
                            app.getCity();

                        });
                    } else {
                        app.callApi("get", apiUrls.googleGeoLocation, "", function (response) {
                            app.latLong = [response.location.lat, response.location.lng];
                        });
                    };
                    database.ref(getUsrDataLoc(user.uid)).once("value", function (usrSnap) {
                        app.currentUser = usrSnap.val();
                        if (app.currentUser.userHasEaten) {
                            database.ref(getRestDataLoc(app.currentUser.lastRestaurantId)).once("value", function (restSnap) {
                                var restData = restSnap.val();
                                app.showYesNo('Welcome Back, ' + user.displayName,
                                    `You recently satisfied a craving at ${ restData.name }!  Would you like to leave a review about your experience?`);
                            });
                        }
                    });
                    // GO TO THE NEXT PAGE
                    app.switchScreens("#login-screen", "#craving-select-screen", false);
                } else {
                    $("#btn-sign-in").css("display", "block");
                }
            });

        },

    }

    setTimeout(function () {
        app.switchScreens("#splash-screen", "#login-screen", true);
        app.eventListeners();
    }, 2000);
    if (!("geolocation" in navigator)) {
        // GEOLOCATION IS UNAVAILABLE, CAN'T USE THE APP.
    }
});