const express = require("express");
const router = express.Router();
const itineraryController = require("../controllers/itinerary.js");
const { isLoggedIn } = require("../middleware.js");

router.get("/", itineraryController.renderItinerary);
router.post("/generate", itineraryController.generateItinerary);
router.post("/save", isLoggedIn, itineraryController.saveItinerary); 

// The route to view the list of saved trips
router.get("/my-trips", isLoggedIn, itineraryController.renderMyTrips);

// NEW: The route to view ONE specific saved trip based on its ID
router.get("/:id", isLoggedIn, itineraryController.showTrip);

module.exports = router;