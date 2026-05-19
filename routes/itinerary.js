const express = require("express");
const router = express.Router();
const itineraryController = require("../controllers/itinerary.js");
const { isLoggedIn } = require("../middleware.js"); // Ensure you import your auth middleware

router.get("/", itineraryController.renderItinerary);
router.post("/generate", itineraryController.generateItinerary);
router.post("/save", isLoggedIn, itineraryController.saveItinerary); 

// NEW: The route to view saved trips
router.get("/my-trips", isLoggedIn, itineraryController.renderMyTrips);

module.exports = router;