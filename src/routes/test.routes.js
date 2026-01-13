const express = require('express');
const mongoose = require('mongoose');
const supabasePool = require('../config/supabase');

const router = express.Router();

router.get('/test', async (req, res) => {
    const result = {
        status: 'success',
        message: 'Backend is running!',
        timestamp: new Date().toISOString(),
        connections: {
            mongodb: 'unknown',
            supabase: 'unknown',
        },
    };

    // Check MongoDB
    try {
        const mongoState = mongoose.connection.readyState;
        const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
        result.connections.mongodb = states[mongoState] || 'unknown';
    } catch (err) {
        result.connections.mongodb = 'error: ' + err.message;
    }

    // Check Supabase
    try {
        if (supabasePool) {
            const pgRes = await supabasePool.query('SELECT NOW()');
            if (pgRes && pgRes.rows.length > 0) {
                result.connections.supabase = 'connected'; // + pgRes.rows[0].now;
            } else {
                result.connections.supabase = 'connected-no-response';
            }
        } else {
            result.connections.supabase = 'not-configured';
        }
    } catch (err) {
        result.connections.supabase = 'error: ' + err.message;
    }

    res.status(200).json(result);
});

module.exports = router;
