const Listing = require("../models/listing");
const https = require("https");
const Trip = require("../models/trip"); 

module.exports.renderItinerary = (req, res) => {
    res.render("itinerary.ejs");
};

module.exports.generateItinerary = async (req, res) => {
    let { location, days, budget, style } = req.body;
    
    try {
        location = String(location || "").trim();
        if (!location) throw new Error("Location is required");

        const budgetNum = parseInt(budget) || 25000;
        const daysNum = parseInt(days) || 3;
        const pricePerNight = Math.floor(budgetNum / daysNum);

        // Escape regex to force strict, exact matching and prevent database fallback bugs
        const safeLocation = location.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

        // Smart Search: Match Location, Country, or Title AND check if it's within budget
        const listings = await Listing.find({
            $and: [
                {
                    $or: [
                        { location: { $regex: safeLocation, $options: "i" } },
                        { country: { $regex: safeLocation, $options: "i" } },
                        { title: { $regex: safeLocation, $options: "i" } }
                    ]
                },
                { price: { $lte: pricePerNight } }
            ]
        }).limit(4);

        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            console.error("CRITICAL ERROR: GROQ_API_KEY is not defined in the .env file!");
            return res.status(500).json({ error: "Server configuration error. API key missing." });
        }

        const prompt = `You are a travel expert. Create a ${daysNum}-day itinerary STRICTLY AND ONLY for ${location}. Budget: Rs.${budgetNum}. Style: ${style}. 

CRITICAL RULES: 
1. Even if the budget is mathematically impossible or too low for ${location}, you MUST NEVER change the destination. 
2. You must keep all activities, overviews, and hotels strictly inside ${location}. 
3. If the budget is low, suggest free activities (walking, parks) and budget hostels/street food.

Reply ONLY with valid JSON matching this exact structure: {"overview":"string","estimatedCost":"string","suggestedStays":[{"name":"hotel name","pricePerNight":"Rs.X","area":"area"}],"days":[{"day":1,"title":"string","activities":[{"time":"Morning","description":"string"},{"time":"Afternoon","description":"string"},{"time":"Evening","description":"string"},{"time":"Night","description":"string"}],"tip":"string"}]}`;

        const postData = JSON.stringify({
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }, 
            messages: [
                { role: "system", content: "You are a backend JSON data generator. Output ONLY valid JSON." },
                { role: "user", content: prompt }
            ]
        });

        const groqResponse = await new Promise((resolve, reject) => {
            const options = {
                hostname: "api.groq.com",
                path: "/openai/v1/chat/completions",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Length": Buffer.byteLength(postData)
                }
            };
            
            const req2 = https.request(options, (response) => {
                let data = "";
                response.on("data", chunk => data += chunk);
                response.on("end", () => resolve(JSON.parse(data)));
            });
            
            req2.on("error", reject);
            req2.write(postData);
            req2.end();
        });

        if (groqResponse.error) {
            return res.status(500).json({ error: `AI Error: ${groqResponse.error.message}` });
        }

        const text = groqResponse.choices[0].message.content.trim();
        const itinerary = JSON.parse(text);
        
        // Pass both the itinerary and the strictly filtered listings
        res.json({ ...itinerary, listings, perNightBudget: pricePerNight });
        
    } catch (err) {
        console.error("Backend Catch Error:", err.message);
        res.status(500).json({ error: "Failed to generate itinerary. Please try again." });
    }
};

module.exports.saveItinerary = async (req, res) => {
    try {
        // Ensure the user is actually logged in before saving
        if (!req.user) {
            return res.status(401).json({ error: "You must be logged in to save trips!" });
        }

        const { inputs, data } = req.body;

        const newTrip = new Trip({
            owner: req.user._id,
            location: inputs.location,
            days: inputs.days,
            budget: inputs.budget,
            style: inputs.style,
            tripData: data
        });

        await newTrip.save();
        res.status(200).json({ success: true, message: "Trip saved successfully!" });
    } catch (err) {
        console.error("Save Trip Error:", err);
        res.status(500).json({ error: "Failed to save trip to database." });
    }
};

module.exports.renderMyTrips = async (req, res) => {
    try {
        // Fetch trips that belong ONLY to the currently logged-in user
        // .sort({ createdAt: -1 }) puts the newest trips at the top
        const trips = await Trip.find({ owner: req.user._id }).sort({ createdAt: -1 });
        
        res.render("my-trips.ejs", { trips });
    } catch (err) {
        console.error("Error fetching trips:", err);
        req.flash("error", "Could not load your saved trips.");
        res.redirect("/listings");
    }
};

// NEW: Show a single saved trip
module.exports.showTrip = async (req, res) => {
    try {
        const { id } = req.params;
        const trip = await Trip.findById(id);
        
        if (!trip) {
            req.flash("error", "Cannot find that trip!");
            return res.redirect("/itinerary/my-trips");
        }

        // Security check: Only the owner can view this trip
        if (req.user && !trip.owner.equals(req.user._id)) {
            req.flash("error", "You do not have permission to view this trip.");
            return res.redirect("/itinerary/my-trips");
        }
        
        res.render("itinerary/show.ejs", { trip }); 
    } catch (err) {
        console.error("Error fetching specific trip:", err);
        req.flash("error", "Something went wrong loading the trip.");
        res.redirect("/itinerary/my-trips");
    }
};