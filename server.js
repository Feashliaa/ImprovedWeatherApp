const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const subscriptionKey = process.env.subscriptionKey;

app.use(express.static(path.join(__dirname)));

// Route to retrieve the map options including the subscription key
app.get('/api/mapOptions', (req, res) => {
    const latitude = req.query.latitude;
    const longitude = req.query.longitude;

    // Construct the map options with the subscription key
    const mapOptions = {
        center: [parseFloat(longitude), parseFloat(latitude)],
        zoom: 12,
        language: 'en-US',
        authOptions: {
            authType: 'subscriptionKey',
            subscriptionKey: subscriptionKey
        }
    };
    res.json(mapOptions);
});

app.get('/api/subscriptionKey', (req, res) => {
    res.json({ subscriptionKey: subscriptionKey });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
