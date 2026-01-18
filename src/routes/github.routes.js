const express = require('express');
const router = express.Router();
const githubController = require('../controllers/github.controller');

router.get('/:username', githubController.getGitHubData);

module.exports = router;
