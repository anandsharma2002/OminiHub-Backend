const axios = require('axios');

// @desc    Get GitHub Profile and Repos
// @route   GET /api/github/:username
// @access  Public
exports.getGitHubData = async (req, res) => {
    try {
        const { username } = req.params;
        const token = process.env.GITHUB_TOKEN;

        const config = {
            headers: {
                'Authorization': `token ${token}`
            }
        };

        // Fetch Profile
        const profileRes = await axios.get(`https://api.github.com/users/${username}`, config);

        // Fetch Repos (Sorted by updated, up to 100)
        const reposRes = await axios.get(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`, config);

        res.json({
            profile: profileRes.data,
            repos: reposRes.data
        });

    } catch (error) {
        console.error('GitHub API Error:', error.response?.data?.message || error.message);
        if (error.response?.status === 404) {
            return res.status(404).json({ message: 'GitHub user not found' });
        }
        res.status(500).json({ message: 'Failed to fetch GitHub data' });
    }
};
