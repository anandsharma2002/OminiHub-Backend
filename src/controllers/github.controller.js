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

        // Fetch user from DB to get stored links
        // Fetch user from DB (Case-insensitive)
        const User = require('../models/User');
        let user = await User.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        });

        if (!user) {
            console.log(`[GitHub] User ${username} not found by username. Searching socialLinks...`);
            // Fallback: Search in socialLinks
            const users = await User.find({
                'profile.socialLinks.url': { $regex: new RegExp(`github\\.com`, 'i') }
            });

            console.log(`[GitHub] Found ${users.length} candidates with GitHub links.`);

            // Find the correct user by checking if their github link matches the requested username
            user = users.find(u => {
                const link = u.profile.socialLinks?.find(l =>
                    l.url && l.url.toLowerCase().includes(`github.com/${username.toLowerCase()}`)
                );

                if (link) {
                    console.log(`[GitHub] Candidate ${u.username} has link: ${link.url}`);
                    // We already strictly regexed above, but let's just confirm the username part is there
                    return true;
                }
                return false;
            });
        }

        let repos = reposRes.data;

        if (user) {
            console.log(`[GitHub] Found user: ${user.username}, RepoLinks count: ${user.repositoryLinks?.length}`);

            // Create a map for faster lookup
            const linkMap = new Map();
            if (user.repositoryLinks && user.repositoryLinks.length > 0) {
                user.repositoryLinks.forEach(link => {
                    linkMap.set(String(link.repoId), link.url);
                });
            }

            repos = repos.map(repo => {
                const url = linkMap.get(String(repo.id));
                if (url) console.log(`[GitHub] Match: ${repo.name} -> ${url}`);
                return {
                    ...repo,
                    hostingLink: url || null
                };
            });
        } else {
            console.log(`[GitHub] User ${username} not found in DB even via socialLinks.`);
        }

        res.json({
            profile: profileRes.data,
            repos: repos
        });

    } catch (error) {
        console.error('GitHub API Error:', error.response?.data?.message || error.message);
        if (error.response?.status === 404) {
            return res.status(404).json({ message: 'GitHub user not found' });
        }
        res.status(500).json({ message: 'Failed to fetch GitHub data' });
    }
};
